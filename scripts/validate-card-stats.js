// Validator: checks card stats against CARD_STAT_RANGES (maxima).
// Considers `all` by dividing attack values per target (2 -> /2, true/3 -> /3).

const path = require('path');
const cardsModule = require(path.join(__dirname, '..', 'data', 'cards'));
const cards = cardsModule.cards;

const ranges = {
  D: { power: [0,5], health: [1,8], speed: [1,1], attack_min: [1,1], attack_max: [1,1] },
  C: { power: [5,10], health: [8,15], speed: [1,3], attack_min: [1,3], attack_max: [1,3] },
  B: { power: [10,15], health: [15,26], speed: [1,5], attack_min: [1,5], attack_max: [1,5] },
  A: { power: [15,20], health: [26,35], speed: [3,8], attack_min: [3,8], attack_max: [3,8] },
  S: { power: [20,30], health: [35,50], speed: [6,12], attack_min: [6,12], attack_max: [6,12] },
  SS: { power: [30,50], health: [50,80], speed: [10,20], attack_min: [10,20], attack_max: [10,20] },
  UR: { power: [50, Infinity], health: [75, Infinity], speed: [18, Infinity], attack_min: [10, Infinity], attack_max: [20, Infinity] }
};

function isBoost(card) {
  return !!card.boost || (card.type && String(card.type).toLowerCase() === 'boost') || !!card.artifact;
}

function getAllDivisor(card) {
  if (card.all === undefined || card.all === null) return 1;
  if (typeof card.all === 'number') return card.all;
  if (card.all === true) return 3;
  // fallback: if string '2'/'3'
  const parsed = Number(card.all);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  return 1;
}

const issues = [];

cards.forEach(card => {
  const r = ranges[card.rank];
  if (!r) return; // unknown rank

  const boost = isBoost(card);
  const divisor = getAllDivisor(card);

  // check power, health, speed
  [['power','power'], ['health','health'], ['speed','speed']].forEach(([key]) => {
    const val = card[key];
    if (val == null || Number.isNaN(Number(val))) return;
    const mx = r[key][1];
    if (Number.isFinite(mx) && Number(val) > mx) {
      issues.push({ id: card.id, character: card.character, rank: card.rank, field: key, value: val, max: mx });
    }
  });

  // attack checks (skip for boost/artifact)
  if (!boost) {
    ['attack_min','attack_max'].forEach(key => {
      const val = card[key];
      if (val == null || Number.isNaN(Number(val))) return;
      const mx = r[key][1];
      if (Number.isFinite(mx)) {
        const perTarget = Number(val) / divisor;
        if (perTarget > mx) {
          // propose corrected original value <= mx * divisor
          const suggested = Math.floor(mx * divisor);
          issues.push({ id: card.id, character: card.character, rank: card.rank, field: key, value: val, perTarget: perTarget, maxPerTarget: mx, divisor, suggestedOriginalMax: suggested });
        }
      }
    });
  }
});

// Print results
if (!issues.length) {
  console.log('No violations found: all cards are within CARD_STAT_RANGES (considering `all` division).');
  process.exit(0);
}

console.log(`Found ${issues.length} potential stat violations (showing concise list):\n`);
issues.forEach(issue => {
  if (issue.field === 'attack_min' || issue.field === 'attack_max') {
    console.log(`${issue.id} | ${issue.character} | Rank ${issue.rank} | ${issue.field}=${issue.value} -> per-target ${issue.perTarget.toFixed(2)} (max ${issue.maxPerTarget}) | divisor=${issue.divisor} | suggested ${issue.field}<=${issue.suggestedOriginalMax}`);
  } else {
    console.log(`${issue.id} | ${issue.character} | Rank ${issue.rank} | ${issue.field}=${issue.value} (max ${issue.max})`);
  }
});

// Exit non-zero for CI awareness
process.exit(1);
