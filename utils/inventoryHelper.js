const User = require('../models/User');
const { rods } = require('../data/rods');

/**
 * Add (or subtract) an item from a user's inventory.
 * If the user doesn't exist it will be created.
 * If amount is negative and the resulting quantity falls to 0 or below,
 * the item entry will be removed.
 *
 * @param {String} userId
 * @param {String} itemId
 * @param {Number} amount
 * @returns {Promise<void>}
 */
async function addItem(userId, itemId, amount) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({ userId });
  }

  const entry = user.items.find(i => i.itemId === itemId);
  if (entry) {
    entry.quantity += amount;
    if (entry.quantity <= 0) {
      user.items = user.items.filter(i => i.itemId !== itemId);
    }
  } else if (amount > 0) {
    user.items.push({ itemId, quantity: amount });
  }

  await user.save();
}

function sanitizeUserRods(user) {
  if (!user || !Array.isArray(user.items)) return false;

  const rodIds = rods.map(r => r.id);
  const otherItems = user.items.filter(it => !rodIds.includes(it.itemId));
  let rodChanged = false;

  const rodEntries = user.items.filter(
    it => rodIds.includes(it.itemId) && typeof it.durability === 'number' && it.durability > 0
  );
  let currentRodEntry = rodEntries.find(it => it.itemId === user.currentRod);

  if (!currentRodEntry && rodEntries.length > 0) {
    currentRodEntry = rodEntries.sort((a, b) => b.durability - a.durability)[0];
    user.currentRod = currentRodEntry.itemId;
    rodChanged = true;
  }

  if (currentRodEntry) {
    if (currentRodEntry.quantity !== 1) {
      currentRodEntry.quantity = 1;
      rodChanged = true;
    }
    otherItems.push(currentRodEntry);
    if (rodEntries.length > 1) {
      rodChanged = true;
    }
  }

  user.items = otherItems;

  if (!currentRodEntry) {
    user.currentRod = null;
  }

  return rodChanged;
}

async function normalizeAllUserRods() {
  const users = await User.find({ 'items.itemId': { $in: rods.map(r => r.id) } });
  let updatedCount = 0;
  for (const user of users) {
    if (sanitizeUserRods(user)) {
      await user.save();
      updatedCount += 1;
    }
  }
  return updatedCount;
}

module.exports = { addItem, sanitizeUserRods, normalizeAllUserRods };
