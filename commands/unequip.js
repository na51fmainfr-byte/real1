const User = require('../models/User');
const { searchCards } = require('../utils/cards');

function findArtifactCard(query) {
  if (!query) return null;
  const results = searchCards(query).filter(c => c.artifact);
  return results.length ? results[0] : null;
}

module.exports = {
  name: 'unequip',
  description: 'Unequip an artifact from its current card',
  options: [
    { name: 'artifact', type: 3, description: 'Artifact name', required: true }
  ],
  async execute({ message, interaction, args }) {
    const isInteraction = Boolean(interaction);
    const userId = isInteraction ? interaction.user.id : message.author.id;
    const artifactQuery = isInteraction ? interaction.options.getString('artifact') : args.join(' ');

    const reply = (content) => {
      if (message) return message.reply(content);
      return interaction.reply({ content, ephemeral: true });
    };

    if (!artifactQuery) return reply('Please state an artifact.');

    const user = await User.findOne({ userId });
    if (!user) {
      return reply('You don\'t have an account. Run `op start` or /start to register.');
    }

    const artifactDef = findArtifactCard(artifactQuery);
    if (!artifactDef) {
      return reply(`**${artifactQuery}** is not a vaild artifact name.`);
    }

    const artifactEntry = user.ownedCards.find(e => e.cardId === artifactDef.id);
    if (!artifactEntry) {
      return reply(`You don't own **${artifactDef.character}**.`);
    }

    if (!artifactEntry.equippedTo) {
      return reply(`**${artifactDef.character}** is not currently equipped to any card.`);
    }

    const currentCard = require('../data/cards').cards.find(c => c.id === artifactEntry.equippedTo);
    artifactEntry.equippedTo = null;
    await user.save();

    const currentName = currentCard ? `${currentCard.emoji ? `${currentCard.emoji} ` : ''}${currentCard.character}`.trim() : 'Unknown card';
    return reply(`Successfully unequiped **${artifactDef.character}** from **${currentName}**!`);
  }
};
