// Gera o relatório e imprime no terminal, SEM conectar ao Discord.
// Útil pra validar as chamadas de API e a lógica de ranking antes de subir o bot.
// Uso: npm run test-report  [ou]  node src/testReport.js -- --mes=8 --ano=2026
const config = require('./config');
const VtlogApi = require('./vtlogApi');
const { buildMonthlyReport } = require('./reportBuilder');
const { previousMonth } = require('./dateHelpers');

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')),
  );
  return {
    year: args.ano ? Number(args.ano) : undefined,
    month: args.mes ? Number(args.mes) : undefined,
  };
}

(async () => {
  const api = new VtlogApi({ apiToken: config.vtlog.apiToken });
  const parsed = parseArgs();
  const fallback = previousMonth();
  const year = parsed.year ?? fallback.year;
  const month = parsed.month ?? fallback.month;

  console.log(`Gerando relatório de teste para ${month}/${year}...\n`);
  const report = await buildMonthlyReport(api, { year, month });

  console.log('── Empresa ──────────────────────────');
  console.log(`Nome: ${report.vtcInfo.name}`);
  console.log(`Lucro do mês: $ ${Math.round(report.company.stats.profit).toLocaleString('pt-BR')}`);
  console.log(`Distância: ${Math.round(report.company.stats.distance).toLocaleString('pt-BR')} km`);
  console.log(`Jobs: ${report.company.stats.jobs}`);
  console.log(`Motoristas ativos: ${report.company.activeMembers}/${report.company.totalMembers}`);
  console.log('Ranking global (vtlog):', report.company.globalRank);

  console.log('\n── Top motoristas ───────────────────');
  report.drivers.forEach((d) => {
    console.log(
      `${d.internalRank}. ${d.username} — $${Math.round(d.profit).toLocaleString('pt-BR')} — ${d.jobs} jobs — vtlog: ${d.globalRank ? '#' + d.globalRank.rank : '—'}`,
    );
  });

  process.exit(0);
})().catch((err) => {
  console.error('Erro ao gerar relatório de teste:', err);
  process.exit(1);
});
