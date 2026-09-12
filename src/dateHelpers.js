/** Retorna { year, month } do mês ANTERIOR ao momento em que é chamado. */
function previousMonth(reference = new Date()) {
  const d = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

module.exports = { previousMonth };
