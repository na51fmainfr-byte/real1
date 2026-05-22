const User = require('../models/User');
const { cards } = require('../data/cards');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { rods } = require('../data/rods');
const { applyDefaultEmbedStyle } = require('../utils/embedStyle');
const { PULL_LIMIT } = require('../config');

module.exports = {
  name: 'start',
  description: 'Register an account with the One Piece bot',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const discordUser = message ? message.author : interaction.user;
    let user = await User.findOne({ userId });
    if (user) {
      const reply = 'You already have an account.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Give the starter (first pullable card in dataset)
    const starter = cards.find(c => c.pullable);
    const basicRod = rods.find(r => r.id === 'basic_rod');
    user = new User({
      userId,
      pullsRemaining: PULL_LIMIT,
      lastReset: new Date(),
      pityCount: 0,
      ownedCards: starter ? [{ cardId: starter.id, level: 1, xp: 0 }] : [],
      history: starter ? [starter.id] : [],
      balance: 500,
      resetTokens: 5,
      currentRod: 'basic_rod',
      items: [{ itemId: 'basic_rod', quantity: 1, durability: basicRod.durability }]
    });
    await user.save();

    const embed = new EmbedBuilder()
      .setTitle('Account Created!')
      .setDescription(
        `You received the following rewards:` +
        `\n• ${starter.emoji} **${starter.character}** (starter card)` +
        `\n• ${basicRod.emoji} **${basicRod.name}** (fishing rod)` +
        `\n• <:beri:1490738445319016651> **500** Beli` +
        `\n• <:resettoken:1490738386540171445> **5** Reset Tokens`
      );
    applyDefaultEmbedStyle(embed, discordUser);

    const runTutorialRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_run')
        .setLabel('Start Tutorial')
        .setStyle(ButtonStyle.Primary)
    );

    if (message) {
      await message.channel.send({ embeds: [embed] });
      await message.channel.send({ content: "Would you like to start the tutorial? Click below or run `op tutorial`.", components: [runTutorialRow] });
      return;
    }

    await interaction.reply({ embeds: [embed] });
    await interaction.followUp({ content: "Would you like to start the tutorial? Click below or run `/tutorial`.", components: [runTutorialRow] });
    return;
  }
};
