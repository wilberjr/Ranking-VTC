// Teste offline (temporário, não fica no projeto final) do state.js + painel.
process.env.STATE_FILE_PATH = require('path').join(__dirname, '..', '.tmp-test-state.json');

const { readState, writeState } = require('../src/state');
const { buildPanelEmbed, buildPanelComponents, PANEL_BUTTON_ID } = require('../src/embedBuilder');

const asserts = [];
function assert(cond, label) { asserts.push([cond, label]); }

// 1. estado vazio inicial
const empty = readState();
assert(empty.lastReport === null && empty.panel === null, 'estado inicial deve ser vazio');

// 2. embed do painel sem relatório ainda
const emptyPanelEmbed = buildPanelEmbed(null);
assert(emptyPanelEmbed.data.description.includes('Nenhum resumo'), 'painel vazio deve avisar que não há resumo');

// 3. grava um relatório fake e relê
const fakeReport = {
  vtcInfo: { name: 'Comunidade Eucatur', avatar: 'https://x/avatar.png' },
  period: { year: 2026, month: 9 },
  company: { stats: { profit: 100000, distance: 5000, jobs: 20 }, globalRank: { rank: 1, total: 100, percentile: 1 }, activeMembers: 2, totalMembers: 4 },
  drivers: [
    { internalRank: 1, username: 'Fulano', profit: 60000, distance: 3000, globalRank: { rank: 340 } },
    { internalRank: 2, username: 'Beltrano', profit: 40000, distance: 2000, globalRank: null },
  ],
  metricKey: 'profit',
  generatedAt: new Date().toISOString(),
};

const state = readState();
state.lastReport = fakeReport;
state.panel = { channelId: '111', messageId: '222' };
writeState(state);

const reloaded = readState();
assert(reloaded.lastReport.vtcInfo.name === 'Comunidade Eucatur', 'deve persistir e reler o último relatório');
assert(reloaded.panel.channelId === '111', 'deve persistir e reler o painel ativo');

// 4. embed do painel com relatório
const panelEmbed = buildPanelEmbed(reloaded.lastReport);
assert(panelEmbed.data.title.includes('Painel'), 'painel deve ter título correto');
assert(panelEmbed.data.fields.some((f) => f.name.includes('Empresa')), 'painel deve ter campo de Empresa');
assert(panelEmbed.data.fields.some((f) => f.value.includes('Fulano')), 'painel deve listar motoristas no top 5');

// 5. componentes (botão)
const components = buildPanelComponents();
assert(components.length === 1, 'deve ter 1 linha de componentes');
assert(components[0].components[0].data.custom_id === PANEL_BUTTON_ID, 'botão deve ter o customId esperado');

console.log('--- validações ---');
let allOk = true;
for (const [ok, label] of asserts) {
  console.log(`${ok ? 'OK ' : 'FALHOU '}- ${label}`);
  if (!ok) allOk = false;
}

require('fs').unlinkSync(process.env.STATE_FILE_PATH);
process.exit(allOk ? 0 : 1);
