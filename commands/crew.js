const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const User = require('../models/User');
const Crew = require('../models/Crew');
const { cards: allCards } = require('../data/cards');

const CREW_CAP = 25;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genCrewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isValidHex(str) {
  return /^#[0-9A-Fa-f]{6}$/.test(str);
}

function isValidUrl(str) {
  return /^https?:\/\/.+/.test(str);
}

async function getCrewForUser(userId) {
  return Crew.findOne({ members: userId });
}

async function computeCrewStats(crew) {
  const memberUsers = await User.find(
    { userId: { $in: crew.members } },
    'userId bounty team'
  );
  let totalBounty = 0;
  let totalPower = 0;
  for (const u of memberUsers) {
    totalBounty += (u.bounty ?? 100);
    for (const cid of (u.team || [])) {
      const def = allCards.find(c => c.id === cid);
      if (def && def.power) totalPower += def.power;
    }
  }
  return { totalBounty, totalPower };
}

async function fetchUsernames(userIds, client) {
  const map = {};
  await Promise.all(userIds.map(async id => {
    try {
      const u = await client.users.fetch(id);
      map[id] = u.username;
    } catch {
      map[id] = `Unknown`;
    }
  }));
  return map;
}

async function buildCrewEmbed(crew, client) {
  const { totalBounty, totalPower } = await computeCrewStats(crew);
  const names = await fetchUsernames(crew.members, client);
  const captainName = names[crew.captainId] || crew.captainId;
  const crewMembers = crew.members.filter(id => id !== crew.captainId);

  let desc = `**⚓ Captain**\n┗ ${captainName}`;
  if (crewMembers.length > 0) {
    const memberLines = crewMembers.map(id => `┣ ${names[id] || id}`);
    desc += `\n\n**Members**\n${memberLines.join('\n')}`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏴‍☠️  ${crew.name}`)
    .setColor(crew.color || '#2b2d31')
    .setDescription(desc)
    .addFields(
      { name: '👥 Members', value: `${crew.members.length} / ${CREW_CAP}`, inline: true },
      { name: '💰 Total Bounty', value: totalBounty.toLocaleString(), inline: true },
      { name: '⚔️ Total Power', value: totalPower.toLocaleString(), inline: true }
    );

  if (crew.jollyRoger) embed.setThumbnail(crew.jollyRoger);
  return embed;
}

function buildCreatePrompt() {
  const embed = new EmbedBuilder()
    .setColor('#2b2d31')
    .setTitle('🏴‍☠️  No Crew')
    .setDescription("You're not in a crew yet.\nCreate one to rally your nakama and compete on the crew leaderboard!");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('crew_create_btn')
      .setLabel('Create Crew')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏴‍☠️')
  );
  return { embed, row };
}

// ─── Execute ─────────────────────────────────────────────────────────────────

module.exports = {
  name: 'crew',
  description: 'Manage your pirate crew',

  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const client = message ? message.client : interaction.client;

    let sub, targetUser;
    if (interaction) {
      sub = interaction.options.getSubcommand(false) || 'view';
      targetUser = interaction.options.getUser?.('user') || null;
    } else {
      const firstArg = (args?.[0] || '').toLowerCase();
      sub = firstArg || 'view';
      if (sub === 'lb') sub = 'leaderboard';
      targetUser = message.mentions.users.first() || null;
    }

    // ── VIEW ─────────────────────────────────────────────────────────────────
    if (sub === 'view') {
      const lookupId = targetUser ? targetUser.id : userId;
      const crew = await getCrewForUser(lookupId);

      if (!crew) {
        if (targetUser) {
          const content = `**${targetUser.username}** is not in a crew.`;
          if (message) return message.reply(content);
          return interaction.reply({ content, ephemeral: true });
        }
        if (interaction) {
          const { embed, row } = buildCreatePrompt();
          return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }
        return message.reply(
          "You're not in a crew yet. Use `/crew view` to create one, or `op crew create <name>` to get started."
        );
      }

      const embed = await buildCrewEmbed(crew, client);
      if (message) return message.reply({ embeds: [embed] });
      return interaction.reply({ embeds: [embed] });
    }

    // ── CREATE (prefix only — slash uses modal) ───────────────────────────────
    if (sub === 'create') {
      if (!message) return;
      const existing = await getCrewForUser(userId);
      if (existing) return message.reply(`You're already in **${existing.name}**. Leave or disband it first.`);

      const name = (args?.slice(1) || []).join(' ').trim().slice(0, 32);
      if (!name) return message.reply('Please provide a crew name: `op crew create <name>`');

      const crew = await Crew.create({
        crewId: genCrewId(),
        name,
        captainId: userId,
        members: [userId],
        color: '#2b2d31',
        jollyRoger: null
      });

      const embed = await buildCrewEmbed(crew, client);
      return message.reply({ content: '✅ Crew created!', embeds: [embed] });
    }

    // ── ADD ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      if (!targetUser) {
        const content = 'Please mention or specify a user to add.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      const crew = await getCrewForUser(userId);
      if (!crew) {
        const content = "You're not in a crew. Create one first.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.captainId !== userId) {
        const content = 'Only the captain can add members.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.members.length >= CREW_CAP) {
        const content = `Your crew is full (${CREW_CAP} members max).`;
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.members.includes(targetUser.id)) {
        const content = `**${targetUser.username}** is already in your crew.`;
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      const targetCrew = await getCrewForUser(targetUser.id);
      if (targetCrew) {
        const content = `**${targetUser.username}** is already in another crew.`;
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      const targetAccount = await User.findOne({ userId: targetUser.id });
      if (!targetAccount) {
        const content = `**${targetUser.username}** doesn't have a bot account yet.`;
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      crew.members.push(targetUser.id);
      await crew.save();
      const content = `✅ **${targetUser.username}** has been added to **${crew.name}**.`;
      if (message) return message.reply(content);
      return interaction.reply({ content });
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      if (!targetUser) {
        const content = 'Please mention or specify a user to remove.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      const crew = await getCrewForUser(userId);
      if (!crew) {
        const content = "You're not in a crew.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.captainId !== userId) {
        const content = 'Only the captain can remove members.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (targetUser.id === userId) {
        const content = "You can't remove yourself. Use `disband` to dissolve the crew.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (!crew.members.includes(targetUser.id)) {
        const content = `**${targetUser.username}** is not in your crew.`;
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      crew.members = crew.members.filter(id => id !== targetUser.id);
      await crew.save();
      const content = `✅ **${targetUser.username}** has been removed from **${crew.name}**.`;
      if (message) return message.reply(content);
      return interaction.reply({ content });
    }

    // ── LEAVE ─────────────────────────────────────────────────────────────────
    if (sub === 'leave') {
      const crew = await getCrewForUser(userId);
      if (!crew) {
        const content = "You're not in a crew.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.captainId === userId) {
        const content = "You're the captain — use `disband` to dissolve the crew.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      crew.members = crew.members.filter(id => id !== userId);
      await crew.save();
      const content = `You've left **${crew.name}**.`;
      if (message) return message.reply(content);
      return interaction.reply({ content, ephemeral: true });
    }

    // ── DISBAND ───────────────────────────────────────────────────────────────
    if (sub === 'disband') {
      const crew = await getCrewForUser(userId);
      if (!crew) {
        const content = "You're not in a crew.";
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (crew.captainId !== userId) {
        const content = 'Only the captain can disband the crew.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }
      if (interaction) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`crew_disband_confirm:${crew.crewId}`)
            .setLabel('Yes, Disband')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('crew_disband_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({
          content: `Are you sure you want to disband **${crew.name}**? This cannot be undone.`,
          components: [row],
          ephemeral: true
        });
      }
      await Crew.deleteOne({ crewId: crew.crewId });
      return message.reply(`**${crew.name}** has been disbanded.`);
    }

    // ── LEADERBOARD ───────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      const allCrews = await Crew.find({});
      if (!allCrews.length) {
        const content = 'No crews have been created yet.';
        if (message) return message.reply(content);
        return interaction.reply({ content, ephemeral: true });
      }

      const ranked = await Promise.all(allCrews.map(async crew => {
        const { totalBounty } = await computeCrewStats(crew);
        return { crew, totalBounty };
      }));
      ranked.sort((a, b) => b.totalBounty - a.totalBounty);
      const top = ranked.slice(0, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map(({ crew, totalBounty }, i) => {
        const pos = medals[i] || `**${i + 1}.**`;
        return `${pos} **${crew.name}** — ${totalBounty.toLocaleString()} bounty · ${crew.members.length} members`;
      });

      const embed = new EmbedBuilder()
        .setTitle('🏆  Crew Leaderboard')
        .setColor('#FFD700')
        .setDescription(lines.join('\n'));

      if (message) return message.reply({ embeds: [embed] });
      return interaction.reply({ embeds: [embed] });
    }
  },

  // ─── Button Handler ────────────────────────────────────────────────────────
  async handleButton(interaction, customId) {
    const [action, crewId] = customId.split(':');

    if (action === 'crew_create_btn') {
      const modal = new ModalBuilder()
        .setCustomId('crew_create_modal')
        .setTitle('Create Your Crew');

      const nameInput = new TextInputBuilder()
        .setCustomId('crew_name')
        .setLabel('Crew Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(32)
        .setPlaceholder('e.g. Straw Hat Pirates');

      const colorInput = new TextInputBuilder()
        .setCustomId('crew_color')
        .setLabel('Crew Colour (hex, optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(7)
        .setPlaceholder('#FF0000');

      const jollyInput = new TextInputBuilder()
        .setCustomId('crew_jolly')
        .setLabel('Jolly Roger URL (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder('https://...');

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(jollyInput)
      );

      return interaction.showModal(modal);
    }

    if (action === 'crew_disband_confirm') {
      const crew = await Crew.findOne({ crewId });
      if (!crew || crew.captainId !== interaction.user.id) {
        return interaction.update({ content: 'Unable to disband crew.', components: [] });
      }
      const name = crew.name;
      await Crew.deleteOne({ crewId });
      return interaction.update({ content: `**${name}** has been disbanded.`, components: [] });
    }

    if (action === 'crew_disband_cancel') {
      return interaction.update({ content: 'Disband cancelled.', components: [] });
    }
  },

  // ─── Modal Handler ─────────────────────────────────────────────────────────
  async handleModal(interaction) {
    const userId = interaction.user.id;
    const client = interaction.client;

    const existing = await getCrewForUser(userId);
    if (existing) {
      return interaction.reply({ content: `You're already in **${existing.name}**.`, ephemeral: true });
    }

    const name = interaction.fields.getTextInputValue('crew_name').trim();
    const rawColor = interaction.fields.getTextInputValue('crew_color').trim();
    const rawJolly = interaction.fields.getTextInputValue('crew_jolly').trim();

    if (!name) {
      return interaction.reply({ content: 'Crew name cannot be empty.', ephemeral: true });
    }

    const color = (rawColor && isValidHex(rawColor)) ? rawColor : '#2b2d31';
    const jollyRoger = (rawJolly && isValidUrl(rawJolly)) ? rawJolly : null;

    const crew = await Crew.create({
      crewId: genCrewId(),
      name,
      captainId: userId,
      members: [userId],
      color,
      jollyRoger
    });

    const embed = await buildCrewEmbed(crew, client);
    return interaction.reply({ content: '✅ Crew created!', embeds: [embed] });
  }
};
