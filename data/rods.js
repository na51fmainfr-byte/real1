const rods = [
  {
    id: 'basic_rod',
    name: 'Basic Rod',
    emoji: '<:basicrod:1490066589729558568>',
    cost: 500,
    luckBonus: 0,
    multiplier: 1,
    thumbnail: 'https://files.catbox.moe/ck8x40.webp',
    durability: 50
  },
  {
    id: 'gold_rod',
    name: 'Gold Rod',
    emoji: '<:goldrod:1490066952671072266>',
    cost: 3000,
    luckBonus: 0.15, // +15%
    multiplier: 1.25,
    thumbnail: 'https://files.catbox.moe/4glijm.webp',
    durability: 250
  },
  {
    id: 'white_rod',
    name: 'White Rod',
    emoji: '<:whiterod:1490067000838459533>',
    cost: 10000,
    luckBonus: 0.30, // +30%
    multiplier: 1.5,
    thumbnail: 'https://files.catbox.moe/d5qvci.webp',
    durability: 300
  },
  {
    id: 'meme_rod',
    name: 'Meme Rod',
    emoji: '🎣',
    cost: 0,
    luckBonus: 0,
    multiplier: 1,
    thumbnail: 'https://files.catbox.moe/ck8x40.webp',
    durability: 3
  }
];

module.exports = { rods };
