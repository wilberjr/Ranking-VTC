const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');

const config = require('./config');
const reportService = require('./reportService');
const { buildMonthlyEmbed, buildPanelEmbed, buildPanelComponents, PANEL_BUTTON_ID } = require('./embedBuilder');
const { readState, writeState } = require('./state');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const START_TIME = Date.now();

/** Posta o embed de um relatório já gerado no canal informado (ou no canal padrão do .env). */
async function postReportEmbed(report, channelId) {
  const embed = buildMonthlyEmbed(report);
  const targetChannelId = channelId || config.discord.reportChannelId;
  const channel = await client.channels.fetch(targetChannelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Canal ${targetChannelId} não encontrado ou não é um canal de texto.`);
  }
  await channel.send({ embeds: [embed] });
  return channel;
}

/**
 * Gera o relatório (mês atual, salvo automaticamente como "último resumo") e
 * posta no canal informado (ou no canal padrão). Depois atualiza o painel,
 * se houver um ativo, pra refletir esse novo "último resumo".
 */
async function generateAndPost({ year, month, channelId } = {}) {
  const report = await reportService.generateAndSave({ year, month });
  const channel = await postReportEmbed(report, channelId);
  console.log(`[report] Quadro de ${report.period.month}/${report.period.year} postado em #${channel.name}.`);
  await refreshPanel();
  return report;
}

/** Re-renderiza o painel ativo (se houver) com os dados do último resumo salvo. */
async function refreshPanel() {
  const state = readState();
  if (!state.panel) return;

  try {
    const channel = await client.channels.fetch(state.panel.channelId);
    const message = await channel.messages.fetch(state.panel.messageId);
    await message.edit({
      embeds: [buildPanelEmbed(state.lastReport)],
      components: buildPanelComponents(),
    });
  } catch (err) {
    console.warn('[painel] Não consegui atualizar o painel ativo (mensagem/canal pode ter sido apagado):', err.message);
    // A mensagem provavelmente não existe mais — limpa o estado pra não ficar tentando de novo.
    const fresh = readState();
    fresh.panel = null;
    writeState(fresh);
  }
}

/** Cria (ou recria, se já existir um) o painel no canal informado. */
async function createOrRecreatePanel(channelId) {
  const state = readState();

  // Se já existe um painel ativo, tenta apagar a mensagem antiga (melhor esforço).
  if (state.panel) {
    try {
      const oldChannel = await client.channels.fetch(state.panel.channelId);
      const oldMessage = await oldChannel.messages.fetch(state.panel.messageId);
      await oldMessage.delete();
    } catch (err) {
      // Mensagem/canal antigo já não existe (ou sem permissão) — sem problema, seguimos.
    }
  }

  const channel = await client.channels.fetch(channelId);
  const message = await channel.send({
    embeds: [buildPanelEmbed(state.lastReport)],
    components: buildPanelComponents(),
  });

  state.panel = { channelId: channel.id, messageId: message.id };
  writeState(state);
  return message;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot conectado como ${c.user.tag}`);

  cron.schedule(
    config.report.cron,
    () => {
      generateAndPost().catch((err) => {
        console.error('[report] Falha ao gerar/postar o quadro automático:', err);
      });
    },
    { timezone: config.report.timezone },
  );
  console.log(`⏰ Postagem automática agendada (cron "${config.report.cron}", fuso ${config.report.timezone}).`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'relatorio') return handleRelatorio(interaction);
    if (interaction.commandName === 'painel') return handlePainel(interaction);
    if (interaction.commandName === 'status') return handleStatus(interaction);
    return;
  }

  if (interaction.isButton() && interaction.customId === PANEL_BUTTON_ID) {
    return handlePanelButton(interaction);
  }
});

// Todos os comandos abaixo são abertos a QUALQUER participante do servidor
// (nenhuma checagem de permissão) — é assim que foi pedido. Se um dia quiser
// restringir algum deles, dá pra fazer isso direto no Discord, sem mexer no
// código: Configurações do servidor → Integrações → seu bot → permissões por comando.

async function handleRelatorio(interaction) {
  await interaction.deferReply();
  try {
    const monthOpt = interaction.options.getInteger('mes');
    const yearOpt = interaction.options.getInteger('ano');
    const period = monthOpt && yearOpt ? { year: yearOpt, month: monthOpt } : {};

    const report = await reportService.generateAndSave(period);
    const embed = buildMonthlyEmbed(report);
    await interaction.editReply({ embeds: [embed] });
    await refreshPanel();
  } catch (err) {
    await replyBusyOrError(interaction, err);
  }
}

async function handlePanelButton(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await generateAndPost({ channelId: interaction.channelId });
    await interaction.editReply({ content: '✅ Resumo enviado no canal!' });
  } catch (err) {
    await replyBusyOrError(interaction, err);
  }
}

async function handlePainel(interaction) {
  await interaction.deferReply({ ephemeral: true });
  try {
    await createOrRecreatePanel(interaction.channelId);
    await interaction.editReply({ content: '✅ Painel criado/recriado neste canal!' });
  } catch (err) {
    await interaction.editReply({ content: `❌ Erro ao criar o painel: ${err.message}` });
  }
}

async function handleStatus(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const state = readState();
  const uptimeMin = Math.floor((Date.now() - START_TIME) / 60000);
  const lines = [
    `**Uptime do bot:** ${uptimeMin} min`,
    `**Postagem automática:** cron \`${config.report.cron}\` (fuso ${config.report.timezone})`,
    `**Canal padrão de relatório:** <#${config.discord.reportChannelId}>`,
    `**Métrica de ranking:** ${config.vtlog.rankingType}`,
    `**Último resumo gerado:** ${state.lastReport ? new Date(state.lastReport.generatedAt).toLocaleString('pt-BR') : 'nenhum ainda'}`,
    `**Painel ativo:** ${state.panel ? `sim, em <#${state.panel.channelId}>` : 'nenhum (use /painel para criar)'}`,
    `**Gerando agora:** ${reportService.isGenerating() ? 'sim' : 'não'}`,
  ];
  await interaction.editReply({ content: lines.join('\n') });
}

async function replyBusyOrError(interaction, err) {
  const msg = err instanceof reportService.ReportBusyError ? `⏳ ${err.message}` : `❌ Erro ao gerar o relatório: ${err.message}`;
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ content: msg });
  } else {
    await interaction.reply({ content: msg, ephemeral: true });
  }
}

client.login(config.discord.token);

module.exports = { generateAndPost, createOrRecreatePanel, refreshPanel };
