require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

async function list() {
  const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;
  if (!token || !clientId || !guildId) return console.error('TOKEN, CLIENT_ID and GUILD_ID required in .env');
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    const cmds = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
    console.log('Guild commands:', JSON.stringify(cmds, null, 2));
  } catch (err) {
    console.error('Failed to list commands:', err);
  }
}

list();
