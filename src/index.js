const { Client, GatewayIntentBits, Events } = require('discord.js');
const cron = require('node-cron');

const config = require('./config');
const VtlogApi = require('./vtlogApi');
const { buildMonthlyReport } = require('./reportBuilder');
const { buildMonthlyEmbed } = require('./embedBuilder');
const { previousMonth } = require('./dateHelpers');

const api = new VtlogApi({ apiToken: config.vtlog.apiToken });

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/** Gera o relatório do período informado (ou do mês anterior, por padrão) e posta no canal configurado. */
async function postMonthlyReport({ year, month, channelId: channelOverride } = {}) {
  const fallback = previousMonth();
  const y = year ?? fallback.year;
  const m = month ?? fallback.month;
  console.log(`[report] Gerando quadro mensal para ${m}/${y}...`);
  const report = await buildMonthlyReport(api, { year: y, month: m });
  const embed = buildMonthlyEmbed(report);

  const channelId = channelOverride || config.discord.reportChannelId;
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error(`Canal ${channelId} não encontrado ou não é um canal de texto.`);
  }

  await channel.send({ embeds: [embed] });
  console.log(`[report] Quadro de ${m}/${y} postado em #${channel.name}.`);
  return report;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot conectado como ${c.user.tag}`);

  cron.schedule(
    config.report.cron,
    () => {
      postMonthlyReport().catch((err) => {
        console.error('[report] Falha ao gerar/postar o quadro mensal automático:', err);
      });
    },
    { timezone: config.report.timezone },
  );
  console.log(`⏰ Postagem automática agendada (cron "${config.report.cron}", fuso ${config.report.timezone}).`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'relatorio') return;

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({ content: '❌ Você precisa de permissão de "Gerenciar Servidor" para usar esse comando.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const monthOpt = interaction.options.getInteger('mes');
    const yearOpt = interaction.options.getInteger('ano');
    const { year, month } = monthOpt && yearOpt ? { year: yearOpt, month: monthOpt } : previousMonth();

    const report = await buildMonthlyReport(api, { year, month });
    const embed = buildMonthlyEmbed(report);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('[comando /relatorio] erro:', err);
    await interaction.editReply(`❌ Erro ao gerar o relatório: ${err.message}`);
  }
});

client.login(config.discord.token);

module.exports = { postMonthlyReport, previousMonth };
