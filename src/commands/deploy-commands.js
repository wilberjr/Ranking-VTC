// Registra os slash commands no servidor configurado.
// Rode sempre que adicionar/mudar as opções de algum comando: npm run deploy-commands
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../config');

// Nenhum comando abaixo usa .setDefaultMemberPermissions(...), então por padrão
// TODOS os membros do servidor podem usá-los (é assim que foi pedido). Pra
// restringir algum no futuro sem mexer no código: Configurações do servidor →
// Integrações → nome do bot → permissões por comando.
const commands = [
  new SlashCommandBuilder()
    .setName('relatorio')
    .setDescription('Gera o quadro (empresa + motoristas) sob demanda, agora mesmo.')
    .addIntegerOption((opt) => opt.setName('mes').setDescription('Mês (1-12). Padrão: mês atual.').setMinValue(1).setMaxValue(12))
    .addIntegerOption((opt) => opt.setName('ano').setDescription('Ano (ex: 2026). Padrão: mês atual.').setMinValue(2016))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Cria (ou recria) o painel de controle fixo neste canal.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mostra o status do bot: agendamento, último resumo, painel ativo etc.')
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log('Registrando slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands },
    );
    console.log(`✅ Comandos registrados com sucesso: ${commands.map((c) => '/' + c.name).join(', ')}`);
  } catch (err) {
    console.error('❌ Falha ao registrar comandos:', err);
    process.exit(1);
  }
})();
