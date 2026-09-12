# VTLog Discord Bot

Bot que posta, automaticamente todo dia, um quadro com o desempenho da sua VTC no
[VTLog](https://vtlog.net) no **mês em andamento**: lucro e posição da empresa no ranking
global, e o ranking individual dos motoristas (pontuação + posição de cada um no ranking
global do vtlog). Como reporta sempre o mês atual, o quadro vai "crescendo" a cada postagem
diária até fechar o mês.

Validado com a VTC **8402 — Comunidade Eucatur** (board `Realistic`, sub-board `MapaRBR`, mapa `ets2rbr`).

## O que ele faz

- Todo dia (horário configurável), busca os jobs da empresa no vtlog **desde o início do
  mês atual** e calcula:
  - **Empresa**: lucro do mês, km rodados, jobs entregues, motoristas ativos e a posição
    da empresa no ranking global do vtlog (`/v2/ranking/vtcs/{id}`).
  - **Motoristas**: ranking interno por lucro (ou km) no mês, calculado a partir dos jobs
    da empresa, e a posição de cada um no ranking global do vtlog (`/v2/ranking/users/{id}`).
- Posta tudo em um embed no canal do Discord que você configurar.
- Também tem um **painel fixo** (`/painel`) com um botão pra gerar o resumo na hora, e
  três comandos (`/relatorio`, `/painel`, `/status`) — veja a seção **Comandos** abaixo.
- **Todos os comandos podem ser usados por qualquer pessoa do servidor** (não é
  preciso ser admin).

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

## 4. Registrar os comandos (`/relatorio`, `/painel`, `/status`)

```bash
npm run deploy-commands
```

Precisa rodar de novo sempre que adicionar ou mudar as opções de algum comando —
não é preciso mexer em nada no Discord Developer Portal pra isso, é só rodar esse
script de novo (veja a seção **"Preciso mexer no Discord ou no Railway?"** no fim
deste README).

## 5. Rodar o bot

```bash
npm start
```

Isso conecta o bot ao Discord e agenda a postagem automática (`REPORT_CRON` no `.env`,
padrão: todo dia às 09:00, fuso `America/Sao_Paulo`, sempre reportando o mês atual em andamento).

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

## Comandos

Todos abertos a **qualquer pessoa do servidor** (sem checagem de permissão no código).

- **`/relatorio [mes] [ano]`** — gera o quadro completo agora mesmo e posta a resposta
  no canal onde o comando foi usado. Sem `mes`/`ano`, usa o mês atual em andamento.
- **`/painel`** — cria o painel de controle **no canal onde foi usado**. Se já existir
  um painel ativo (em qualquer canal), a mensagem antiga é apagada e uma nova é criada
  — é o comando de "recriar o painel a qualquer momento" que você pediu.
- **`/status`** — mostra informações de diagnóstico: agendamento (cron/fuso), canal
  padrão, métrica de ranking, quando foi o último resumo gerado, se há um painel ativo
  e se tem uma geração em andamento no momento.

### O painel

O painel (`/painel`) é uma mensagem fixa com:

- Um resumo compacto do **último resumo gerado** (lucro, ranking global da empresa e o
  top 5 de motoristas) — atualizado automaticamente toda vez que qualquer relatório é
  gerado, seja pela postagem automática diária, pelo `/relatorio` ou pelo próprio botão.
- Um botão **"📊 Enviar resumo agora"**: qualquer pessoa pode clicar pra gerar o quadro
  na hora — ele é postado como uma nova mensagem no canal, e o painel é atualizado com
  esse novo resumo.

Só uma geração de relatório roda por vez: se alguém clicar no botão (ou usar `/relatorio`)
enquanto outra já está em andamento, a pessoa recebe um aviso pra tentar de novo em
alguns instantes — isso evita chamadas duplicadas na API do vtlog e mensagens repetidas.

## Ajustando o quadro

Tudo isso é configurável no `.env`, sem mexer no código:

- `VTLOG_RANKING_TYPE`: `profit` (lucro, padrão) ou `distance` (km rodados).
- `REPORT_TOP_N`: quantos motoristas aparecem no ranking individual (padrão 15).
- `REPORT_CRON` / `VTLOG_TIMEZONE`: quando a postagem automática acontece. Exemplos:
  - `0 9 * * *` → todo dia às 09:00 (padrão, ~24h de intervalo)
  - `0 9,21 * * *` → duas vezes por dia, 09:00 e 21:00
  - `0 */12 * * *` → a cada 12 horas
  - `0 9 1 * *` → só no dia 1 de cada mês (volta ao comportamento "mensal")
- `VTLOG_MAP`: mapa usado pra filtrar os jobs no ranking interno (padrão `ets2rbr`,
  o mesmo mapa da MapaRBR). Deixe `VTLOG_MAP=` vazio se não quiser filtrar por mapa.

## Persistência (o "último resumo" e o painel ativo)

O bot salva duas coisas em disco, em `data/state.json` (caminho configurável via
`STATE_FILE_PATH` no `.env`):

- o **último relatório gerado** (pra o painel poder mostrá-lo sem precisar chamar a
  API de novo toda hora), e
- **qual mensagem é o painel ativo** (canal + ID da mensagem), pra saber o que editar
  quando um novo resumo é gerado.

Isso é só um arquivo JSON local — não precisa de banco de dados. Mas repare: se o
disco onde o bot roda for **efêmero** (apagado a cada novo deploy), esse arquivo some
e o bot "esquece" o último resumo e o painel ativo — nesse caso é só rodar `/painel`
de novo depois de cada deploy. Isso é bem relevante se você for hospedar no Railway;
veja a seção logo abaixo.

## Preciso mexer no Discord ou no Railway depois disso?

**No Discord Developer Portal: não.** Os comandos novos (`/painel`, `/status`) e o
botão do painel usam exatamente as mesmas permissões que você já configurou (`bot` +
`applications.commands`, `Send Messages`, `Embed Links`) — não precisa reconvidar o
bot nem mudar nada na aplicação. A única coisa que você precisa **rodar** (não é uma
mudança no portal, é um comando) é o passo 4 de novo, sempre que adicionar/mudar
comandos:

```bash
npm run deploy-commands
```

**No Railway: só um detalhe de armazenamento, se quiser o painel 100% resiliente.**
Por padrão, o sistema de arquivos de um serviço no Railway é recriado do zero a cada
novo deploy (variáveis de ambiente continuam, mas arquivos gravados em disco, como o
nosso `data/state.json`, não sobrevivem). Efeito prático: depois de cada `git push`/
redeploy, o bot volta a não saber qual é "o último resumo" nem qual mensagem é o
painel, até você rodar `/painel` de novo (e o próximo resumo, automático ou manual,
repopula o estado). Isso **não quebra o bot**, só reseta esses dois dados.

Se quiser que isso sobreviva aos redeploys, adicione um **Volume** no Railway:

1. No serviço do bot, aba **Volumes** → **New Volume**.
2. Monte em, por exemplo, `/data`.
3. No `.env` (ou nas variáveis do serviço no Railway), defina:
   ```
   STATE_FILE_PATH=/data/state.json
   ```
4. Redeploy uma vez — a partir daí o arquivo persiste entre deploys.

Fora isso, nenhuma outra configuração do Railway muda: mesmas variáveis de ambiente
de antes (`DISCORD_TOKEN`, `VTLOG_API_TOKEN` etc.), mesmo comando de start (`npm start`).

## Segurança

O `VTLOG_API_TOKEN` dá acesso de leitura a dados sensíveis da empresa (saldo bancário,
lista de membros com Steam ID, histórico financeiro completo). Trate-o como uma senha:
nunca comite o `.env` (já está no `.gitignore`) nem cole o token em lugares públicos.

Como todos os comandos agora são abertos a qualquer pessoa do servidor, qualquer membro
pode disparar a geração do relatório (via `/relatorio` ou o botão do painel). Isso é
seguro pros dados em si (ninguém vê nada que não apareça no próprio quadro), mas vale
lembrar que cada geração consome chamadas da sua chave de API — o limite de 10/min do
vtlog e o "lock" que impede gerações simultâneas (ver seção **Comandos**) já protegem
contra abuso. Se um dia quiser restringir algum comando a cargos específicos, dá pra
fazer isso direto no Discord (Configurações do servidor → Integrações → nome do bot →
permissões por comando), sem precisar mudar o código.

## Estrutura do projeto

```
src/
  config.js                    lê e valida o .env
  apiClient.js                 instância ÚNICA e compartilhada do cliente vtlog
  vtlogApi.js                  cliente HTTP pra api.vtlog.net (fila/rate limit)
  reportBuilder.js             monta os dados do quadro (empresa + motoristas)
  reportService.js             gera o relatório + salva como "último resumo" (com lock)
  state.js                     lê/grava data/state.json (último resumo + painel ativo)
  embedBuilder.js               monta os embeds (quadro completo e painel) + botão
  dateHelpers.js                utilitário de datas (mês atual / mês anterior)
  index.js                      bot: login, cron, comandos e o painel
  testReport.js                  roda o relatório no terminal, sem postar no Discord
  commands/deploy-commands.js   registra os slash commands
tests/
  offline-logic-test.js        testa reportBuilder/embed com dados fictícios (sem rede)
  panel-and-state-test.js      testa state.js + o embed/botão do painel (sem rede)
```
