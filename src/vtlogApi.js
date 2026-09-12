const axios = require('axios');
const config = require('./config');

/**
 * Cliente para a API pública do VTLog (https://api.vtlog.net).
 *
 * A API v2 aplica rate limit por chave (padrão 10 requisições/minuto).
 * Para não estourar o limite durante a geração do relatório mensal
 * (que pode fazer dezenas de chamadas), todas as requisições passam por
 * uma fila sequencial com espaçamento mínimo entre elas, e qualquer 429
 * é resolvido esperando o tempo indicado em `Retry-After` e tentando de novo.
 */
class VtlogApi {
  constructor({ apiToken, baseUrl = config.vtlog.apiBaseUrl, minIntervalMs = 6500 } = {}) {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
    this.minIntervalMs = minIntervalMs;
    this._queue = Promise.resolve();
    this._lastRequestAt = 0;
  }

  _enqueue(task) {
    const run = () => this._throttledRun(task);
    this._queue = this._queue.then(run, run);
    return this._queue;
  }

  async _throttledRun(task) {
    const wait = this._lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    try {
      return await task();
    } finally {
      this._lastRequestAt = Date.now();
    }
  }

  /**
   * GET autenticado em api.vtlog.net, com retry automático em 429.
   * @param {string} path caminho começando com /v2/... ou /v1/...
   * @param {object} params query params
   */
  get(path, params = {}) {
    return this._enqueue(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await axios.get(`${this.baseUrl}${path}`, {
            params,
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              Accept: 'application/json',
            },
            timeout: 15000,
            validateStatus: () => true,
          });

          if (res.status === 429) {
            const retryAfter = Number(res.headers['retry-after'] || 5);
            console.warn(`[vtlogApi] 429 rate limited em ${path}, aguardando ${retryAfter}s...`);
            await sleep((retryAfter + 1) * 1000);
            continue;
          }

          if (res.status >= 400) {
            const message = (res.data && (res.data.error || res.data.message)) || res.statusText;
            const err = new Error(`VTLog API ${res.status} em ${path}: ${message}`);
            err.status = res.status;
            err.path = path;
            throw err;
          }

          return res.data;
        } catch (err) {
          if (err.status) throw err; // erro HTTP já tratado acima
          if (attempt === 2) throw err; // erro de rede esgotou tentativas
          await sleep(2000);
        }
      }
      throw new Error(`Falha ao chamar ${path} após múltiplas tentativas`);
    });
  }

  // ── Endpoints usados pelo relatório mensal ────────────────────────────

  getVtcInfo(vtcId) {
    return this.get(`/v2/vtc/${vtcId}`);
  }

  getVtcMembers(vtcId) {
    return this.get(`/v2/vtc/${vtcId}/members`);
  }

  /** Estatísticas agregadas da empresa (opcionalmente filtradas por ano/mês). */
  getVtcStats(vtcId, { year, month, game, board } = {}) {
    return this.get(`/v2/vtc/${vtcId}/stats`, { year, month, game, board });
  }

  /** Todos os jobs da empresa no período (usado para montar o ranking interno). */
  getVtcJobsAll(vtcId, { year, month, game, board, map } = {}) {
    return this.get(`/v2/vtc/${vtcId}/jobs/all`, { year, month, game, board, map });
  }

  /** Posição e pontuação da EMPRESA no ranking global do vtlog. */
  getVtcGlobalRank(vtcId, { game, board, subBoard, type, dateType = 'm', year, month } = {}) {
    return this.get(`/v2/ranking/vtcs/${vtcId}`, {
      game,
      board,
      sub_board: subBoard,
      type,
      date_type: dateType,
      year,
      month,
    });
  }

  /** Posição e pontuação de UM MOTORISTA no ranking global do vtlog. */
  getUserGlobalRank(steamId, { game, board, subBoard, type, dateType = 'm', year, month } = {}) {
    return this.get(`/v2/ranking/users/${steamId}`, {
      game,
      board,
      sub_board: subBoard,
      type,
      date_type: dateType,
      year,
      month,
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = VtlogApi;
