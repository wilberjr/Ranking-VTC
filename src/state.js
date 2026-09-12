const fs = require('fs');
const path = require('path');

const STATE_FILE = process.env.STATE_FILE_PATH || path.join(process.cwd(), 'data', 'state.json');

const DEFAULT_STATE = {
  lastReport: null, // último relatório gerado (dados completos), + generatedAt
  panel: null, // { channelId, messageId } do painel ativo, se houver
};

/**
 * Lê o estado persistido em disco (último relatório + painel ativo).
 * Se o arquivo não existir ou estiver corrompido, retorna o estado padrão
 * (o bot continua funcionando normalmente, só sem histórico prévio).
 */
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULT_STATE };
  }
}

/** Grava o estado em disco (cria a pasta se precisar). */
function writeState(state) {
  const dir = path.dirname(STATE_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = { readState, writeState, STATE_FILE };
