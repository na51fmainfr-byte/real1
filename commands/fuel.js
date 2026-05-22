const User = require('../models/User');
const { findBestOwnedShip, getShipById } = require('../utils/cards');

module.exports = {
  name: 'fuel',
  description: 'Consume Cola items to refill a ship\'s Cola (supports bulk amount in prefix mode)',
  options: [{ name: 'ship', type: 3, description: 'Ship name (optional; uses active ship if omitted)', required: false }],
  async execute({ message, interaction, args }) {
    const userId = message ? message.author.id : interaction.user.id;
    let quantity = 1;
    let shipQuery = '';

    if (message) {
      const rawArgs = args || [];
      if (rawArgs.length > 0) {
        const lastArg = String(rawArgs[rawArgs.length - 1]).toLowerCase();
        const parsedNumber = Number(lastArg);
        if (lastArg === 'all' || (!Number.isNaN(parsedNumber) && parsedNumber > 0)) {
          quantity = lastArg === 'all' ? 'all' : parsedNumber;
          shipQuery = rawArgs.slice(0, -1).join(' ').trim();
        } else {
          shipQuery = rawArgs.join(' ').trim();
        }
      }
    } else {
      shipQuery = interaction.options.getString('ship') || '';
    }

    let user = await User.findOne({ userId });
    if (!user) {
      const reply = "You don't have an account. Run `op start` or /start to register.";
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Resolve ship preference:
    // 1) explicit query -> findBestOwnedShip
    // 2) user's activeShip if they actually own it
    // 3) prefer a ship on the team
    // 4) prefer a favorited ship
    // 5) fallback to any owned ship
    let shipDef = null;
    if (shipQuery) {
      shipDef = await findBestOwnedShip(userId, shipQuery);
    }

    // If no explicit match, prefer the active ship if user owns it
    if (!shipDef && user.activeShip) {
      const owned = (user.ownedCards || []).some(e => e.cardId === user.activeShip);
      if (owned) {
        shipDef = getShipById(user.activeShip) || null;
      }
    }

    // If still not found, try to pick a ship from the user's team (if any)
    if (!shipDef && Array.isArray(user.team) && user.team.length) {
      for (const tid of user.team) {
        const maybe = getShipById(tid);
        if (maybe && (user.ownedCards || []).some(e => e.cardId === maybe.id)) {
          shipDef = maybe;
          break;
        }
      }
    }

    // Next prefer any favorited ship
    if (!shipDef && Array.isArray(user.favoriteCards) && user.favoriteCards.length) {
      for (const fid of user.favoriteCards) {
        const maybe = getShipById(fid);
        if (maybe && (user.ownedCards || []).some(e => e.cardId === maybe.id)) {
          shipDef = maybe;
          break;
        }
      }
    }

    // Finally fallback to any owned ship (highest mastery/last entry)
    if (!shipDef) {
      const ownedShipIds = (user.ownedCards || []).map(e => e.cardId).filter(id => getShipById(id));
      if (ownedShipIds.length) {
        // prefer the last one (highest mastery style) unless otherwise matched
        shipDef = getShipById(ownedShipIds[ownedShipIds.length - 1]);
      }
    }

    if (!shipDef) {
      const reply = 'Please set a ship first.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Enforce ownership and active-ship restriction:
    // - If the user has an active ship they own, only allow fueling that active ship.
    // - Otherwise ensure the selected ship is owned by the user.
    const ownsActive = user.activeShip && (user.ownedCards || []).some(e => e.cardId === user.activeShip);
    if (ownsActive) {
      // Only allow fueling the active ship
      if (shipDef.id !== user.activeShip) {
        const activeDef = getShipById(user.activeShip) || shipDef;
        const reply = `You can only fuel your active ship (${activeDef.character}). Use \`op setship\` to change your active ship.`;
        if (message) return message.reply(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
      // ensure we are using the canonical active shipDef
      shipDef = getShipById(user.activeShip) || shipDef;
    } else {
      const ownsShip = (user.ownedCards || []).some(e => e.cardId === shipDef.id);
      if (!ownsShip) {
        const reply = `You don't own **${shipDef.character}**.`;
        if (message) return message.reply(reply);
        return interaction.reply({ content: reply, ephemeral: true });
      }
    }

    // Check cola item in inventory
    user.items = user.items || [];
    const colaEntry = user.items.find(it => it.itemId === 'cola');
    if (!colaEntry || (colaEntry.quantity || 0) <= 0) {
      const reply = 'You have no <:cola:1494106165955792967> Cola to fuel with.';
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const requestedAmount = quantity === 'all' ? colaEntry.quantity : quantity;
    const fuelAmount = Math.max(0, Math.min(requestedAmount, colaEntry.quantity));

    // ensure per-user ship state exists; determine a sane default maxCola
    user.ships = user.ships || {};
    const defaultMaxCola = (shipDef && shipDef.maxCola !== undefined) ? shipDef.maxCola : ((shipDef && shipDef.cola !== undefined) ? shipDef.cola : 0);
    user.ships[shipDef.id] = user.ships[shipDef.id] || { cola: 0, maxCola: defaultMaxCola };

    const maxCola = (user.ships[shipDef.id].maxCola !== undefined) ? user.ships[shipDef.id].maxCola : defaultMaxCola;
    const before = (user.ships[shipDef.id].cola !== undefined) ? user.ships[shipDef.id].cola : 0;
    if (before >= maxCola) {
      await user.save();
      const reply = `**${shipDef.character}** already has full Cola (${before}/${maxCola}).`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    const amountToFuel = Math.min(fuelAmount, maxCola - before);
    if (amountToFuel <= 0) {
      const reply = `**${shipDef.character}** already has full Cola (${before}/${maxCola}).`;
      if (message) return message.reply(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    colaEntry.quantity -= amountToFuel;
    if (colaEntry.quantity <= 0) {
      user.items = user.items.filter(it => it.itemId !== 'cola');
    }

    user.ships[shipDef.id].cola = before + amountToFuel;
    if (typeof user.markModified === 'function') {
      user.markModified('ships');
      user.markModified('items');
    }
    await user.save();

    const reply = `Fueled **${shipDef.character}** with <:cola:1494106165955792967> +${amountToFuel}. Current Cola: ${user.ships[shipDef.id].cola}/${maxCola}`;
    if (message) return message.reply(reply);
    return interaction.reply({ content: reply });
  }
};
