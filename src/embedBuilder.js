const { EmbedBuilder } = require('discord.js');

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
    const rows = drivers.map((d) => {
      const pos = `${d.internalRank}.`.padEnd(4, ' ');
      const name = d.username.length > 20 ? `${d.username.slice(0, 19)}…` : d.username;
      const namePadded = name.padEnd(21, ' ');
      const value = fmtMetricValue(d, metricKey).padStart(14, ' ');
      const globalPos = d.globalRank ? `#${d.globalRank.rank}` : '—';
      return `${pos}${namePadded}${value}   vtlog: ${globalPos}`;
    });

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

module.exports = { buildMonthlyEmbed };
