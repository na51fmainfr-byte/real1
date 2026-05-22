const { EmbedBuilder } = require('discord.js');
const User = require('../models/User');

const COOLDOWN_MS = 60 * 60 * 1000;
const VALID_GUESSES = {
  heads: 'heads',
  head: 'heads',
  h: 'heads',
  tails: 'tails',
  tail: 'tails',
  t: 'tails'
};

function formatRelativeTime(futureDate) {
  const now = new Date();
  const diff = futureDate - now;
  if (diff <= 0) return 'now';
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.ceil((diff % (60 * 1000)) / 1000);
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function parseGuess(rawGuess) {
  if (!rawGuess) return null;
  return VALID_GUESSES[rawGuess.toLowerCase()] || null;
}

function parseAmount(rawAmount) {
  if (rawAmount == null) return 100;
  const cleaned = String(rawAmount).replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  return parseInt(cleaned, 10);
}

function buildPendingMessage() {
  return '<a:loading:1491595708351123659> **Flipping...**';
}

function buildResultMessage(guess, result, amount) {
  const won = result === guess;
  const descriptionLines = [];
  if (won) {
    descriptionLines.push('**<a:duel:1489629183725408266> You guessed right!**');
  } else {
    descriptionLines.push('**<a:robbed:1491597478565384312> You guessed wrong!**');
  }
  descriptionLines.push(`The coin landed on **${result.toUpperCase()}.**`);
  descriptionLines.push(won
    ? `You won <:beri:1490738445319016651>${amount}.`
    : `You lost <:beri:1490738445319016651>${amount}, Better luck next time.`
  );
  return descriptionLines.join('\n');
}

function buildReply(message, interaction) {
  if (message) {
    return {
      reply: (content) => message.channel.send(content),
      sendPending: () => message.channel.send(buildPendingMessage()),
      editReply: (pendingMessage, content) => pendingMessage.edit(content)
    };
  }

  return {
    reply: (content, ephemeral = true) => interaction.reply({ content, ephemeral }),
    sendPending: () => interaction.reply({ content: buildPendingMessage(), fetchReply: true }),
    editReply: (pendingMessage, content) => interaction.editReply({ content })
  };
}

module.exports = {
  name: 'bet',
  description: 'Flip a coin and bet Beli on heads or tails',
  options: [
    { name: 'guess', type: 3, description: 'Choose heads or tails', required: true, choices: [
      { name: 'heads', value: 'heads' },
      { name: 'tails', value: 'tails' }
    ] },
    { name: 'amount', type: 4, description: 'Amount of Beli to bet (minimum 100)', required: false, min_value: 100 }
  ],

  async execute({ message, interaction, args }) {
    const replyUtils = buildReply(message, interaction);
    const userId = message ? message.author.id : interaction.user.id;

    const user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      return replyUtils.reply(reply);
    }

    let guess = null;
    let amount = 100;

    if (interaction) {
      guess = interaction.options.getString('guess');
      amount = interaction.options.getInteger('amount') || 100;
    } else {
      guess = args?.[0];
      if (args?.[1]) {
        amount = parseAmount(args[1]);
        if (amount === null) {
          return replyUtils.reply('Please provide a valid bet amount.');
        }
      } else {
        amount = 100;
      }
    }

    guess = parseGuess(guess);
    if (!guess) {
      return replyUtils.reply('Please choose `heads` or `tails` as your guess.');
    }

    if (amount < 100) {
      return replyUtils.reply('Minimum bet is `100` Beli.');
    }

    const balance = Math.max(user.balance || 0, 0);
    if (balance < amount) {
      return replyUtils.reply(`You need at least **<:beri:1490738445319016651>${amount}** to place that bet.`);
    }

    const now = new Date();
    if (user.betCooldownUntil && user.betCooldownUntil > now) {
      const remaining = formatRelativeTime(user.betCooldownUntil);
      return replyUtils.reply(`You must wait another \`${remaining}\` before betting again.`);
    }

    user.betCooldownUntil = new Date(Date.now() + COOLDOWN_MS);

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === guess;
    user.balance = won ? (balance + amount) : Math.max(balance - amount, 0);
    await user.save();

    const pendingMessage = await replyUtils.sendPending();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const resultText = buildResultMessage(guess, result, amount);
    return replyUtils.editReply(pendingMessage, resultText);
  }
};
