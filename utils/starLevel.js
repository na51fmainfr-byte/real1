const RANK_MAX_STAR = { D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6, UR: 7 };
const RANK_MAX_LEVEL = { D: 10, C: 20, B: 30, A: 40, S: 50, SS: 60, UR: 70 };

const STAR_EMOJIS = {
  STR: '<:redstar:1504239990710865990>',
  QCK: '<:bluestar:1504240197318086706>',
  DEX: '<:greenstar:1504240199553515620>',
  INT: '<:purplestar:1504239997962944542>',
  PSY: '<:yellowstar:1504239996813705267>',
  blank: '<:blankstar:1504239999535812659>'
};

function getMaxStarForRank(rank) {
  return RANK_MAX_STAR[rank] || 1;
}

function getMaxLevelForRank(rank) {
  return RANK_MAX_LEVEL[rank] || 10;
}

function buildStarDisplay(attribute, currentStarLevel, rank) {
  const maxStar = getMaxStarForRank(rank);
  const starEmoji = STAR_EMOJIS[attribute] || STAR_EMOJIS.blank;
  const blankEmoji = STAR_EMOJIS.blank;
  const filledCount = Math.max(0, Math.min(currentStarLevel || 0, maxStar));
  const emptyCount = maxStar - filledCount;
  return starEmoji.repeat(filledCount) + blankEmoji.repeat(emptyCount);
}

function getStarUpgradeRequirement(targetStarLevel) {
  if (targetStarLevel < 1 || targetStarLevel > 7) return null;
  return {
    level: targetStarLevel * 10,
    gemCost: 1,
    shardCost: targetStarLevel
  };
}

function isSpecialAttackUnlocked(starLevel) {
  return (starLevel || 0) >= 4;
}

function isStatusEffectUnlocked(starLevel) {
  return (starLevel || 0) >= 5;
}

function getStarBoostPct(starLevel) {
  return Math.min(starLevel || 0, 7);
}

module.exports = {
  RANK_MAX_STAR,
  RANK_MAX_LEVEL,
  STAR_EMOJIS,
  getMaxStarForRank,
  getMaxLevelForRank,
  buildStarDisplay,
  getStarUpgradeRequirement,
  isSpecialAttackUnlocked,
  isStatusEffectUnlocked,
  getStarBoostPct
};
