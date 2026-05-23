const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const User = require('../models/User');
const MarketListing = require('../models/MarketListing');
const { formatCardId } = require('../utils/cards');
const { getMaxStarForRank } = require('../utils/starLevel');

const BELI_EMOJI = '<:beri:1490738445319016651>';
const RANK_EMOJIS = {
  D: '<:Drank:1505618722205732894>',
  C: '<:Crank:1505619117544312993>',
  B: '<:Brank:1505619119201058926>',
  A: '<:Arank:1505618730594472187>',
  S: '<:Srank:1505618732247023676>',
  SS: '<:SSrank:1505618733349994516>',
  UR: '<:URrank:1505618734503559429>',
};

function formatPrice(price) {
  return price.toLocaleString('en-US').replace(/,/g, "'");
}

function parseMention(mention) {
  if (!mention) return null;
  const m = mention.match(/^<@!?(\d+)>$/);
  return m ? m[1] : null;
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

async function execute({ message, interaction, args }) {
  const authorId = message ? message.author.id : interaction.user.id;
  const rawArgs = args || [];
  const mentionArg = rawArgs[0];

  let targetId = parseMention(mentionArg) || authorId;
  let targetName = null;

  try {
    const client = message ? message.client : interaction.client;
    const targetUser = await client.users.fetch(targetId);
    targetName = targetUser.username;
  } catch {
    targetName = 'Unknown';
  }

  const now = new Date();
  const listings = await MarketListing.find({ sellerId: targetId, expiresAt: { $gt: now } }).sort({ createdAt: -1 });

  const isOwn = targetId === authorId;
  const embed = new EmbedBuilder()
    .setColor('#ffffff')
    .setTitle(`${targetName}'s Market Listings`)
    .setFooter({ text: `${listings.length} active listing${listings.length !== 1 ? 's' : ''}` });

  if (!listings.length) {
    embed.setDescription(isOwn ? 'You have no active market listings.' : `${targetName} has no active market listings.`);
    const sent = message ? await message.reply({ embeds: [embed] }) : await interaction.reply({ embeds: [embed] });
    return sent;
  }

  const options = listings.map(listing => {
    const cardEmoji = listing.cardEmoji ? listing.cardEmoji + ' ' : '';
    const maxStar = getMaxStarForRank(listing.cardRank || 'D');
    const starStr = (typeof listing.starLevel === 'number' && listing.starLevel >= maxStar) ? ' <:MAXstarlevel:1505618736516825180>' : '';
    const priceStr = formatPrice(listing.price);
    const expires = timeLeft(listing.expiresAt);

    embed.addFields({
      name: `${cardEmoji}${listing.cardName}${starStr} (Lvl. ${listing.level})`,
      value: `\`ID: ${formatCardId(listing.cardId)}\` | ${priceStr} ${BELI_EMOJI} | Expires: ${expires}`,
      inline: false,
    });

    const label = `${listing.cardName} (Lvl. ${listing.level}) — ${priceStr} beli`.slice(0, 100);
    const desc = `ID: ${formatCardId(listing.cardId)} | Expires: ${expires}`.slice(0, 100);
    return { label, description: desc, value: listing._id.toString() };
  });

  const components = [];
  if (isOwn) {
    const chooseRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`marketcancel:${authorId}`)
        .setPlaceholder('Select a listing to cancel')
        .setDisabled(!options.length)
        .addOptions(options.length ? options : [{ label: 'No listings', value: 'none', description: '' }])
    );
    components.push(chooseRow);
  }

  if (message) return message.reply({ embeds: [embed], components });
  return interaction.reply({ embeds: [embed], components });
}

