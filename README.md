# VTLog Discord Bot

Bot que posta, automaticamente todo mês, um quadro com o desempenho da sua VTC no
[VTLog](https://vtlog.net): lucro e posição da empresa no ranking global, e o ranking
individual dos motoristas (pontuação + posição de cada um no ranking global do vtlog).

Validado com a VTC **8402 — Comunidade Eucatur** (board `Realistic`, sub-board `MapaRBR`, mapa `ets2rbr`).

## O que ele faz

- Todo início de mês (configurável), busca os jobs da empresa no vtlog e calcula:
  - **Empresa**: lucro do mês, km rodados, jobs entregues, motoristas ativos e a posição
    da empresa no ranking global do vtlog (`/v2/ranking/vtcs/{id}`).
  - **Motoristas**: ranking interno por lucro (ou km) no mês, calculado a partir dos jobs
    da empresa, e a posição de cada um no ranking global do vtlog (`/v2/ranking/users/{id}`).
- Posta tudo em um embed no canal do Discord que você configurar.
- Também expõe um comando `/relatorio` (opcional, restrito a quem pode "Gerenciar Servidor")
  pra gerar o mesmo quadro sob demanda, inclusive de meses passados.

## 1. Criar a aplicação/bot no Discord

1. Acesse https://discord.com/developers/applications e clique em **New Application**.
2. Dê um nome (ex: "VTLog Bot") e crie.
3. No menu lateral, vá em **Bot** → **Reset Token** → copie o token gerado.
   Esse é o valor de `DISCORD_TOKEN` no `.env`. **Nunca compartilhe esse token.**
4. Ainda em **Bot**, não precisa marcar nenhum "Privileged Gateway Intent" — o bot não
   precisa ler mensagens nem ver membros, só postar no canal.
5. Em **General Information**, copie o **Application ID** → é o `DISCORD_CLIENT_ID`.
6. Vá em **OAuth2 → URL Generator**:
   - Em **Scopes**, marque `bot` e `applications.commands`.
   - Em **Bot Permissions**, marque `Send Messages` e `Embed Links` (e `Use Slash Commands`
     já vem coberto pelo scope `applications.commands`).
   - Copie a URL gerada, abra no navegador e adicione o bot ao seu servidor.
7. Com o "Modo desenvolvedor" ativado no Discord (Configurações → Avançado), clique com o
   botão direito no seu servidor → **Copiar ID do Servidor** → é o `DISCORD_GUILD_ID`.
8. Clique com o botão direito no canal onde o quadro mensal deve ser postado →
   **Copiar ID do Canal** → é o `DISCORD_REPORT_CHANNEL_ID`.

## 2. Configurar

```bash
cp .env.example .env
```

Edite o `.env` e preencha:

- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DISCORD_REPORT_CHANNEL_ID`
  (do passo 1).
- `VTLOG_API_TOKEN` — o token de API gerado em `vtlog.net` → sua VTC → **Staff → API**.
- `VTLOG_VTC_ID` — já vem `8402`, ajuste se for usar em outra VTC.
- As demais (`VTLOG_GAME`, `VTLOG_RANKING_BOARD`, `VTLOG_RANKING_SUBBOARD`, `VTLOG_MAP`)
  já vêm com os valores certos pra Comunidade Eucatur.

## 3. Instalar e testar

```bash
npm install

# Testa a lógica de ranking com dados fictícios, sem chamar a API nem o Discord:
npm run test-logic

# Testa com dados REAIS da sua VTC, imprime no terminal (não posta no Discord):
npm run test-report
# opcionalmente um mês específico:
node src/testReport.js --mes=8 --ano=2026
```

> A API v2 do vtlog limita a 10 requisições/minuto por chave. Gerar o relatório faz uma
> chamada por motorista do "top N" pra buscar a posição global de cada um, então
> `test-report`/a postagem mensal podem levar alguns minutos numa empresa grande — é
> esperado, o bot já respeita esse limite automaticamente (e re-tenta sozinho se receber
> um 429).

## 4. Registrar o comando `/relatorio` (opcional)

```bash
npm run deploy-commands
```

Precisa rodar de novo só se você alterar as opções do comando no futuro.

## 5. Rodar o bot

```bash
npm start
```

Isso conecta o bot ao Discord e agenda a postagem automática (`REPORT_CRON` no `.env`,
padrão: dia 1 de cada mês às 09:00, fuso `America/Sao_Paulo`, reportando o mês anterior).

### Deixar rodando 24/7 num VPS

Recomendo o [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start src/index.js --name vtlog-bot
pm2 save
pm2 startup   # segue as instruções impressas pra iniciar com o servidor
```

Ou, com systemd, crie `/etc/systemd/system/vtlog-bot.service`:

```ini
[Unit]
Description=VTLog Discord Bot
After=network.target

[Service]
WorkingDirectory=/caminho/para/vtlog-discord-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
User=seu-usuario

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now vtlog-bot
```

## Ajustando o quadro

Tudo isso é configurável no `.env`, sem mexer no código:

- `VTLOG_RANKING_TYPE`: `profit` (lucro, padrão) ou `distance` (km rodados).
- `REPORT_TOP_N`: quantos motoristas aparecem no ranking individual (padrão 15).
- `REPORT_CRON` / `VTLOG_TIMEZONE`: quando a postagem automática acontece.
- `VTLOG_MAP`: mapa usado pra filtrar os jobs no ranking interno (padrão `ets2rbr`,
  o mesmo mapa da MapaRBR). Deixe `VTLOG_MAP=` vazio se não quiser filtrar por mapa.

## Segurança

O `VTLOG_API_TOKEN` dá acesso de leitura a dados sensíveis da empresa (saldo bancário,
lista de membros com Steam ID, histórico financeiro completo). Trate-o como uma senha:
nunca comite o `.env` (já está no `.gitignore`) nem cole o token em lugares públicos.

## Estrutura do projeto

```
src/
  config.js              lê e valida o .env
  vtlogApi.js             cliente HTTP pra api.vtlog.net (com fila/rate limit)
  reportBuilder.js         monta os dados do quadro mensal
  embedBuilder.js          monta o embed do Discord
  dateHelpers.js           utilitário de datas (mês anterior)
  index.js                 bot: login, agendamento (cron) e comando /relatorio
  testReport.js            roda o relatório no terminal, sem postar no Discord
  commands/deploy-commands.js  registra o slash command /relatorio
tests/
  offline-logic-test.js    testa a lógica com dados fictícios (sem rede)
```
