const User = require('../models/User');
const MarketListing = require('../models/MarketListing');
const { getBotConfig } = require('../models/BotConfig');
const { EmbedBuilder } = require('discord.js');
const { searchCards, formatCardId, getCardById } = require('../utils/cards');

const BELI_EMOJI = '<:beri:1490738445319016651>';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function formatPrice(price) {
  return price.toLocaleString('en-US').replace(/,/g, "'");
}

async function execute({ message, interaction, args }) {
  const userId = message ? message.author.id : interaction.user.id;
  const username = message ? message.author.username : interaction.user.username;
  const reply = (content) => message ? message.reply(content) : interaction.reply({ content, ephemeral: true });

  const rawArgs = args || [];
  const cardQuery = rawArgs[0];
  const priceArg = rawArgs[1];

  if (!cardQuery || !priceArg) {
    return reply('Usage: `op marketlist <card ID or name> <price>`\nExample: `op marketlist 0001 5000`');
  }

  const price = parseInt(priceArg.replace(/[',]/g, ''), 10);
  if (isNaN(price) || price < 1) {
    return reply('Invalid price. Please enter a positive number.');
  }
  if (price > 999_999_999) {
    return reply('Price cannot exceed 999,999,999 Beli.');
  }

  const user = await User.findOne({ userId });
  if (!user) return reply('You need to start first. Use `op start`');

  const results = searchCards(cardQuery);
  if (!results || !results.length) {
    return reply(`No cards found matching **"${cardQuery}"**.`);
  }

  let cardDef = null;
  let ownedEntry = null;

  for (const match of results) {
    const entry = user.ownedCards.find(e => e.cardId === match.id);
    if (entry) {
      cardDef = match;
      ownedEntry = entry;
      break;
    }
  }

  if (!cardDef || !ownedEntry) {
    return reply(`You don't own any card matching **"${cardQuery}"**.`);
  }

  const alreadyListed = await MarketListing.findOne({
    sellerId: userId,
    cardId: cardDef.id,
    expiresAt: { $gt: new Date() },
  });
  if (alreadyListed) {
    return reply(`You already have a listing for **${cardDef.character}** on the market! Cancel it first by using \`op marketlistings\`.`);
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWO_WEEKS_MS);

  // Remove the card from the user's collection (escrow the card for the listing)
  const ownedIndex = user.ownedCards.findIndex(e => e.cardId === cardDef.id);
  let removedEntry = ownedEntry;
  if (ownedIndex !== -1) {
    removedEntry = user.ownedCards.splice(ownedIndex, 1)[0];
    // remove from team/favorites to avoid dangling references
    user.team = (user.team || []).filter(t => t !== cardDef.id);
    user.favoriteCards = (user.favoriteCards || []).filter(c => c !== cardDef.id);
    try { if (typeof user.markModified === 'function') user.markModified('ownedCards'); } catch (e) {}
    await user.save();
  }

  const listing = await MarketListing.create({
    sellerId: userId,
    sellerName: username,
    cardId: cardDef.id,
    cardName: cardDef.character,
    cardEmoji: cardDef.emoji || '',
    cardRank: cardDef.rank || 'D',
    cardAttribute: cardDef.attribute || '',
    price,
    level: removedEntry.level || 1,
    xp: removedEntry.xp || 0,
    equippedTo: removedEntry.equippedTo || null,
    starLevel: removedEntry.starLevel || 0,
    createdAt: now,
    expiresAt,
  });

  // Post a public market embed to configured market channel (if set)
  try {
    const client = message ? message.client : interaction.client;
    const marketChannelId = await getBotConfig('marketChannel');
    if (marketChannelId) {
      const ch = await client.channels.fetch(marketChannelId).catch(() => null);
      if (ch) {
        const avatarUrl = message ? message.author.displayAvatarURL() : interaction.user.displayAvatarURL();
        const embed = new EmbedBuilder()
          .setColor('#ffffff')
          .setTitle(`${username}'s trade offer`)
          .setThumbnail(avatarUrl)
          .addFields(
            { name: 'Card for sale', value: `${cardDef.emoji ? cardDef.emoji + ' ' : ''}${cardDef.character} (Lvl. ${removedEntry.level || 1}) \`${formatCardId(cardDef.id)}\``, inline: false },
            { name: 'Price', value: `${formatPrice(price)} ${BELI_EMOJI}`, inline: false }
          )
          .setFooter({ text: 'Posting...' });

        const sent = await ch.send({ embeds: [embed] }).catch(() => null);
        if (sent) {
          const updated = EmbedBuilder.from(embed).setFooter({ text: `op marketbuy ${sent.id} to accept` });
          await sent.edit({ embeds: [updated] }).catch(() => {});
          listing.messageId = sent.id;
          listing.channelId = ch.id;
          await listing.save().catch(() => {});
        }
      }
    }
  } catch (err) {}

  const starStr = (removedEntry.starLevel || 0) > 0 ? ` ${'⭐'.repeat(removedEntry.starLevel)}` : '';
  return reply(
    `Listed **${cardDef.emoji ? cardDef.emoji + ' ' : ''}${cardDef.character}**${starStr} (Lvl. ${removedEntry.level || 1}) for **${formatPrice(price)}** ${BELI_EMOJI}!\nListing expires in 2 weeks. Use \`op marketlistings\` to view your market listings.`
  );
}

module.exports = { execute };
