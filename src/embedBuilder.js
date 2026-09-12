const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PANEL_BUTTON_ID = 'panel_send_now';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function fmtNumber(n) {
  return Math.round(n).toLocaleString('pt-BR');
}

function fmtRank({ rank, total, percentile } = {}) {
  if (!rank) return 'sem colocação (sem jobs suficientes no período)';
  return `**#${fmtNumber(rank)}** de ${fmtNumber(total)} (top ${percentile}%)`;
}

function metricLabel(metricKey) {
  return metricKey === 'distance' ? 'km rodados' : 'lucro';
}

function fmtMetricValue(entry, metricKey) {
  return metricKey === 'distance'
    ? `${fmtNumber(entry.distance)} km`
    : `$ ${fmtNumber(entry.profit)}`;
}

/**
 * Monta o embed do Discord com o quadro mensal: resumo da empresa (com
 * posição no ranking global do vtlog) e o ranking interno dos motoristas.
 */
function buildMonthlyEmbed(report) {
  const { vtcInfo, period, company, drivers, metricKey } = report;
  const monthName = MONTH_NAMES[period.month - 1] || period.month;

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`📊 Quadro Mensal — ${vtcInfo.name}`)
    .setDescription(`Referente a **${monthName}/${period.year}**`)
    .setThumbnail(vtcInfo.avatar || null)
    .addFields(
      {
        name: '🏢 Empresa',
        value: [
          `**Lucro do mês:** $ ${fmtNumber(company.stats.profit)}`,
          `**Distância:** ${fmtNumber(company.stats.distance)} km`,
          `**Jobs entregues:** ${fmtNumber(company.stats.jobs)}`,
          `**Motoristas ativos:** ${company.activeMembers} de ${company.totalMembers}`,
          `**Posição no ranking do vtlog:** ${fmtRank(company.globalRank)}`,
        ].join('\n'),
      },
    );

  if (drivers.length === 0) {
    embed.addFields({
      name: `🏆 Ranking individual (por ${metricLabel(metricKey)})`,
      value: 'Nenhum job entregue por motoristas neste período.',
    });
  } else {
    const rows = formatDriverRows(drivers, metricKey, drivers.length);

    // Divide em blocos de até ~1000 caracteres pra respeitar o limite de campo do Discord.
    const chunks = [];
    let current = [];
    let length = 0;
    for (const row of rows) {
      if (length + row.length + 1 > 950) {
        chunks.push(current);
        current = [];
        length = 0;
      }
      current.push(row);
      length += row.length + 1;
    }
    if (current.length) chunks.push(current);

    chunks.forEach((chunk, i) => {
      embed.addFields({
        name: i === 0 ? `🏆 Ranking individual (top ${drivers.length}, por ${metricLabel(metricKey)})` : '​',
        value: '```\n' + chunk.join('\n') + '\n```',
      });
    });
  }

  embed.setFooter({ text: 'VTLog API · gerado automaticamente' }).setTimestamp();

  return embed;
}

function formatDriverRows(drivers, metricKey, limit) {
  return drivers.slice(0, limit).map((d) => {
    const pos = `${d.internalRank}.`.padEnd(4, ' ');
    const name = d.username.length > 20 ? `${d.username.slice(0, 19)}…` : d.username;
    const namePadded = name.padEnd(21, ' ');
    const value = fmtMetricValue(d, metricKey).padStart(14, ' ');
    const globalPos = d.globalRank ? `#${d.globalRank.rank}` : '—';
    return `${pos}${namePadded}${value}   vtlog: ${globalPos}`;
  });
}

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return iso;
  }
}

/**
 * Monta o embed do painel de controle: mostra um resumo compacto do último
 * relatório gerado (por qualquer via — automática, /relatorio ou o botão) e
 * é sempre acompanhado do botão "Enviar resumo agora" (ver buildPanelComponents).
 */
function buildPanelEmbed(lastReport) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // blurple do Discord, pra diferenciar visualmente do embed do relatório (verde)
    .setTitle('🎛️ Painel — Quadro da VTC');

  if (!lastReport) {
    embed.setDescription(
      'Nenhum resumo gerado ainda.\nClique no botão abaixo para gerar o primeiro. 👇',
    );
    embed.setFooter({ text: 'VTLog · painel de controle' });
    return embed;
  }

  const { vtcInfo, period, company, drivers, metricKey, generatedAt } = lastReport;
  const monthName = MONTH_NAMES[period.month - 1] || period.month;

  embed
    .setDescription(`Último resumo — **${monthName}/${period.year}**`)
    .setThumbnail(vtcInfo.avatar || null)
    .addFields({
      name: '🏢 Empresa',
      value: [
        `**Lucro do mês:** $ ${fmtNumber(company.stats.profit)}`,
        `**Motoristas ativos:** ${company.activeMembers} de ${company.totalMembers}`,
        `**Ranking do vtlog:** ${fmtRank(company.globalRank)}`,
      ].join('\n'),
    });

  if (drivers.length > 0) {
    const rows = formatDriverRows(drivers, metricKey, 5);
    embed.addFields({
      name: `🏆 Top 5 (por ${metricLabel(metricKey)})`,
      value: '```\n' + rows.join('\n') + '\n```',
    });
  }

  embed.setFooter({ text: `Gerado em ${fmtDateTime(generatedAt)} · clique no botão para atualizar` });
  return embed;
}

/** Linha de botões do painel: só o "Enviar resumo agora" por enquanto. */
function buildPanelComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PANEL_BUTTON_ID)
      .setLabel('📊 Enviar resumo agora')
      .setStyle(ButtonStyle.Primary),
  );
  return [row];
}

module.exports = { buildMonthlyEmbed, buildPanelEmbed, buildPanelComponents, PANEL_BUTTON_ID };
