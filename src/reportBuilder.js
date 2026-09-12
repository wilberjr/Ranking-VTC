const config = require('./config');

const VTC_TYPE_MAP = {
  profit: 'profit_total',
  distance: 'distance_total',
};

/**
 * Monta os dados do quadro mensal: resumo da empresa (com posição no ranking
 * global do vtlog) + ranking interno dos motoristas (por lucro ou km no mês,
 * calculado a partir dos jobs da empresa) + posição de cada um deles no
 * ranking global do vtlog.
 */
async function buildMonthlyReport(api, { year, month }) {
  const { vtcId, game, rankingBoard, rankingSubBoard, rankingType, map } = config.vtlog;

  const [vtcInfo, members, vtcStats, jobs, vtcGlobalRank] = await Promise.all([
    api.getVtcInfo(vtcId),
    api.getVtcMembers(vtcId),
    api.getVtcStats(vtcId, { year, month }),
    api.getVtcJobsAll(vtcId, { year, month, map }),
    api.getVtcGlobalRank(vtcId, {
      game,
      board: rankingBoard,
      subBoard: rankingSubBoard,
      type: VTC_TYPE_MAP[rankingType] || 'profit_total',
      dateType: 'm',
      year,
      month,
    }),
  ]);

  const memberBySteamId = new Map(members.map((m) => [String(m.steam_id), m]));

  // Agrega lucro/distância/jobs por motorista a partir dos jobs entregues no mês.
  const perDriver = new Map();
  for (const job of jobs) {
    if (job.job_status && job.job_status !== 'delivered') continue;
    const steamId = String(job.steam_id);
    if (!perDriver.has(steamId)) {
      const member = memberBySteamId.get(steamId);
      perDriver.set(steamId, {
        steamId,
        username: job.username || member?.name || steamId,
        role: member?.role || null,
        jobs: 0,
        profit: 0,
        distance: 0,
      });
    }
    const entry = perDriver.get(steamId);
    entry.jobs += 1;
    entry.profit += Number(job.profit) || 0;
    entry.distance += Number(job.distance_client) || 0;
  }

  const metricKey = rankingType === 'distance' ? 'distance' : 'profit';
  const ranked = [...perDriver.values()].sort((a, b) => b[metricKey] - a[metricKey]);
  ranked.forEach((entry, i) => {
    entry.internalRank = i + 1;
  });

  const topN = ranked.slice(0, config.report.topN);

  // Busca a posição de cada um dos top N no ranking GLOBAL do vtlog.
  for (const entry of topN) {
    try {
      const rank = await api.getUserGlobalRank(entry.steamId, {
        game,
        board: rankingBoard,
        subBoard: rankingSubBoard,
        type: rankingType,
        dateType: 'm',
        year,
        month,
      });
      entry.globalRank = rank.ranked ? { rank: rank.rank, total: rank.total, percentile: rank.percentile } : null;
    } catch (err) {
      console.warn(`[reportBuilder] Falha ao buscar ranking global de ${entry.username} (${entry.steamId}): ${err.message}`);
      entry.globalRank = null;
    }
  }

  return {
    vtcInfo,
    period: { year, month },
    company: {
      stats: vtcStats.stats,
      globalRank: vtcGlobalRank.ranked
        ? { rank: vtcGlobalRank.rank, total: vtcGlobalRank.total, percentile: vtcGlobalRank.percentile }
        : null,
      activeMembers: perDriver.size,
      totalMembers: members.length,
    },
    drivers: topN,
    metricKey,
  };
}

module.exports = { buildMonthlyReport };
