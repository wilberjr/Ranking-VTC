/** Retorna { year, month } do mês ANTERIOR ao momento em que é chamado. */
function previousMonth(reference = new Date()) {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Retorna { year, month } do mês ATUAL (usado pro resumo diário "mês em andamento"). */
function currentMonth(reference = new Date()) {
  return { year: reference.getUTCFullYear(), month: reference.getUTCMonth() + 1 };
}

module.exports = { previousMonth, currentMonth };
