const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { searchCards } = require('../utils/cards');
const User = require('../models/User');

function makeComponents(cardDef) {
  const prevAvailable = cardDef.mastery > 1;
  const nextAvailable = cardDef.mastery < cardDef.mastery_total;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mastery_prev:${cardDef.id}`)
      .setLabel('Previous')
      .setStyle(prevAvailable ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!prevAvailable),
    new ButtonBuilder()
      .setCustomId(`mastery_next:${cardDef.id}`)
      .setLabel('Next')
      .setStyle(nextAvailable ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!nextAvailable)
  );
}

module.exports = {
  name: 'card',
  description: 'Lookup a card by name',
  options: [{ name: 'query', type: 3, description: 'Card name', required: true }],
  async execute({ message, interaction, args }) {
    const query = message ? args.join(' ') : interaction.options.getString('query');
    const results = searchCards(query);
    if (!results.length) {
      const reply = `No card found matching **${query}**.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }
    const cardDef = results[0];

    // find user state
    let userEntry = null;
    let userDoc = null;
    if (message || interaction) {
      const userId = message ? message.author.id : interaction.user.id;
      const user = await User.findOne({ userId });
      if (user) {
        userDoc = user;
        userEntry = user.ownedCards.find(e => e.cardId === cardDef.id);
      }
    }

    const avatarUrl = message ? message.author.displayAvatarURL() : interaction.user.displayAvatarURL();
    const { buildCardEmbed } = require('../utils/cards');
    const embed = buildCardEmbed(cardDef, userEntry, avatarUrl, userDoc);
    const components = [makeComponents(cardDef)];

    if (message) return message.channel.send({ embeds: [embed], components });
    return interaction.reply({ embeds: [embed], components });
  }
};

// export helper so other commands (info) can reuse the mastery navigation
module.exports.makeComponents = makeComponents;