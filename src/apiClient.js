// Instância ÚNICA e compartilhada do cliente da API do vtlog.
// Importante: toda chamada à API (cron, /relatorio, painel, etc.) deve passar
// por essa mesma instância, porque é ela quem enfileira as requisições pra
// respeitar o rate limit da API (10/min). Duas instâncias em paralelo
// furariam esse controle.
const config = require('./config');
const VtlogApi = require('./vtlogApi');

const api = new VtlogApi({ apiToken: config.vtlog.apiToken });

module.exports = api;
