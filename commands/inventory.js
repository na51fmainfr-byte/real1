const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { levelers } = require('../data/levelers');
const { rods } = require('../data/rods');
const crews = require('../data/crews');
const { sanitizeUserRods } = require('../utils/inventoryHelper');
const { chests, CHEST_EMOJIS } = require('../data/chests');

const ITEM_DISPLAY_NAMES = {
  c_chest: 'C Chest',
  b_chest: 'B Chest',
  a_chest: 'A Chest'
};
const ITEM_DISPLAY_EMOJIS = {
  c_chest: CHEST_EMOJIS.c_chest,
  b_chest: CHEST_EMOJIS.b_chest,
  a_chest: CHEST_EMOJIS.a_chest
};

// Additional item display names/emojis
ITEM_DISPLAY_NAMES.cola = 'Cola';
ITEM_DISPLAY_EMOJIS.cola = '<:cola:1494106165955792967>';
ITEM_DISPLAY_NAMES.red_shard = 'Red Shard';
ITEM_DISPLAY_EMOJIS.red_shard = '<:RedShard:1494106374492131439>';
ITEM_DISPLAY_NAMES.blue_shard = 'Blue Shard';
ITEM_DISPLAY_EMOJIS.blue_shard = '<:Blueshard:1494106500149411980>';
ITEM_DISPLAY_NAMES.green_shard = 'Green Shard';
ITEM_DISPLAY_EMOJIS.green_shard = '<:GreenShard:1494106686963581039>';
ITEM_DISPLAY_NAMES.yellow_shard = 'Yellow Shard';
ITEM_DISPLAY_EMOJIS.yellow_shard = '<:YellowShard:1494106825627406530>';
ITEM_DISPLAY_NAMES.purple_shard = 'Purple Shard';
ITEM_DISPLAY_EMOJIS.purple_shard = '<:PurpleShard:1494106958582776008>';

// God token display
ITEM_DISPLAY_NAMES.god_token = 'God Token';
ITEM_DISPLAY_EMOJIS.god_token = '<:godtoken:1499957056650608753>';

const ITEMS_PER_PAGE = 20;

function parseTargetIdFromArgs(args) {
  if (!args || args.length === 0) return null;
  const first = args[0];
  const mentionMatch = first.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  if (/^\d{17,19}$/.test(first)) return first;
  return null;
}

