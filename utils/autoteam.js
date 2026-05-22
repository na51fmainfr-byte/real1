const { cards } = require('../data/cards');
const { getCardFinalStats } = require('./cards');

// Build a module-level card lookup Map once (all cards indexed by id)
const _cardMap = new Map();
for (const c of cards) _cardMap.set(c.id, c);

// Select the best `count` cards for a user's auto-team. This function was
// previously doing repeated, expensive score computations inside the sort
// comparator which resulted in O(N log N) heavy computations. Cache the
// computed final-stats per card so each card is evaluated exactly once.
function selectAutoTeam(user, count = 3) {
  if (!user) return [];

  const ownedEntries = Array.isArray(user.ownedCards) ? user.ownedCards : [];
  if (ownedEntries.length === 0) return [];

  // Build a quick map of owned entries for O(1) lookup
  const ownedMap = new Map();
  for (const e of ownedEntries) ownedMap.set(e.cardId, e);

  // Resolve card defs using the pre-built Map for O(1) lookups
  const ownedDefs = ownedEntries
    .map(e => _cardMap.get(e.cardId))
    .filter(Boolean);

  // Exclude artifacts, ships and boost-type cards (attackers only)
  const eligibles = ownedDefs.filter(c => !c.artifact && !c.ship && !c.boost && !(c.type && String(c.type).toLowerCase() === 'boost'));
  if (eligibles.length === 0) return [];

  // If there are a lot of eligibles, use a fast heuristic to avoid heavy
  // getCardFinalStats computations which can be CPU/network intensive.
  // For moderate sizes, first narrow candidates by a cheap heuristic and
  // compute accurate stats only for the top candidates.
  const HEURISTIC_THRESHOLD = 200;
  const RANK_WEIGHT = { D: 1, C: 2, B: 3, A: 4, S: 6, SS: 8, UR: 10 };

  // Quick heuristic sort helper (rank, level, base power)
  const heuristicList = eligibles.map(def => {
    const entry = ownedMap.get(def.id) || { level: 1 };
    return {
      def,
      rankWeight: RANK_WEIGHT[def.rank] || 1,
      level: Math.max(1, entry.level || 1),
      basePower: def.power || 0
    };
  }).sort((a, b) => {
    if (a.rankWeight !== b.rankWeight) return b.rankWeight - a.rankWeight;
    if (a.level !== b.level) return b.level - a.level;
    if (a.basePower !== b.basePower) return b.basePower - a.basePower;
    return a.def.character.localeCompare(b.def.character);
  });

  // If extremely large, avoid expensive stats entirely and pick by heuristic
  if (eligibles.length > HEURISTIC_THRESHOLD) {
    return heuristicList.slice(0, count).map(x => x.def.id);
  }

  // Otherwise compute accurate stats but only for top candidates to reduce O(N^2)
  const MAX_CANDIDATES = Math.min(Math.max(count * 5, 30), heuristicList.length);
  const candidates = heuristicList.slice(0, MAX_CANDIDATES).map(x => x.def);

  const scored = candidates.map(def => {
    const entry = ownedMap.get(def.id) || { level: 1 };
    const stats = getCardFinalStats(def, entry.level || 1, user);
    const score = (stats && stats.scaled && typeof stats.scaled.power === 'number') ? stats.scaled.power : 0;
    return { id: def.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(s => s.id);
}

module.exports = {
  selectAutoTeam
};
