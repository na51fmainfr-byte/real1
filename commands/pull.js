const User = require('../models/User');
const { cards } = require('../data/cards');
const { PULL_LIMIT, PULL_RESET_HOURS, PULL_RATES, PITY_TARGET, PITY_DISTRIBUTION } = require('../config');
const { buildPullEmbed, getAllCardVersions, getCardById, pickFromPoolWithWishlist, applyXpToEquippedArtifact } = require('../utils/cards');
const stockUtils = require('../src/stock');
const getPreviousPullResetDate = stockUtils.getPreviousPullResetDate;
const getTimeUntilNextPullReset = stockUtils.getTimeUntilNextPullReset;

module.exports = {
  name: 'pull',
  description: 'Pull a random card',
  async execute({ message, interaction }) {
    const userId = message ? message.author.id : interaction.user.id;
    const username = message ? message.author.username : interaction.user.username;
    let user = await User.findOne({ userId });
    if (!user) {
      const reply = 'You don\'t have an account. Run `op start` or /start to register.';
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // Reset logic using global pull timer
    const now = new Date();
    if (typeof user.pullsRemaining !== 'number' || isNaN(user.pullsRemaining)) {
      user.pullsRemaining = PULL_LIMIT;
    }
    if (!user.lastReset || !(user.lastReset instanceof Date)) {
      user.lastReset = now;
    }

    const lastResetBoundary = getPreviousPullResetDate();
    if (user.lastReset < lastResetBoundary) {
      user.pullsRemaining = PULL_LIMIT;
      user.lastReset = lastResetBoundary;
      await user.save(); // Save immediately to avoid race conditions
    }

    if (user.pullsRemaining <= 0) {
      const diffMs = getTimeUntilNextPullReset();
      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
      const timeStr = `${hrs}h ${mins}m ${secs}s`;
      const reply = `you've used all ${PULL_LIMIT} pulls. Next reset in \`${timeStr}\``;
      if (message) return message.channel.send(reply);
      return interaction.reply({ content: reply, ephemeral: true });
    }

    // determine category first (Cards / Artifacts / Ships) then roll rank per-category
    // Category weights (treated as relative weights and normalized)
    // Use percentages: cards 97%, artifacts 2%, ships 1%
    const CATEGORY_WEIGHTS = { cards: 97, artifacts: 2, ships: 1 };
    const CARD_RATES = { D: 45, C: 30, B: 16, A: 7.6, S: 2.2, SS: 0.5, UR: 0.05 };
    const ARTIFACT_SHIP_RATES = { D: 30, C: 30, B: 20, A: 12, S: 8 };

    let rank;
    let pityTriggered = false;
    let category = 'cards';
    // Atomically claim pity for prefix pulls to avoid two quick pulls both consuming pity
    let pityClaimed = false;
    if (message && PITY_TARGET && (user.pityCount || 0) >= PITY_TARGET) {
      try {
        const claimed = await User.findOneAndUpdate(
          { userId, pityCount: { $gte: PITY_TARGET } },
          { $set: { pityCount: 0 } },
          { new: true }
        );
        if (claimed) {
          pityClaimed = true;
          user.pityCount = 0;
        }
      } catch (e) {
        console.error('Error claiming pity for user', userId, e);
      }
    }

    // If pity was successfully claimed, force an SS card from the card pool
    if (message && pityClaimed) {
      rank = 'SS';
      category = 'cards';
      pityTriggered = true;
    } else {
      // choose category by weights (normalize in case they don't sum to 100)
      const catTotal = Object.values(CATEGORY_WEIGHTS).reduce((s, v) => s + v, 0) || 1;
      let rc = Math.random() * catTotal;
      for (const [k, w] of Object.entries(CATEGORY_WEIGHTS)) {
        rc -= w;
        if (rc <= 0) { category = k; break; }
      }

      // pick rank according to selected category's distribution
      const pickFromDist = (dist) => {
        const total = Object.values(dist).reduce((s, v) => s + v, 0) || 1;
        let r = Math.random() * total;
        for (const [rk, pct] of Object.entries(dist)) {
          r -= pct;
          if (r <= 0) return rk;
        }
        return Object.keys(dist)[Object.keys(dist).length - 1];
      };

      if (category === 'cards') rank = pickFromDist(CARD_RATES);
      else rank = pickFromDist(ARTIFACT_SHIP_RATES);

      // increment pity for prefix pulls only when we did not atomically claim pity
      if (message) user.pityCount = (user.pityCount || 0) + 1;
    }

    const pityProgress = message ? `Pity: ${user.pityCount}/${PITY_TARGET}` : '';

    // select card from pool matching category and rank with category-safe fallbacks
    const pullable = cards.filter(c => c.pullable);
    let pool = [];
    if (category === 'cards') {
      // prefer non-ship, non-artifact cards of the given rank
      pool = pullable.filter(c => c.rank === rank && !c.ship && !c.artifact);
      // fallback: any non-ship/non-artifact regardless of rank
      if (!pool || pool.length === 0) pool = pullable.filter(c => !c.ship && !c.artifact);
    } else if (category === 'artifacts') {
      // prefer artifacts of the given rank
      pool = pullable.filter(c => c.rank === rank && c.artifact);
      // fallback: any artifact regardless of rank
      if (!pool || pool.length === 0) pool = pullable.filter(c => c.artifact);
    } else if (category === 'ships') {
      // prefer ships of the given rank
      pool = pullable.filter(c => c.rank === rank && c.ship);
      // fallback: any ship regardless of rank
      if (!pool || pool.length === 0) pool = pullable.filter(c => c.ship);
    }

    // final fallback: anything pullable (should be very rare)
    if (!pool || pool.length === 0) pool = pullable;

    const card = pickFromPoolWithWishlist(pool, user.wishlistCards);

    // Get all versions in this card group
    const allVersionIds = getAllCardVersions(card);
    
    // Find if user owns any version in this card group
    let bestOwnedEntry = null;
    let bestOwnedId = null;
    for (const versionId of allVersionIds) {
      const entry = user.ownedCards.find(e => e.cardId === versionId);
      if (entry) {
        bestOwnedEntry = entry;
        bestOwnedId = versionId;
      }
    }

    let duplicateText = '';
    
    if (bestOwnedEntry && bestOwnedId) {
      // User owns some version of this character
      const bestOwnedCard = getCardById(bestOwnedId);
      const pulledCard = getCardById(card.id);
      
      if (pulledCard.mastery < bestOwnedCard.mastery) {
        bestOwnedEntry.xp = (bestOwnedEntry.xp || 0) + 100;
        applyXpToEquippedArtifact(user, bestOwnedEntry, 100);
        const gained = Math.floor(bestOwnedEntry.xp / 100);
        if (gained > 0) {
          bestOwnedEntry.level = (bestOwnedEntry.level || 1) + gained;
          bestOwnedEntry.xp = bestOwnedEntry.xp % 100;
        }
        duplicateText = `+100 XP`;
      } else if (pulledCard.mastery === bestOwnedCard.mastery) {
        bestOwnedEntry.xp = (bestOwnedEntry.xp || 0) + 100;
        applyXpToEquippedArtifact(user, bestOwnedEntry, 100);
        const gained = Math.floor(bestOwnedEntry.xp / 100);
        if (gained > 0) {
          bestOwnedEntry.level = (bestOwnedEntry.level || 1) + gained;
          bestOwnedEntry.xp = bestOwnedEntry.xp % 100;
        }
        duplicateText = `+100 XP`;
      } else {
        // Pulled a higher version than what they own
        const bestOwnedIdVal = bestOwnedId; // id of version they currently have
        // check if the card on team prevents upgrade
        if (user.team && user.team.includes(bestOwnedIdVal)) {
          bestOwnedEntry.xp = (bestOwnedEntry.xp || 0) + 100;
          applyXpToEquippedArtifact(user, bestOwnedEntry, 100);
          const gained = Math.floor(bestOwnedEntry.xp / 100);
          if (gained > 0) {
            bestOwnedEntry.level = (bestOwnedEntry.level || 1) + gained;
            bestOwnedEntry.xp = bestOwnedEntry.xp % 100;
          }
          duplicateText = `+100 XP`;
        } else {
          // normal upgrade: add new version and remove lower ones
          user.ownedCards = user.ownedCards || [];
          if (!user.ownedCards.some(e => e.cardId === card.id)) {
            user.ownedCards.push({ cardId: card.id, level: 1, xp: 0 });
          }
          // Remove all lower versions of this character
          user.ownedCards = user.ownedCards.filter(e => {
            const eCard = getCardById(e.cardId);
            if (!eCard || eCard.character !== card.character) return true;
            return eCard.mastery >= card.mastery;
          });
          if (!user.history.includes(card.id)) user.history.push(card.id);
          duplicateText = `Upgraded! Higher version acquired. Lower versions removed.`;
        }
      }
    } else {
      // Don't own any version - add this one (avoid accidental duplicates)
      user.ownedCards = user.ownedCards || [];
      if (!user.ownedCards.some(e => e.cardId === card.id)) {
        user.ownedCards.push({ cardId: card.id, level: 1, xp: 0 });
      }
      if (!user.history.includes(card.id)) user.history.push(card.id);
    }

    // Build embed now (before we remove wishlist entries) so the pulled
    // card still shows as wishlisted/favorited in the embed if it was.
    const avatarUrl = message ? message.author.displayAvatarURL() : interaction.user.displayAvatarURL();
    const embed = buildPullEmbed(card, username, avatarUrl, pityProgress, duplicateText, user);

    // If this card was on the user's wishlist, remove it now that they've
    // obtained it so the favorites/wishlist UI reflects ownership.
    if (Array.isArray(user.wishlistCards) && user.wishlistCards.includes(card.id)) {
      user.wishlistCards = user.wishlistCards.filter(id => id !== card.id);
      if (typeof user.markModified === 'function') user.markModified('wishlistCards');
    }

    user.pullsRemaining -= 1;
    user.totalPulls = (user.totalPulls || 0) + 1;
    await user.save();

    // Check achievements after changes
    try {
    } catch (err) {
      console.error('Error checking achievements after pull', err);
    }

    if (message) return message.channel.send({ embeds: [embed] });
    return interaction.reply({ embeds: [embed] });
  }
};