function splitFieldValue(value, maxLength = 1024) {
  if (typeof value !== 'string') return [''];
  if (value.length <= maxLength) return [value];
  const lines = value.split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if (current.length + line.length + (current ? 1 : 0) <= maxLength) {
      current += (current ? '\n' : '') + line;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = '';
    }
    if (line.length > maxLength) {
      chunks.push(line.slice(0, maxLength - 3) + '...');
    } else {
      current = line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildInventoryEmbed(user, username, avatarUrl, pageIndex = 0) {
  const currentRod = rods.find(r => r.id === user.currentRod);
  const rodItem = user.items?.find(it => it.itemId === user.currentRod);

  const itemLines = [];
  // Only display the active rod if it exists, is valid, and has durability remaining
  if (currentRod && rodItem && (rodItem.durability === undefined || rodItem.durability > 0)) {
    let rodDisplay = `${currentRod.emoji} ${currentRod.name}`;
    if (rodItem.durability !== undefined) {
      rodDisplay += ` (${rodItem.durability}/${currentRod.durability})`;
    }
    itemLines.push(rodDisplay);
  }
  (user.items || [])
    .filter(it => it.itemId !== user.currentRod && (it.durability === undefined || it.durability > 0))
    .forEach(i => {
      const leveler = levelers.find(l => l.id === i.itemId);
      if (!leveler) {
        const displayName = ITEM_DISPLAY_NAMES[i.itemId] || i.itemId;
        const emoji = ITEM_DISPLAY_EMOJIS[i.itemId] || '';
        const display = emoji ? `${emoji} ${displayName} x${i.quantity}` : `${displayName} x${i.quantity}`;
        if (i.durability !== undefined) {
          display += ` (${i.durability})`;
        }
        itemLines.push(display);
      }
    });

  const levelerLines = (user.items || [])
    .filter(i => levelers.some(l => l.id === i.itemId) && (i.durability === undefined || i.durability > 0))
    .map(i => {
      const leveler = levelers.find(l => l.id === i.itemId);
      let display = `${leveler.emoji} ${leveler.name} x${i.quantity}`;
      if (i.durability !== undefined) {
        display += ` (${i.durability})`;
      }
      return display;
    });

  const packObj = user.packInventory || {};
  const packLines = Object.keys(packObj).length
    ? Object.entries(packObj).map(([name, qty]) => {
        const crew = crews.find(c => c.name === name);
        const emoji = crew && crew.icon ? `${crew.icon} ` : '';
        return `${emoji}${name} x${qty}`;
      })
    : [];

  const inventoryLines = [];
  itemLines.forEach(line => inventoryLines.push({ section: 'Items', text: line }));
  levelerLines.forEach(line => inventoryLines.push({ section: 'Levelers', text: line }));
  packLines.forEach(line => inventoryLines.push({ section: 'Packs', text: line }));

  const sectionHasItems = {
    Items: itemLines.length > 0,
    Levelers: levelerLines.length > 0,
    Packs: packLines.length > 0
  };

  function paginateInventoryLines(lines) {
    const pages = [];

    const makePage = () => ({
      sectionLines: {
        Items: [],
        Levelers: [],
        Packs: []
      },
      sectionLengths: {
        Items: 0,
        Levelers: 0,
        Packs: 0
      },
      lineCount: 0
    });

    let page = makePage();

    for (const entry of lines) {
      const section = entry.section;
      const text = entry.text;
      const currentLength = page.sectionLengths[section];
      const nextLength = currentLength > 0 ? currentLength + 1 + text.length : text.length;

      if (page.lineCount >= ITEMS_PER_PAGE || (currentLength > 0 && nextLength > 1024)) {
        pages.push(page);
        page = makePage();
      }

      page.sectionLines[section].push(text);
      page.sectionLengths[section] = page.sectionLengths[section] > 0
        ? page.sectionLengths[section] + 1 + text.length
        : text.length;
      page.lineCount += 1;
    }

    if (page.lineCount > 0 || pages.length === 0) {
      pages.push(page);
    }

    return pages;
  }

  const pages = paginateInventoryLines(inventoryLines);
  const totalPages = Math.max(1, pages.length);
  const clampedPage = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const page = pages[clampedPage] || { sectionLines: { Items: [], Levelers: [], Packs: [] } };

  const embed = new EmbedBuilder()
    .setColor('#FFFFFF')
    .setTitle(`${username}'s Inventory`)
    .setThumbnail(avatarUrl);

  const addSectionFields = (sectionName, lines, hasAny) => {
    if (lines.length === 0) {
      if (!hasAny && pageIndex === 0) {
        embed.addFields({ name: sectionName, value: `No ${sectionName.toLowerCase()}`, inline: false });
      }
      return;
    }

    const sectionText = lines.join('\n');
    if (sectionText.length <= 1024) {
      embed.addFields({ name: sectionName, value: sectionText, inline: false });
      return;
    }

    let current = '';
    let isFirstField = true;
    for (const line of lines) {
      const nextValue = current ? `${current}\n${line}` : line;
      if (nextValue.length > 1024) {
        embed.addFields({ name: isFirstField ? sectionName : '\u200b', value: current, inline: false });
        current = line;
        isFirstField = false;
      } else {
        current = nextValue;
      }
    }
    if (current) {
      embed.addFields({ name: isFirstField ? sectionName : '\u200b', value: current, inline: false });
    }
  };

  addSectionFields('Items', page.sectionLines.Items, sectionHasItems.Items);
  addSectionFields('Levelers', page.sectionLines.Levelers, sectionHasItems.Levelers);
  addSectionFields('Packs', page.sectionLines.Packs, sectionHasItems.Packs);

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${clampedPage + 1}/${totalPages}` });
  }

  return { embed, totalPages, currentPage: clampedPage };
}

module.exports = {
  name: 'inventory',
  description: 'Show your items and packs',
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const discordUser = message ? message.author : interaction.user;
    const targetId = message ? parseTargetIdFromArgs(args) || userId : interaction.options.getUser('target')?.id || userId;
    let targetUser = discordUser;
    let username = discordUser.username;
    let avatarUrl = discordUser.displayAvatarURL();
    if (message && targetId !== userId) {
      targetUser = await message.client.users.fetch(targetId).catch(() => null) || targetUser;
      username = targetUser.username || username;
      avatarUrl = targetUser.displayAvatarURL ? targetUser.displayAvatarURL() : avatarUrl;
    } else if (!message && targetId !== userId) {
      const targetOption = interaction.options.getUser('target');
      if (targetOption) {
        targetUser = targetOption;
        username = targetUser.username;
        avatarUrl = targetUser.displayAvatarURL();
      }
    }

    let user = await User.findOne({ userId: targetId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }
    if (sanitizeUserRods(user)) {
      await user.save();
    }
    const { embed, totalPages } = buildInventoryEmbed(user, username, avatarUrl, 0);
    
    if (totalPages <= 1) {
      if (message) return message.channel.send({ embeds: [embed] });
      return interaction.reply({ embeds: [embed] });
    }
    
    // Add pagination buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_prev_${message ? message.author.id : interaction.user.id}_${targetId}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`inv_next_${message ? message.author.id : interaction.user.id}_${targetId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
    );
    
    if (message) {
      return message.channel.send({ embeds: [embed], components: [row] });
    } else {
      return interaction.reply({ embeds: [embed], components: [row] });
    }
  },

  async handleButton(interaction, customId) {
    const parts = customId.split('_');
    const action = parts[0];
    const direction = parts[1];
    const viewerId = parts[2];
    const targetId = parts[3] || viewerId;
    
    if (action !== 'inv' || interaction.user.id !== viewerId) {
      return interaction.reply({ content: 'This is not your inventory.', ephemeral: true });
    }

    const user = await User.findOne({ userId: targetId });
    if (!user) {
      return interaction.reply({ content: 'User not found.', ephemeral: true });
    }

    // Get current page from footer
    const currentEmbed = interaction.message.embeds[0];
    const footerText = currentEmbed?.footer?.text || 'Page 1/1';
    const match = footerText.match(/Page (\d+)\/(\d+)/);
    const currentPage = match ? parseInt(match[1]) - 1 : 0;
    const totalPages = match ? parseInt(match[2]) : 1;

    let newPage = currentPage;
    if (direction === 'prev') newPage = Math.max(0, currentPage - 1);
    if (direction === 'next') newPage = Math.min(totalPages - 1, currentPage + 1);

    const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
    const username = targetUser ? targetUser.username : targetId;
    const avatarUrl = targetUser ? targetUser.displayAvatarURL() : interaction.user.displayAvatarURL();
    const { embed } = buildInventoryEmbed(user, username, avatarUrl, newPage);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inv_prev_${viewerId}_${targetId}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0),
      new ButtonBuilder()
        .setCustomId(`inv_next_${viewerId}_${targetId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === totalPages - 1)
    );

    if (global && typeof global.safeUpdate === 'function') {
      return global.safeUpdate(interaction, { embeds: [embed], components: [row] });
    }
    return global.safeUpdate(interaction, { embeds: [embed], components: [row] });
  }
};

