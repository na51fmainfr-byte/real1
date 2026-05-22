const CHEST_EMOJIS = {
  c_chest: '<:Cchest:1492559506868146307>',
  b_chest: '<:Bchest:1492559568738451567>',
  a_chest: '<:Achest:1492559635507450068>'
};

const chests = [
  {
    id: 'c_chest',
    name: 'C Chest',
    aliases: ['c chest', 'cchest'],
    emoji: CHEST_EMOJIS.c_chest,
    price: 360,
    contents: {
      beli: [10, 100],
      itemRank: 'C',
      resetTokens: { chance: 0, count: [0, 0] }
    }
  },
  {
    id: 'b_chest',
    name: 'B Chest',
    aliases: ['b chest', 'bchest'],
    emoji: CHEST_EMOJIS.b_chest,
    price: 930,
    contents: {
      beli: [30, 150],
      itemRank: 'B',
      resetTokens: { chance: 0.3, count: [1, 1] }
    }
  },
  {
    id: 'a_chest',
    name: 'A Chest',
    aliases: ['a chest', 'achest'],
    emoji: CHEST_EMOJIS.a_chest,
    price: 3400,
    contents: {
      beli: [75, 250],
      itemRank: 'A',
      resetTokens: { chance: 0.5, count: [1, 1] }
    }
  }
];

const chestMap = new Map();
const chestIdMap = new Map();

function normalizeQuery(query) {
  return query ? query.toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
}

chests.forEach(chest => {
  chestIdMap.set(chest.id, chest);
  chestMap.set(normalizeQuery(chest.name), chest);
  chest.aliases.forEach(alias => chestMap.set(normalizeQuery(alias), chest));
});

function getChestByQuery(query) {
  if (!query) return null;
  const normalized = normalizeQuery(query);
  if (chestMap.has(normalized)) return chestMap.get(normalized);
  for (const [key, chest] of chestMap.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) return chest;
  }
  return null;
}

function getChestById(id) {
  if (!id) return null;
  return chestIdMap.get(id);
}

function getChestDisplayName(id) {
  const chest = getChestById(id);
  return chest ? chest.name : id;
}

module.exports = {
  chests,
  CHEST_EMOJIS,
  getChestByQuery,
  getChestById,
  getChestDisplayName
};
