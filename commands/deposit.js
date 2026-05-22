const User = require('../models/User');
const { getCardById, updateShipBalance } = require('../utils/cards');

module.exports = {
  name: 'deposit',
  description: 'Deposit Beli into your active ship',
  options: [{ name: 'amount', type: 4, description: 'Amount of Beli to deposit', required: true }],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const amount = interaction
      ? interaction.options.getInteger('amount')
      : parseInt(args[0], 10);

    if (!amount || isNaN(amount) || amount <= 0) {
      const reply = 'Please specify a valid amount of Beli to deposit.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (!user.activeShip) {
      const reply = 'You do not have an active ship set. Use `op set ship <ship name>` or /setship to choose one.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const ship = getCardById(user.activeShip);
    if (!ship || !ship.ship) {
      const reply = 'Your active ship is invalid. Please set a valid ship again.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    updateShipBalance(user);
    if (user.balance < amount) {
      const reply = 'You do not have enough Beli to deposit that amount.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (user.shipBalance >= ship.capacity) {
      const reply = `**${ship.character}** is already at maximum capacity.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const depositAmount = Math.min(amount, ship.capacity - user.shipBalance);
    user.balance -= depositAmount;
    user.shipBalance += depositAmount;
    user.shipLastUpdated = new Date();
    await user.save();

    const reply = `Deposited **${depositAmount}** <:beri:1490738445319016651> into **${ship.character}**. Ship balance is now **${user.shipBalance}**/${ship.capacity}.`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply });
  }
};
