require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs');

const commands = [];
// core commands
commands.push({ name: 'start', description: 'Register an account with the One Piece bot' });
commands.push({ name: 'pull', description: 'Pull a random card' });
commands.push({
  name: 'card',
  description: 'Display a card\'s information and stats',
  options: [{ name: 'query', type: 3, description: 'Partial or full card name', required: true }]
});
commands.push({
  name: 'info',
  description: 'Show ownership info for a card',
  options: [{ name: 'query', type: 3, description: 'Partial or full card name', required: true }]
});

// balance command
commands.push({
  name: 'balance',
  description: "Show your current Beli and reset tokens",
  options: [{ name: 'target', type: 6, description: 'User to view (optional)', required: false }]
});

// team management (view/add/remove) - active team limited to 3 cards
commands.push({
  name: 'team',
  description: 'Manage your active team',
  options: [
    { name: 'view', type: 1, description: 'View your current team', options: [{ name: 'target', type: 6, description: 'User to view (optional)', required: false }] },
    { name: 'add', type: 1, description: 'Add a card to your team', options: [{ name: 'query', type: 3, description: 'Card name', required: true }] },
    { name: 'remove', type: 1, description: 'Remove a card from your team', options: [{ name: 'query', type: 3, description: 'Card name', required: true }] }
  ]
});

// inventory lookup
commands.push({ name: 'inventory', description: 'Show your items and packs', options: [{ name: 'target', type: 6, description: 'User to view (optional)', required: false }] });

// autoteam command
commands.push({ name: 'autoteam', description: 'Automatically set your team to top 3 cards' });

// sell command
commands.push({
  name: 'sell',
  description: 'Sell a card or leveler for currency',
  options: [{ name: 'query', type: 3, description: 'Card or item name', required: true }]
});
commands.push({
  name: 'bulksell',
  description: 'Sell multiple cards or levelers at once',
  options: [{ name: 'query', type: 3, description: 'List of items to sell, e.g. "Monkey D. Luffy - 10, Yellow Hermit - 17"', required: true }]
});
commands.push({
  name: 'claim',
  description: 'Claim earnings from your active ship',
  options: [{ name: 'amount', type: 4, description: 'Amount to claim (leave blank for all)', required: false }]
});

// infinite sail battle
commands.push({ name: 'isail', description: 'Challenge the Infinite Sail' });
// Story Mode sail command
commands.push({ name: 'sail', description: 'Begin the Story Mode sailing adventure' });

// duel command
commands.push({
  name: 'duel',
  description: 'Challenge another player to a team duel',
  options: [{ name: 'opponent', type: 6, description: 'User to duel (optional)', required: false }]
});

// shop & economy
commands.push({ name: 'shop', description: 'View the shop' });
commands.push({
  name: 'buy',
  description: 'Buy an item from the shop',
  options: [{ name: 'item', type: 3, description: 'Item name', required: true }]
});
commands.push({
  name: 'bet',
  description: 'Flip a coin and bet Beli on heads or tails',
  options: [
    { name: 'guess', type: 3, description: 'Choose heads or tails', required: true, choices: [
      { name: 'heads', value: 'heads' },
      { name: 'tails', value: 'tails' }
    ] },
    { name: 'amount', type: 4, description: 'Amount of Beli to bet (minimum 100)', required: false, min_value: 100 }
  ]
});
commands.push({
  name: 'equip',
  description: 'Equip an artifact to one of its signature cards',
  options: [
    { name: 'artifact', type: 3, description: 'Artifact name', required: true },
    { name: 'card', type: 3, description: 'Card to equip the artifact to', required: true }
  ]
});
commands.push({
  name: 'unequip',
  description: 'Unequip an artifact from its current card',
  options: [{ name: 'artifact', type: 3, description: 'Artifact name', required: true }]
});

// bounty system
commands.push({ name: 'bounty', description: 'Find a random player to duel for bounty' });

// profile & leaderboards
commands.push({
  name: 'user',
  description: 'View a user\'s profile',
  options: [{ name: 'target', type: 6, description: 'User to view (optional)', required: false }]
});
commands.push({
  name: 'leaderboard',
  description: 'View global leaderboards',
  options: [
    {
      name: 'category',
      type: 3,
      description: 'Leaderboard category',
      required: false,
      choices: [
        { name: 'Wealth', value: 'wealth' },
        { name: 'Bounty', value: 'bounty' },
        { name: 'Dex', value: 'dex' }
      ]
    }
  ]
});
commands.push({
  name: 'teambackground',
  description: 'Set your custom team background image',
  options: [
    {
      name: 'add',
      type: 1,
      description: 'Add or update your team background URL',
      options: [
        { name: 'url', type: 3, description: 'Image URL for your team background', required: true }
      ]
    }
  ]
});
commands.push({ name: 'daily', description: 'Claim your OP daily rewards' });

// wanted poster command
commands.push({
  name: 'wanted',
  description: 'Generate a wanted poster for a user',
  options: [
    { name: 'target', type: 6, description: 'User to create poster for', required: false },
    { name: 'bounty', type: 3, description: 'Bounty amount to display (overrides stored bounty)', required: false }
  ]
});

// pack system
commands.push({ name: 'stock', description: 'View current pack stock' });
commands.push({
  name: 'open',
  description: 'Open a pack or chest to get cards or rewards',
  options: [
    { name: 'pack', type: 3, description: 'Pack or chest name', required: true },
    { name: 'amount', type: 4, description: 'Amount to open (only supported for chests)', required: false }
  ]
});
commands.push({ name: 'setship', description: 'Set your active ship for passive income', options: [{ name: 'ship', type: 3, description: 'Ship name', required: true }] });
// Fuel a ship using a Cola item
commands.push({ name: 'fuel', description: 'Fuel a ship by consuming a Cola item', options: [{ name: 'ship', type: 3, description: 'Ship name (optional)', required: false }] });
commands.push({ name: 'deposit', description: 'Deposit Beli into your active ship', options: [{ name: 'amount', type: 4, description: 'Amount of Beli to deposit', required: true }] });
commands.push({ name: 'loot', description: 'Attempt to loot a random guild ship for Beli and packs' });
commands.push({ name: 'trivia', description: 'Start a trivia quiz for rewards' });
commands.push({ name: 'rob', description: 'Attempt to rob a user', options: [{ name: 'target', type: 6, description: 'User to rob', required: true }] });
commands.push({ name: 'stoprob', description: 'Stop an active robbery against you' });
commands.push({ name: 'forfeit', description: 'Forfeit your current duel or isail battle' });
commands.push({ name: 'collection', description: 'View your card collection' });

// timers command
commands.push({ name: 'timers', description: 'View global stock and pull reset timers' });

// fishing and leveling
commands.push({ name: 'fish', description: 'Go fishing for levelers and cards' });
commands.push({
  name: 'feed',
  description: 'Feed a leveler to a card to level it up',
  options: [
    { name: 'leveler', type: 3, description: 'Leveler item name', required: true },
    { name: 'card', type: 3, description: 'Card name', required: true },
    { name: 'amount', type: 4, description: 'Amount to feed (default 1)', required: false }
  ]
});

// help command
commands.push({ name: 'help', description: 'View all available commands organized by category' });

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
const rest = new REST({ version: '10' }).setToken(token);

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // dev guild

async function deploy() {
  try {
    if (!clientId || !guildId) return console.log('CLIENT_ID and GUILD_ID must be set in .env');
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

deploy();
