const User = require('../models/User');
const { EmbedBuilder } = require('discord.js');
const crews = require('../data/crews');
const { chests, getChestById } = require('../data/chests');

const CHEST_NAMES = Object.fromEntries(chests.map(chest => [chest.id, chest.name]));
const CHEST_EMOJIS = Object.fromEntries(chests.map(chest => [chest.id, chest.emoji]));

const DAILY_REWARDS = {
  1: {
    beli: [10, 100],
    gems: [0, 1],
    packs: [{ rank: 'C', count: 1 }],
    chests: [{ id: 'c_chest', chance: 0.5, count: 1 }]
  },
  2: {
    beli: [50, 250],
    gems: [1, 2],
    packs: [{ rank: 'C', count: 2 }],
    chests: [{ id: 'c_chest', chance: 1, count: 1 }]
  },
  3: {
    beli: [100, 300],
    gems: [1, 3],
    packs: [{ rank: 'C', count: 2 }, { rank: 'B', count: 1 }],
    chests: [{ id: 'b_chest', chance: 0.5, count: 1, exclusive: true }, { id: 'c_chest', chance: 0.5, count: 1, exclusive: true }]
  },
  4: {
    beli: [250, 500],
    gems: [2, 3],
    packs: [{ rank: 'B', count: 2 }, { rank: 'A', count: 0.3 }],
    chests: [{ id: 'b_chest', chance: 1, count: 1 }]
  },
  5: {
    beli: [500, 1000],
    gems: [3, 5],
    packs: [{ rank: 'B', count: 2 }, { rank: 'A', count: 1 }, { rank: 'S', count: 0.3 }],
    chests: [{ id: 'b_chest', chance: 0.5, count: 1, exclusive: true }, { id: 'a_chest', chance: 0.5, count: 1, exclusive: true }]
  }
};

// Map pack ranks to crew ranks
const PACK_TO_CREW_RANK = {
  'C': 'D',
  'B': 'A',
  'A': 'A',
  'S': 'S'
};

function getRandomCrewByRank(rank) {
  const crewRank = PACK_TO_CREW_RANK[rank];
  const availableCrews = crews.filter(c => c.rank === crewRank);
  if (availableCrews.length === 0) return null;
  return availableCrews[Math.floor(Math.random() * availableCrews.length)];
}

function chooseExclusiveChest(chestOptions) {
  const options = chestOptions.filter(c => c.exclusive);
  if (!options.length) return null;
  const totalWeight = options.reduce((sum, option) => sum + option.chance, 0);
  let roll = Math.random() * totalWeight;
  for (const option of options) {
    if (roll < option.chance) return option;
    roll -= option.chance;
  }
  return options[options.length - 1];
}

function getStreakString(streak) {
  const filled = '★'.repeat(streak);
  const empty = '☆'.repeat(5 - streak);
  return filled + empty;
}

