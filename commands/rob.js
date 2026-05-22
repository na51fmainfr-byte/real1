const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const pendingRobberies = new Map();

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatRelativeTime(futureDate) {
  const now = new Date();
  const diff = futureDate - now;
  if (diff <= 0) return 'now';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.ceil((diff % (60 * 1000)) / 1000);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getTargetServerLine(targetUser, guild) {
  if (!guild) return null;
  const member = guild.members?.cache?.get(targetUser.id);
  if (!member) return null;
  return `<:next:1489374606916714706> **Server:** ${guild.name}`;
}

async function sendRobberDM(targetUser, robberName, guild) {
  const descriptionLines = [
    '**<a:robbed:1491597478565384312> You are being robbed!**',
    'Stop the robbery with command `op stoprob` or `/stoprob` before its to late..',
    `<:next:1489374606916714706> **User:** ${robberName}`
  ];
  const serverLine = getTargetServerLine(targetUser, guild);
  if (serverLine) {
    descriptionLines.push(serverLine);
  }
  descriptionLines.push('-# 1 minute left');

  const embed = new EmbedBuilder()
    .setDescription(descriptionLines.join('\n'))
    .setColor('#ffffff');

  return targetUser.send({ embeds: [embed] });
}

async function sendRobberTimeoutDM(targetUser, amountStolen) {
  const descriptionLines = [
    '**Times out!**',
    `you did not react in time and lost <:beri:1490738445319016651>${amountStolen}`
  ];
  const embed = new EmbedBuilder()
    .setDescription(descriptionLines.join('\n'))
    .setColor('#ff9999');
  return targetUser.send({ embeds: [embed] });
}

async function sendRobberSavedDM(targetUser) {
  const descriptionLines = [
    '**Saved yourself!**',
    'you reacted in time and saved yourself from being robbed. now get revenge!'
  ];
  const embed = new EmbedBuilder()
    .setDescription(descriptionLines.join('\n'))
    .setColor('#fff3c7');
  return targetUser.send({ embeds: [embed] });
}

async function resolveUserTarget(message, interaction, arg) {
  if (interaction) {
    return interaction.options.getUser('target');
  }
  if (!arg) return null;
  const mentionMatch = arg.match(/^<@!?(\d+)>$/);
  const id = mentionMatch ? mentionMatch[1] : arg.replace(/[^0-9]/g, '');
  if (!id) return null;
  try {
    return await message.client.users.fetch(id);
  } catch {
    return null;
  }
}

module.exports = {
  name: 'rob',
  description: 'Attempt to rob another user',
  async execute({ message, interaction, args }) {
    const robberId = message ? message.author.id : interaction.user.id;
    const robberName = message ? message.author.username : interaction.user.username;
    const guild = message ? message.guild : interaction.guild;
    const targetArg = interaction ? null : args?.[0];
    const targetUser = await resolveUserTarget(message, interaction, targetArg);

    if (!targetUser) {
      const reply = 'Please specify a valid user to rob.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }
    if (targetUser.id === robberId) {
      const reply = 'You cannot rob yourself.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let robber = await User.findOne({ userId: robberId });
    if (!robber) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const now = new Date();
    if (robber.robCooldownUntil && robber.robCooldownUntil > now) {
      const remaining = formatRelativeTime(robber.robCooldownUntil);
      const reply = `You must wait another \`${remaining}\` before attempting to rob someone again.`;
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (pendingRobberies.has(targetUser.id)) {
      const reply = 'That user is already being robbed right now.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let target = await User.findOne({ userId: targetUser.id });
    if (!target) {
      const reply = 'That user does not have an account.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const targetBalance = Math.max(target.balance || 0, 0);
    if (targetBalance <= 0) {
      const reply = 'That user does not have any Beli to rob.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    robber.robCooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await robber.save();

    const pendingContent = `<a:loading:1491595708351123659> Robbing **${targetUser.username}**...\n-# They have \`1 minute\` to stop you`;
    let pendingMessage;
    if (message) {
      pendingMessage = await message.channel.send({ content: pendingContent });
    } else {
      pendingMessage = await interaction.reply({ content: pendingContent, fetchReply: true });
    }

    let dmSent = true;
    try {
      await sendRobberDM(targetUser, robberName, guild);
    } catch {
      dmSent = false;
    }

    const percent = randomInt(1, 10);
    const amount = Math.max(1, Math.floor((targetBalance * percent) / 100));

    const timeout = setTimeout(async () => {
      const current = pendingRobberies.get(targetUser.id);
      if (!current || current.robberId !== robberId) return;
      pendingRobberies.delete(targetUser.id);
      target = await User.findOne({ userId: targetUser.id });
      if (!target) return;
      const stolen = Math.min(amount, target.balance || 0);
      target.balance = Math.max((target.balance || 0) - stolen, 0);
      await target.save();

      const robberAccount = await User.findOne({ userId: robberId });
      if (robberAccount) {
        robberAccount.balance = (robberAccount.balance || 0) + stolen;
        await robberAccount.save();
      }

      if (current.pendingMessage && !current.pendingMessage.deleted) {
        const successContent = `Successfully robbed **${targetUser.username}** for **<:beri:1490738445319016651>${stolen}**!`;
        try {
          await current.pendingMessage.reply({ content: successContent });
        } catch {}
      }

      try {
        await sendRobberTimeoutDM(targetUser, stolen);
      } catch {}
    }, 60 * 1000);

    pendingRobberies.set(targetUser.id, {
      robberId,
      targetId: targetUser.id,
      pendingMessage,
      timeout,
      amount,
      interrupted: false
    });

    if (!dmSent) {
      const notice = 'Could not DM the target. They may have DMs disabled.';
      if (message) await message.channel.send(notice);
      else await interaction.followUp({ content: notice, ephemeral: true });
    }
  },

  async cancelRobbery(targetUserId) {
    const pending = pendingRobberies.get(targetUserId);
    if (!pending) return false;
    clearTimeout(pending.timeout);
    pendingRobberies.delete(targetUserId);
    return pending;
  },

  hasPendingRobbery(targetUserId) {
    return pendingRobberies.has(targetUserId);
  }
};
