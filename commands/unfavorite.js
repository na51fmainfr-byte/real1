const User = require('../models/User');
const { getCardById, searchCards, formatCardId } = require('../utils/cards');

module.exports = {
  name: 'unfavorite',
  description: 'Remove a card from your favorites',
  options: [{ name: 'card', type: 3, description: 'Card id or name', required: true }],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const query = message ? args.join(' ') : interaction.options.getString('card');

    if (!query) {
      const reply = 'Please specify a card id or name to unfavorite.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Load user early to prioritize matches by favorites/team
    let user = await User.findOne({ userId });
    if (!user) {
      const reply = "You don't have an account. Run `op start` or /start to register.";
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let cardDef = getCardById(query);
    if (!cardDef) {
      const matches = searchCards(query);
      if (!matches.length) {
        const reply = `No card found matching **${query}**.`;
        if (message) return message.reply(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
      // Prioritize: favorites first, then cards on your team
      const favSet = new Set(user.favoriteCards || []);
      const teamSet = new Set(user.team || []);
      matches.sort((a, b) => {
        const aScore = (favSet.has(a.id) ? 2 : 0) + (teamSet.has(a.id) ? 1 : 0);
        const bScore = (favSet.has(b.id) ? 2 : 0) + (teamSet.has(b.id) ? 1 : 0);
        return bScore - aScore;
      });
      cardDef = matches[0];
    }

    user.favoriteCards = user.favoriteCards || [];
    user.wishlistCards = user.wishlistCards || [];

    const inFavorites = user.favoriteCards.includes(cardDef.id);
    const inWishlist = user.wishlistCards.includes(cardDef.id);
    if (!inFavorites && !inWishlist) {
      const reply = `${formatCardId(cardDef.id)} is not in your favorites or wishlist.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (inFavorites) user.favoriteCards = user.favoriteCards.filter(id => id !== cardDef.id);
    if (inWishlist) user.wishlistCards = user.wishlistCards.filter(id => id !== cardDef.id);
    await user.save();

    const reply = `Removed ${cardDef.emoji ? cardDef.emoji + ' ' : ''}${cardDef.character} (${formatCardId(cardDef.id)}) from your favorites/wishlist.`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply });
  }
};
