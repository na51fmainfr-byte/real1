const User = require('../models/User');
const { findBestOwnedShip, updateShipBalance } = require('../utils/cards');

module.exports = {
  name: 'setship',
  description: 'Set your active ship for passive income',
  options: [{ name: 'ship', type: 3, description: 'Ship name', required: true }],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    const shipName = interaction
      ? interaction.options.getString('ship')
      : (args[0] && args[0].toLowerCase() === 'ship' ? args.slice(1).join(' ') : args.join(' '));

    if (!shipName) {
      const reply = 'Please specify a ship name.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Refresh ship balance before allowing a switch. Prevent switching if
    // there is unclaimed money in the currently active ship.
    try {
      updateShipBalance(user);
      if (typeof user.shipBalance === 'number' && user.shipBalance > 0) {
        const reply = 'Claim the beli from your current ship before switching ships!';
        if (message) return message.reply(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
    } catch (err) {
      // if update fails, continue cautiously
      console.error('Failed to refresh ship balance before switching:', err);
    }

    const ship = await findBestOwnedShip(userId, shipName);
    if (!ship || !ship.ship) {
      const reply = `No ship found matching **${shipName}**.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const ownsShip = user.ownedCards.some(e => e.cardId === ship.id);
    if (!ownsShip) {
      const reply = `You don't own **${ship.character}**.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    if (user.activeShip === ship.id) {
      const reply = `**${ship.character}** is already your active ship.`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    updateShipBalance(user);
    user.activeShip = ship.id;
    user.shipBalance = 0;
    user.shipLastUpdated = new Date();
    user.ships = user.ships || {};
    if (!user.ships[ship.id]) {
      const max = (ship.maxCola !== undefined ? ship.maxCola : (ship.cola !== undefined ? ship.cola : 0));
      user.ships[ship.id] = { cola: max, maxCola: max };
    }
    await user.save();

    const reply = `Set **${ship.character}** as your active ship. Current ship balance is **${user.shipBalance}** <:beri:1490738445319016651>.`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply });
  }
};