module.exports = {
  name: 'daily',
  description: 'Claim your daily rewards',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const discordUser = message ? message.author : interaction.user;

    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    user.packInventory = user.packInventory || {};
    user.dailyStreak = typeof user.dailyStreak === 'number' ? user.dailyStreak : 0;

    const now = new Date();
    const lastDaily = user.lastDaily ? new Date(user.lastDaily) : null;
    const timeSinceLast = lastDaily ? now - lastDaily : null;

    // Check if can claim
    if (lastDaily && timeSinceLast < 24 * 60 * 60 * 1000) {
      const remainingMs = 24 * 60 * 60 * 1000 - timeSinceLast;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const reply = `You can claim your daily reward in \`${hours}h ${minutes}m\`.`;
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Calculate streak
    let newStreak = 1;
    if (lastDaily && timeSinceLast < 48 * 60 * 60 * 1000) {
      // Within 48 hours, continue streak
      newStreak = user.dailyStreak + 1;
    }
    // Cap at 5
    if (newStreak > 5) newStreak = 5;

    const rewards = DAILY_REWARDS[newStreak];

    // Calculate rewards
    const beliReward = Math.floor(Math.random() * (rewards.beli[1] - rewards.beli[0] + 1)) + rewards.beli[0];
    const gemsReward = Math.floor(Math.random() * (rewards.gems[1] - rewards.gems[0] + 1)) + rewards.gems[0];

    let packRewards = [];
    for (const pack of rewards.packs) {
      let count = pack.count;
      if (count < 1) {
        // Chance
        if (Math.random() < count) count = 1;
        else count = 0;
      }
      for (let i = 0; i < Math.floor(count); i++) {
        const crew = getRandomCrewByRank(pack.rank);
        if (crew) {
          packRewards.push({ name: crew.name, emoji: crew.icon || '' });
          user.packInventory[crew.name] = (user.packInventory[crew.name] || 0) + 1;
        }
      }
    }

    const chestRewards = [];
    user.items = user.items || [];
    const exclusiveChoice = chooseExclusiveChest(rewards.chests || []);
    if (exclusiveChoice) {
      const chestDef = getChestById(exclusiveChoice.id);
      const existingChest = user.items.find(it => it.itemId === exclusiveChoice.id);
      if (existingChest) {
        existingChest.quantity += exclusiveChoice.count;
      } else {
        user.items.push({ itemId: exclusiveChoice.id, quantity: exclusiveChoice.count });
      }
      chestRewards.push({ count: exclusiveChoice.count, emoji: chestDef ? chestDef.emoji : '', name: chestDef ? chestDef.name : exclusiveChoice.id });
    } else {
      for (const chest of rewards.chests || []) {
        if (chest.exclusive) continue;
        if (Math.random() < chest.chance) {
          const chestDef = getChestById(chest.id);
          const existingChest = user.items.find(it => it.itemId === chest.id);
          if (existingChest) {
            existingChest.quantity += chest.count;
          } else {
            user.items.push({ itemId: chest.id, quantity: chest.count });
          }
          chestRewards.push({ count: chest.count, emoji: chestDef ? chestDef.emoji : '', name: chestDef ? chestDef.name : chest.id });
        }
      }
    }
    if (chestRewards.length > 0) {
      user.markModified('items');
    }

    // Apply rewards
    user.balance += beliReward;
    user.gems += gemsReward;
    user.lastDaily = now;
    user.dailyStreak = newStreak;
    // schedule a one-time DM reminder 24h from now
    user.nextDailyReminder = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    user.markModified('packInventory');
    await user.save();

    // Calculate time until next claim
    const nextClaimTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextRemainingMs = nextClaimTime.getTime() - Date.now();
    const nextHours = Math.floor(nextRemainingMs / (1000 * 60 * 60));
    const nextMinutes = Math.floor((nextRemainingMs % (1000 * 60 * 60)) / (1000 * 60));

    // Emoji constants
    const nextEmoji = '<:next:1489374606916714706>';
    const beliIcon = '<:beri:1490738445319016651>';
    const gemIcon = '<:gem:1490741488081043577>';
    // Format pack rewards
    let packLines = [];
    if (packRewards.length > 0) {
      for (const pack of packRewards) {
        const emoji = pack && pack.emoji ? `${pack.emoji} ` : '';
        packLines.push(`${emoji}1x ${pack.name.toLowerCase()} pack`);
      }
    }

    // Consolidate rewards into lines with emoji + amount + label
    const rewardLines = [];
    rewardLines.push(`${beliIcon} ${beliReward} Beli`);
    rewardLines.push(`${gemIcon} ${gemsReward}x gems`);
    if (packLines.length > 0) rewardLines.push(...packLines);
    if (chestRewards.length > 0) {
      for (const c of chestRewards) {
        rewardLines.push(`${c.emoji} ${c.count}x ${c.name}`.trim());
      }
    }

    const fields = [ { name: 'Rewards', value: rewardLines.join('\n'), inline: false } ];

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setTitle('Daily rewards claimed!')
      .setDescription(`**Streak**: ${getStreakString(newStreak)}\n-# come back in \`${nextHours}h ${nextMinutes}m\` for more rewards.`)
      .addFields(fields)
      .setAuthor({ name: discordUser.username, iconURL: discordUser.displayAvatarURL() });

    if (message) return message.channel.send({ embeds: [embed] });
    return interaction.reply({ embeds: [embed] });
  }
};