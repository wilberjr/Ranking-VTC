// Camada que gera o relatório e cuida do estado persistido (último resumo).
// Não sabe nada sobre Discord — quem posta embeds/gerencia o painel é o index.js.
const api = require('./apiClient');
const { buildMonthlyReport } = require('./reportBuilder');
const { currentMonth } = require('./dateHelpers');
const { readState, writeState } = require('./state');

class ReportBusyError extends Error {
  constructor() {
    super('Já tem um resumo sendo gerado agora. Aguarde alguns instantes e tente de novo.');
    this.name = 'ReportBusyError';
  }
}

let generating = false;

function isGenerating() {
  return generating;
}

/** Gera o relatório do período informado (padrão: mês atual em andamento). */
async function generateReport({ year, month } = {}) {
  const fallback = currentMonth();
  const y = year ?? fallback.year;
  const m = month ?? fallback.month;
  return buildMonthlyReport(api, { year: y, month: m });
}

/**
 * Gera o relatório e salva como "último resumo" no estado persistido.
 * Lança ReportBusyError se já houver uma geração em andamento (evita duas
 * chamadas simultâneas — por ex. dois cliques no botão do painel ao mesmo tempo).
 */
async function generateAndSave({ year, month } = {}) {
  if (generating) {
    throw new ReportBusyError();
  }
  generating = true;
  try {
    const report = await generateReport({ year, month });
    const state = readState();
    state.lastReport = { ...report, generatedAt: new Date().toISOString() };
    writeState(state);
    return state.lastReport;
  } finally {
    generating = false;
  }
}

module.exports = { generateReport, generateAndSave, isGenerating, ReportBusyError };