async function handleButton(interaction) {
  const parts = interaction.customId.split(':');
  const ownerId = parts[1];
  const listingId = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'You can only cancel your own listings.', ephemeral: true });
  }

  const listing = await MarketListing.findById(listingId);
  if (!listing) {
    return interaction.reply({ content: 'This listing no longer exists.', ephemeral: true });
  }
  if (listing.sellerId !== ownerId) {
    return interaction.reply({ content: 'This is not your listing.', ephemeral: true });
  }

  // Return the card to the seller since it was escrowed at listing time
  try {
    const seller = await User.findOne({ userId: ownerId });
    if (seller) {
      seller.ownedCards = seller.ownedCards || [];
      // avoid duplicates: only add if seller does not already have this card
      if (!seller.ownedCards.some(e => e.cardId === listing.cardId)) {
        seller.ownedCards.push({ cardId: listing.cardId, level: listing.level || 1, xp: listing.xp || 0, equippedTo: listing.equippedTo || null, starLevel: listing.starLevel || 0 });
        await seller.save().catch(() => {});
      }
    }
  } catch (e) {}

  await MarketListing.findByIdAndDelete(listingId);

  const BELI_EMOJI_LOCAL = '<:beri:1490738445319016651>';
  await interaction.reply({
    content: `Cancelled listing for **${listing.cardName}** (was ${formatPrice(listing.price)} ${BELI_EMOJI_LOCAL}).`,
    ephemeral: true,
  });

  const embed = interaction.message.embeds[0];
  const remainingListings = await MarketListing.find({ sellerId: ownerId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  const updatedEmbed = EmbedBuilder.from(embed).setFooter({ text: `${remainingListings.length} active listing${remainingListings.length !== 1 ? 's' : ''}` });

  const updatedComponents = [];
  if (remainingListings.length > 0) {
    const opts = remainingListings.map(l => {
      const priceStr = formatPrice(l.price);
      const label = `${l.cardName} (Lvl. ${l.level}) — ${priceStr} beli`.slice(0, 100);
      const desc = `ID: ${formatCardId(l.cardId)} | Expires: ${timeLeft(l.expiresAt)}`.slice(0, 100);
      return { label, description: desc, value: l._id.toString() };
    });
    updatedComponents.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`marketcancel:${ownerId}`)
        .setPlaceholder('Select a listing to cancel')
        .addOptions(opts)
    ));
  }

  if (remainingListings.length === 0) {
    updatedEmbed.setDescription('You have no active market listings.');
    updatedEmbed.spliceFields(0, 25);
  }

  return interaction.message.edit({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => {});
}

async function handleSelect(interaction) {
  const [action, ownerId] = interaction.customId.split(':');
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ content: 'You can only cancel your own listings.', ephemeral: true });
  }

  const listingId = Array.isArray(interaction.values) && interaction.values.length ? interaction.values[0] : null;
  if (!listingId || listingId === 'none') {
    return interaction.reply({ content: 'No listing selected.', ephemeral: true });
  }

  const listing = await MarketListing.findById(listingId);
  if (!listing) {
    return interaction.reply({ content: 'This listing no longer exists.', ephemeral: true });
  }
  if (listing.sellerId !== ownerId) {
    return interaction.reply({ content: 'This is not your listing.', ephemeral: true });
  }

  // Return the card to the seller since it was escrowed at listing time
  try {
    const seller = await User.findOne({ userId: ownerId });
    if (seller) {
      seller.ownedCards = seller.ownedCards || [];
      if (!seller.ownedCards.some(e => e.cardId === listing.cardId)) {
        seller.ownedCards.push({ cardId: listing.cardId, level: listing.level || 1, xp: listing.xp || 0, equippedTo: listing.equippedTo || null, starLevel: listing.starLevel || 0 });
        await seller.save().catch(() => {});
      }
    }
  } catch (e) {}

  await MarketListing.findByIdAndDelete(listingId);

  const BELI_EMOJI_LOCAL = '<:beri:1490738445319016651>';
  await interaction.reply({ content: `Cancelled listing for **${listing.cardName}** (was ${formatPrice(listing.price)} ${BELI_EMOJI_LOCAL}).`, ephemeral: true });

  const embed = interaction.message.embeds[0];
  const remainingListings = await MarketListing.find({ sellerId: ownerId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  const updatedEmbed = EmbedBuilder.from(embed).setFooter({ text: `${remainingListings.length} active listing${remainingListings.length !== 1 ? 's' : ''}` });

  const updatedComponents = [];
  if (remainingListings.length > 0) {
    const opts = remainingListings.map(l => {
      const priceStr = formatPrice(l.price);
      const label = `${l.cardName} (Lvl. ${l.level}) — ${priceStr} beli`.slice(0, 100);
      const desc = `ID: ${formatCardId(l.cardId)} | Expires: ${timeLeft(l.expiresAt)}`.slice(0, 100);
      return { label, description: desc, value: l._id.toString() };
    });
    updatedComponents.push(new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`marketcancel:${ownerId}`)
        .setPlaceholder('Select a listing to cancel')
        .addOptions(opts)
    ));
  }

  if (remainingListings.length === 0) {
    updatedEmbed.setDescription('You have no active market listings.');
    updatedEmbed.spliceFields(0, 25);
  }

  return interaction.message.edit({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => {});
}

module.exports = { execute, handleButton, handleSelect };
