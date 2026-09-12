require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name} (confira seu arquivo .env)`);
  }
  return value;
}

const config = {
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: required('DISCORD_GUILD_ID'),
    reportChannelId: required('DISCORD_REPORT_CHANNEL_ID'),
  },
  vtlog: {
    apiToken: required('VTLOG_API_TOKEN'),
    vtcId: Number(required('VTLOG_VTC_ID')),
    game: process.env.VTLOG_GAME || 'ETS2',
    rankingBoard: process.env.VTLOG_RANKING_BOARD || 'Realistic',
    rankingSubBoard: process.env.VTLOG_RANKING_SUBBOARD || 'MapaRBR',
    rankingType: process.env.VTLOG_RANKING_TYPE || 'profit', // 'profit' | 'distance'
    // Filtro opcional de mapa para a lista de jobs usada no ranking interno
    // (ex.: 'ets2rbr' para bater exatamente com o sub-board MapaRBR do ranking global).
    // Deixe em branco (VTLOG_MAP=) para não filtrar por mapa.
    map: process.env.VTLOG_MAP === '' ? undefined : (process.env.VTLOG_MAP || 'ets2rbr'),
    apiBaseUrl: 'https://api.vtlog.net',
  },
  report: {
    topN: Number(process.env.REPORT_TOP_N || 15),
    cron: process.env.REPORT_CRON || '0 9 1 * *',
    timezone: process.env.VTLOG_TIMEZONE || 'America/Sao_Paulo',
  },
};

module.exports = config;
