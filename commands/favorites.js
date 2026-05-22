const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');
const { getCardById, formatCardId } = require('../utils/cards');

module.exports = {
  name: 'favorites',
  description: 'List your favorited cards',
  options: [],
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const user = await User.findOne({ userId });
    if (!user) {
      const reply = "You don't have an account. Run `op start` or /start to register.";
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const favs = (user.favoriteCards || []).map(id => getCardById(id)).filter(Boolean);
    const wishlist = (user.wishlistCards || []).map(id => getCardById(id)).filter(Boolean);

    if (!favs.length && !wishlist.length) {
      const reply = 'You have no favorited cards or wishlist items. Use `op favorite <cardId>` or /favorite to add one.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const favLines = favs.length ? favs.map(c => `<:star:1501996419693936843> ${c.emoji ? c.emoji + ' ' : ''}${c.character} \`${formatCardId(c.id)}\` — ${c.rank}`).join('\n') : 'None';
    const wishLines = wishlist.length ? wishlist.map(c => `<:star:1501996419693936843> ${c.emoji ? c.emoji + ' ' : ''}${c.character} \`${formatCardId(c.id)}\` — ${c.rank}`).join('\n') : 'None';

    const embed = new EmbedBuilder()
      .setTitle("Your Favorites & Wishlist")
      .setColor('#ffffff')
      .addFields(
        { name: 'Favorited', value: favLines, inline: false },
        { name: 'Wishlist (gives +10% within rank)', value: wishLines, inline: false }
      );

    // set author to the invoking user's avatar/username (consistent with other embeds)
    const authorUser = message ? message.author : interaction.user;
    if (authorUser) {
      embed.setAuthor({ name: authorUser.username, iconURL: authorUser.displayAvatarURL() });
    }

    if (message) return message.channel.send({ embeds: [embed] });
    return interaction.reply({ embeds: [embed] });
  }
};
