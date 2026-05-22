const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');

const VOTE_URL = 'https://top.gg/bot/1461800991677481173/vote';
const VOTE_COOLDOWN_MS = 12 * 60 * 60 * 1000; // top.gg allows votes every 12 hours

module.exports = {
  name: 'vote',
  description: 'Vote for the bot on top.gg and claim rewards',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;

    let user = await User.findOne({ userId });

    const now = Date.now();
    let cooldownText = 'Available!';
    let streakCount = user ? (user.voteStreak || 0) : 0;

    if (user && user.lastVoted) {
      const elapsed = now - new Date(user.lastVoted).getTime();
      const remaining = VOTE_COOLDOWN_MS - elapsed;
      if (remaining > 0) {
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        cooldownText = `Available in **${hours}h ${minutes}m**`;
      }
    }

    const nextStreakBonus = 5 - ((streakCount % 5) || 5);
    const streakFooter = nextStreakBonus === 0
      ? `Your current vote streak: ${streakCount} — You get a god token every 5 vote streak!`
      : `Your current vote streak: ${streakCount} — ${nextStreakBonus} more vote(s) until a God Token bonus!`;

    const embed = new EmbedBuilder()
      .setColor('#FFFFFF')
      .setDescription(
        `**Vote for us on top.gg!**\nVote for the bot to get <:resettoken:1490738386540171445> 1x Reset Token and 1x Random <:Cchest:1492559506868146307> Chest!\n\n**Vote cooldown**\n${cooldownText}`
      )
      .setFooter({ text: streakFooter });

    if (message && message.client.user) {
      embed.setThumbnail(message.client.user.displayAvatarURL());
    } else if (interaction && interaction.client.user) {
      embed.setThumbnail(interaction.client.user.displayAvatarURL());
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Vote')
        .setURL(VOTE_URL)
        .setStyle(ButtonStyle.Link)
    );

    if (message) return message.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
