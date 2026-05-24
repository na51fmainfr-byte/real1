const { EmbedBuilder } = require('discord.js');
const { getStockCountdownString, getPullCountdownString } = require('../src/stock');
const User = require('../models/User');

const VOTE_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const ROB_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function formatTimeLeft(ms) {
  if (ms <= 0) return 'Available!';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
  name: 'timers',
  description: 'View all global and user timers',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const now = new Date();

    // Global timers
    const stockTimer = getStockCountdownString();
    const pullTimer = getPullCountdownString();

    // User timers
    const bountyTime = user.bountyCooldownUntil ? user.bountyCooldownUntil - now : 0;
    const dailyTime = user.lastDaily ? (user.lastDaily.getTime() + 24 * 60 * 60 * 1000) - now : 0;
    const triviaTime = user.triviaCooldownUntil ? user.triviaCooldownUntil - now : 0;
    const lootTime = user.lootCooldownUntil ? user.lootCooldownUntil - now : 0;
    const gambleTime = user.gambleCooldownUntil ? user.gambleCooldownUntil - now : 0;
    const robTime = user.robCooldownUntil ? user.robCooldownUntil - now : 0;
    const voteTime = user.lastVoted ? (user.lastVoted.getTime() + VOTE_COOLDOWN_MS) - now : 0;

    const userTimers = [
      `Bounty: ${formatTimeLeft(bountyTime)}`,
      `Daily: ${formatTimeLeft(dailyTime)}`,
      `Rob: ${formatTimeLeft(robTime)}`,
      `Trivia: ${formatTimeLeft(triviaTime)}`,
      `Vote: ${formatTimeLeft(voteTime)}`,
      `Gamble: ${formatTimeLeft(gambleTime)}`,
    ].join('\n');

    const embed = new EmbedBuilder()
      .setTitle('<:timer:1489385667858268301> Timers')
      .addFields(
        { name: '**Global timers**', value: `Pull reset: ${pullTimer}\nStock Reset: ${stockTimer}`, inline: false },
        { name: '**User timers**', value: userTimers, inline: false }
      )
      .setColor('#2b2d31');

    if (message) return message.channel.send({ embeds: [embed] });
    return interaction.reply({ embeds: [embed] });
  }
};
