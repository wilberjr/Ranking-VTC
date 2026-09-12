// Registra o slash command /relatorio no servidor configurado.
// Rode uma vez (ou toda vez que mudar as opções do comando): npm run deploy-commands
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../config');

const commands = [
  new SlashCommandBuilder()
    .setName('relatorio')
    .setDescription('Gera o quadro mensal (empresa + motoristas) sob demanda.')
    .addIntegerOption((opt) => opt.setName('mes').setDescription('Mês (1-12). Padrão: mês anterior.').setMinValue(1).setMaxValue(12))
    .addIntegerOption((opt) => opt.setName('ano').setDescription('Ano (ex: 2026). Padrão: mês anterior.').setMinValue(2016))
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
    console.log('✅ Comando /relatorio registrado com sucesso no servidor configurado.');
  } catch (err) {
    console.error('❌ Falha ao registrar comandos:', err);
    process.exit(1);
  }
})();
