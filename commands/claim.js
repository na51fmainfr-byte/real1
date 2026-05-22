const User = require('../models/User');
const { getShipById, updateShipBalance } = require('../utils/cards');

module.exports = {
  name: 'claim',
  description: 'Claim earnings from your active ship',
  options: [
    { name: 'amount', type: 4, description: 'Amount of Beli to claim (leave blank to claim all)', required: false }
  ],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const rawAmount = message ? args[0] : interaction.options.getInteger('amount');
    const user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (!user.activeShip) {
      const reply = 'You do not have an active ship set. Use `op set ship <ship name>` or /setship to choose one.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    updateShipBalance(user);
    const ship = getShipById(user.activeShip);
    if (!ship) {
      const reply = 'Your active ship is invalid. Please set a valid ship again.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const available = Math.floor(user.shipBalance || 0);
    if (available <= 0) {
      const reply = `You have no earnings to claim from **${ship.character}**.`;
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let amount = available;
    if (rawAmount != null && rawAmount !== '') {
      amount = parseInt(rawAmount, 10);
      if (Number.isNaN(amount) || amount <= 0) {
        const reply = 'Please specify a valid amount to claim.';
        if (message) return message.channel.send(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
    }

    if (amount > available) {
      const reply = `You only have **${available}** ¥ available to claim.`;
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    user.balance = (user.balance || 0) + amount;
    user.shipBalance = Math.max(0, (user.shipBalance || 0) - amount);
    await user.save();

    const reply = `Claimed **${amount}** ¥ from **${ship.character}** and added it to your balance!`;
    if (message) return message.channel.send(reply);
    return interaction.reply({ content: reply });
  }
};
