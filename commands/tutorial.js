const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const { cards } = require('../data/cards');

const PAGES = [
  'https://files.catbox.moe/gei6qs.webp',
  'https://files.catbox.moe/148uzg.webp',
  'https://files.catbox.moe/82xbs1.webp',
  'https://files.catbox.moe/6c3zyo.webp',
  'https://files.catbox.moe/4gn5gz.webp',
  'https://files.catbox.moe/mo47w5.webp',
  'https://files.catbox.moe/yix6et.webp',
  'https://files.catbox.moe/xlqlsp.webp',
  'https://files.catbox.moe/li9m6e.webp',
  'https://files.catbox.moe/fw9zql.webp',
  'https://files.catbox.moe/2qz23f.webp',
  'https://files.catbox.moe/6rz8ge.webp'
];

// pages are sent as plain image messages (URL content), not embeds

function buildComponentsForPage(index) {
  const components = [];
  if (index < PAGES.length - 1) {
    const next = new ButtonBuilder()
      .setCustomId(`tutorial_nav:${index + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary);

    // 4th image (index 3) includes 'about effectiveness' button
    if (index === 3) {
      const about = new ButtonBuilder()
        .setCustomId(`tutorial_about:${index}`)
        .setLabel('about effectiveness')
        .setStyle(ButtonStyle.Primary);
      components.push(new ActionRowBuilder().addComponents(next, about));
    } else {
      components.push(new ActionRowBuilder().addComponents(next));
    }
  } else {
    // last page: show support server link button only
    const support = new ButtonBuilder()
      .setLabel('support server')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/z8bDjhYZE5');
    components.push(new ActionRowBuilder().addComponents(support));
  }
  return components;
}

module.exports = {
  name: 'tutorial',
  description: 'Send tutorial images via DM',

  async execute({ message, interaction }) {
    const user = message ? message.author : interaction.user;
    const userId = user.id;

    // Initialize session store
    if (!global.tutorialSessions) global.tutorialSessions = new Map();

    // Try to DM the user the first page (send image inside a blank embed)
      const components = buildComponentsForPage(0);
    try {
        const firstEmbed = new EmbedBuilder().setImage(PAGES[0]);
        const dmMessage = await user.send({ embeds: [firstEmbed], components });
      const session = { userId, pages: PAGES, current: 0, lastMessageId: dmMessage.id };
      global.tutorialSessions.set(`${userId}_tutorial`, session);

      if (message) return message.channel.send("Sent tutorial in DM's!");
      return interaction.reply({ content: "Sent tutorial in DM's!", ephemeral: true });
    } catch (err) {
      if (message) return message.channel.send('I could not DM you. Please enable DMs and try again.');
      return interaction.reply({ content: 'I could not DM you. Please enable DMs and try again.', ephemeral: true });
    }
  },

  async handleButton(interaction, customId) {
    const parts = customId.split(':');
    const action = parts[0];
    const arg = parts[1];
    const sessionKey = `${interaction.user.id}_tutorial`;
    const session = global.tutorialSessions?.get(sessionKey);
    if (!session || session.userId !== interaction.user.id) {
      return interaction.reply({ content: 'Tutorial session expired or not your session.', ephemeral: true });
    }

    // ABOUT button on 4th image
    if (action === 'tutorial_about') {
      await interaction.deferUpdate();
      try {
        const channel = interaction.channel;
        const lastMsg = await channel.messages.fetch(session.lastMessageId || interaction.message.id);
        const aboutEmbed = new EmbedBuilder()
          .setColor('#FFFFFF')
          .setDescription(`**How it works**\nThe characters in the game have five different types:\n\n<:STR:1490476222755639476> STR\n<:DEX:1490476443946188952> DEX\n<:QCK:1490476238593331291> QCK\n<:PSY:1490476369472127166> PSY\n<:INT:1490476207601483816> INT\n\nSTR is strong against DEX, DEX against QCK, and QCK against STR! PSY and INT are both weak against each other!\n\nStrong means that characters ATK power is doubled. Weak means it is halved.`)
          .setImage('https://static.wikia.nocookie.net/onepiecetreasurecruiseglobal/images/1/1b/TypeMatchups.png/revision/latest?cb=20150306203122');
        await lastMsg.reply({ embeds: [aboutEmbed] });
      } catch (err) {
        console.error('tutorial about error', err);
        return interaction.followUp({ content: 'Could not send info.', ephemeral: true });
      }
      return;
    }

    // NAVIGATION button
    if (action === 'tutorial_nav') {
      const target = parseInt(arg, 10);
      if (isNaN(target)) return interaction.reply({ content: 'Invalid tutorial page.', ephemeral: true });
      const newIndex = Math.max(0, Math.min(session.pages.length - 1, target));
      session.current = newIndex;
      global.tutorialSessions.set(sessionKey, session);

      await interaction.deferUpdate();
      try {
        const channel = interaction.channel;
        const lastMsg = await channel.messages.fetch(session.lastMessageId || interaction.message.id);

        // Remove components from previous message so its Next button disappears
        try {
          await lastMsg.edit({ components: [] });
        } catch (err) {
          // ignore edit failures
        }

        const components = buildComponentsForPage(newIndex);
        const pageEmbed = new EmbedBuilder().setImage(PAGES[newIndex]);
        const newMsg = await lastMsg.reply({ embeds: [pageEmbed], components });
        session.lastMessageId = newMsg.id;
        global.tutorialSessions.set(sessionKey, session);

        // If this is the last page, award dingy if it's the user's first time
        if (newIndex >= session.pages.length - 1) {
          try {
            const userDoc = await User.findOne({ userId: interaction.user.id });
            if (userDoc && !userDoc.tutorialCompleted) {
              userDoc.tutorialCompleted = true;
              // grant s002 ship if not owned
              const hasDingy = (userDoc.ownedCards || []).some(e => e.cardId === 's002');
              if (!hasDingy) {
                userDoc.ownedCards = userDoc.ownedCards || [];
                userDoc.ownedCards.push({ cardId: 's002', level: 1, xp: 0 });
                userDoc.ships = userDoc.ships || {};
                const dingyDef = cards.find(c => c.id === 's002');
                if (dingyDef) {
                  userDoc.ships['s002'] = { cola: dingyDef.cola || 0, maxCola: dingyDef.maxCola || dingyDef.cola || 0 };
                }
              }
              await userDoc.save();

              const rewardEmbed = new EmbedBuilder()
                .setColor('#c48647')
                .setDescription('you received **Dingy** for completing the tutorial!')
                .setThumbnail('https://one-piece-artworks.com/app/view/assets/img/FgcKFSZ');
              await newMsg.reply({ embeds: [rewardEmbed] });
            }
          } catch (err) {
            console.error('Error awarding dingy', err);
          }
        }

        return;
      } catch (err) {
        console.error('tutorial nav error', err);
        return interaction.followUp({ content: 'Could not send tutorial page.', ephemeral: true });
      }
    }

    return interaction.reply({ content: 'Unknown tutorial action.', ephemeral: true });
  }
};
