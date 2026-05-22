const User = require('../models/User');
const { getCardById, searchCards, formatCardId } = require('../utils/cards');

module.exports = {
  name: 'favorite',
  description: 'Mark a card as a favorite',
  options: [{ name: 'card', type: 3, description: 'Card id or name', required: true }],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const query = message ? args.join(' ') : interaction.options.getString('card');

    if (!query) {
      const reply = 'Please specify a card id or name to favorite.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Load user early so we can prioritize ambiguous matches by favorites/team
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

    const owns = (user.ownedCards || []).some(e => e.cardId === cardDef.id);

    if (owns) {
      if (user.favoriteCards.includes(cardDef.id)) {
        const reply = `${formatCardId(cardDef.id)} is already in your favorites.`;
        if (message) return message.reply(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
      user.favoriteCards.push(cardDef.id);
      await user.save();
      const reply = `<:star:1501996419693936843> Favorited ${cardDef.emoji ? cardDef.emoji + ' ' : ''}${cardDef.character} (${formatCardId(cardDef.id)}).`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply });
    }

    // Not owned -> wishlist (limit 3)
    if (user.wishlistCards.includes(cardDef.id)) {
      const reply = `${formatCardId(cardDef.id)} is already in your wishlist.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if ((user.wishlistCards || []).length >= 3) {
      const reply = 'You can only wishlist up to 3 cards you do not own.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    user.wishlistCards.push(cardDef.id);
    await user.save();
    const reply = `<:star:1501996419693936843> Added to wishlist: ${cardDef.emoji ? cardDef.emoji + ' ' : ''}${cardDef.character} (${formatCardId(cardDef.id)}).`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply });
  }
};
