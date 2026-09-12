// Teste offline da lógica de ranking/embed, com dados FICTÍCIOS (não chama a API do vtlog
// nem o Discord). Serve pra validar rapidamente qualquer mudança no reportBuilder ou no
// embedBuilder sem gastar chamadas da sua chave de API.
//
// Uso: node tests/offline-logic-test.js   (requer `npm install` já feito)
const path = require('path');
const { buildMonthlyReport } = require(path.join('..', 'src', 'reportBuilder'));
const { buildMonthlyEmbed } = require(path.join('..', 'src', 'embedBuilder'));

const vtcInfo = {
  vtc_id: 8402,
  name: 'Comunidade Eucatur',
  avatar: 'https://uploads.vtlog.net/vtc-avatar/8402-1786753146.png',
};

const members = [
  { steam_id: '76561199754940090', name: 'SP CHEFE 11567', role: 'Presidente' },
  { steam_id: '76561199063101907', name: 'LUiZ - 35488', role: 'Diretores Administrativos' },
  { steam_id: '76561199364979813', name: 'ChoraBoy01 - 37646', role: 'Motorista' },
  { steam_id: '76561198168565976', name: 'LEONEL - 34058', role: 'Diretores Administrativos' },
];

function makeJobs() {
  const jobs = [];
  let jobId = 1000;
  const perDriverJobs = {
    '76561199754940090': 20, // Presidente: bastante atividade
    '76561199063101907': 12,
    '76561199364979813': 5,
    '76561198168565976': 0, // sem jobs no mês -> não deve aparecer no ranking
  };
  for (const [steamId, count] of Object.entries(perDriverJobs)) {
    const member = members.find((m) => m.steam_id === steamId);
    for (let i = 0; i < count; i++) {
      jobs.push({
        job_id: jobId++,
        job_status: 'delivered',
        steam_id: steamId,
        username: member.name,
        vtc_id: 8402,
        profit: Math.round(20000 + Math.random() * 30000),
        distance_client: Math.round(300 + Math.random() * 900),
      });
    }
  }
  // job cancelado: não deve contar na pontuação
  jobs.push({ job_id: jobId++, job_status: 'cancelled', steam_id: '76561199754940090', username: 'SP CHEFE 11567', profit: 999999, distance_client: 9999 });
  return jobs;
}

const jobs = makeJobs();

const fakeApi = {
  async getVtcInfo() { return vtcInfo; },
  async getVtcMembers() { return members; },
  async getVtcStats() {
    const delivered = jobs.filter((j) => j.job_status === 'delivered');
    const totalProfit = delivered.reduce((s, j) => s + j.profit, 0);
    const totalDistance = delivered.reduce((s, j) => s + j.distance_client, 0);
    return { stats: { jobs: delivered.length, distance: totalDistance, fuel: 12345, weight: 987654, income: totalProfit + 5000, expenses: 5000, profit: totalProfit } };
  },
  async getVtcJobsAll() { return jobs; },
  async getVtcGlobalRank() { return { ranked: true, rank: 1, total: 100, percentile: 1 }; },
  async getUserGlobalRank(steamId) {
    const table = {
      '76561199754940090': { ranked: true, rank: 340, total: 15000, percentile: 2.27 },
      '76561199063101907': { ranked: true, rank: 1200, total: 15000, percentile: 8 },
      '76561199364979813': { ranked: false },
    };
    return table[steamId] || { ranked: false };
  },
};

(async () => {
  const report = await buildMonthlyReport(fakeApi, { year: 2026, month: 9 });
  const embed = buildMonthlyEmbed(report);

  console.log('Pré-visualização do embed:\n');
  console.log(`# ${embed.data.title}`);
  console.log(embed.data.description);
  for (const field of embed.data.fields) {
    console.log(`\n## ${field.name}\n${field.value}`);
  }

  const asserts = [
    [report.drivers.length === 3, 'deve ignorar motorista sem jobs no mês (LEONEL)'],
    [report.drivers[0].steamId === '76561199754940090', 'motorista com maior lucro deve ficar em 1º'],
    [report.company.activeMembers === 3, 'activeMembers deve contar só quem entregou job'],
    [report.company.totalMembers === 4, 'totalMembers deve ser o total de membros da VTC'],
    [embed.data.fields.length >= 2, 'embed deve ter pelo menos 2 campos (empresa + ranking)'],
  ];
  console.log('\n--- validações ---');
  let allOk = true;
  for (const [ok, label] of asserts) {
    console.log(`${ok ? 'OK ' : 'FALHOU '}- ${label}`);
    if (!ok) allOk = false;
  }
  process.exit(allOk ? 0 : 1);
})().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
