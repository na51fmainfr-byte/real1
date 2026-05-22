const { cards: cardDefs } = require('../data/cards');
const { computeScaledStats } = require('./cards');

// Resolve final stats for a user's specific owned card entry.
// userCard: { cardId, level, xp }
// ownedCards: array of user's owned card entries (needed for boost lookup)
function resolveStats(userCard, ownedCards) {
  if (!userCard || !userCard.cardId) return null;
  const def = cardDefs.find(c => c.id === userCard.cardId);
  if (!def) return null;

  const level = userCard.level || 1;

  // Calculate total percentage and stat-specific boosts by scanning ownedCards.
  // This mirrors the logic in utils/cards.resolveBoostsForCard so the same
  // boost rules apply in battles as in the info command.
  let totalBoostPct = 0;
  const statBoosts = {};
  if (Array.isArray(ownedCards)) {
    const getEffectiveBoost = (boostCardId, baseBoostPct) => {
      let effectiveBoost = baseBoostPct;
      ownedCards.forEach(entry => {
        const src = cardDefs.find(c => c.id === entry.cardId);
        if (src && src.boost && entry.cardId !== boostCardId) {
          const boostCard = cardDefs.find(c => c.id === boostCardId);
          if (boostCard) {
            const charRegex = new RegExp(`${boostCard.character.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\((\\d+)%\\)`, 'i');
            const charMatch = src.boost.match(charRegex);
            if (charMatch) {
              const applyBoost = parseInt(charMatch[1], 10);
              effectiveBoost = Math.ceil(effectiveBoost * (1 + applyBoost / 100));
            }
          }
        }
      });
      return effectiveBoost;
    };

    ownedCards.forEach(entry => {
      const src = cardDefs.find(c => c.id === entry.cardId);
      if (!src || !src.boost) return;
      // Artifact boosts only apply when equipped to this card
      if (src.artifact && entry.equippedTo !== userCard.cardId) return;

      const regex = /([\w .'-]+?)(?:,\s*([\w ]+))?\s*(\(\d+%\))/gi;
      // Use an alternate regex to capture groups properly
      const iterRegex = /([\w .'-]+?)(?:,\s*([\w ]+))?\s*\((\d+)%\)/gi;
      let match;
      while ((match = iterRegex.exec(src.boost)) !== null) {
        const targetName = match[1].trim();
        const stat = match[2] ? match[2].trim() : null;
        const pct = parseInt(match[3], 10);

        if (
          targetName.toLowerCase() === def.character.toLowerCase() ||
          (def.faculty && targetName.toLowerCase().replace(/-/g, '').replace(/ /g, '') === def.faculty.toLowerCase().replace(/-/g, '').replace(/ /g, ''))
        ) {
          const boostAmount = getEffectiveBoost(src.id, pct);
          if (stat) {
            let statKey = stat.toLowerCase().trim();
            if (statKey === 'hp') statKey = 'health';
            if (statKey === 'atk' || statKey === 'att') statKey = 'attack';
            statBoosts[statKey] = (statBoosts[statKey] || 0) + boostAmount;
          } else {
            totalBoostPct += boostAmount;
          }
        }
      }
    });
  }

  // Delegate to computeScaledStats which applies level, total boosts, and
  // stat-specific boosts with the same rounding rules as the info command.
  // Also pass starLevel so the 1%-per-star bonus is applied in battle.
  return computeScaledStats(def, level, totalBoostPct, statBoosts, userCard.starLevel || 0);
}

module.exports = { resolveStats };
