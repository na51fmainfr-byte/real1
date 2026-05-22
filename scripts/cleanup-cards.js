const fs = require('fs');
const path = require('path');

const cardsFile = path.join(__dirname, '..', 'data', 'cards.js');
const morecardsFile = path.join(__dirname, '..', 'data', 'morecards.js');

// Load the card arrays
const { cards } = require('../data/cards');
const { moreCards } = require('../data/morecards');

// ─── Step 1: Find (character, title) pairs that appear on more than one card ───
const pairCount = new Map();
const allCards = [...cards, ...moreCards];

for (const card of allCards) {
  const char = card.character ? card.character.trim() : '';
  const title = card.title ? card.title.trim() : '';
  if (!char || !title) continue;
  const key = `${char}|||${title}`;
  pairCount.set(key, (pairCount.get(key) || 0) + 1);
}

const duplicatePairs = new Set();
for (const [key, count] of pairCount) {
  if (count > 1) {
    duplicatePairs.add(key);
    const [char, title] = key.split('|||');
    console.log(`Duplicate name+title: "${char}" / "${title}" (${count} cards)`);
  }
}

console.log(`\nFound ${duplicatePairs.size} duplicate name+title pairs.\n`);

// ─── Step 2: Build replacement map for titles to clear ────────────────────────
// Keys: card IDs whose titles should be cleared
const cardsToClearTitle = new Set();
for (const card of allCards) {
  const char = card.character ? card.character.trim() : '';
  const title = card.title ? card.title.trim() : '';
  if (!char || !title) continue;
  const key = `${char}|||${title}`;
  if (duplicatePairs.has(key)) {
    cardsToClearTitle.add(card.id);
  }
}

console.log(`Cards to clear title from: ${cardsToClearTitle.size}\n`);

// ─── Step 3: Regex-replace titles in files ────────────────────────────────────
// We look for lines like:   title: 'Some Title',  or  title: "Some Title",
// and replace with:         title: '',
function clearTitlesInFile(filePath, cardIds) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changedCount = 0;

  // Process one card at a time — find the card block by id and clear its title
  for (const id of cardIds) {
    // Find the block that contains this id (look for id: 'ID' or id: "ID")
    // then within that block find the title line and blank it
    const idPattern = new RegExp(
      `(id:\\s*['"\`]${escapeRegex(id)}['"\`][^}]*?)(\\btitle:\\s*)(['"\`])([^'"\`]*)(['"\`])`,
      'gs'
    );

    const before = content;
    content = content.replace(idPattern, (match, pre, titleKey, q1, titleVal, q2) => {
      if (!titleVal.trim()) return match; // Already empty
      changedCount++;
      return `${pre}${titleKey}${q1}${q2}`;
    });
  }

  if (changedCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`  Cleared ${changedCount} title(s) in ${path.basename(filePath)}`);
  } else {
    console.log(`  No title changes in ${path.basename(filePath)}`);
  }
  return changedCount;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

console.log('Clearing duplicate name+title pairs from cards.js...');
const c1 = clearTitlesInFile(cardsFile, cardsToClearTitle);

console.log('Clearing duplicate name+title pairs from morecards.js...');
const c2 = clearTitlesInFile(morecardsFile, cardsToClearTitle);

// ─── Step 4: Clean up morecards.js character name suffixes ────────────────────
// Remove "(something)" or " - something" from character names in morecards.js
// Only for D/C/B rank cards (filler characters)
console.log('\nCleaning up filler character name suffixes in morecards.js...');

let moreContent = fs.readFileSync(morecardsFile, 'utf8');
let nameCleanCount = 0;

// Pattern: character: 'Name (suffix)',  →  character: 'Name',
// and:     character: 'Name - suffix',  →  character: 'Name',
// For low rank filler cards (D, C, B)
const nameCleanPattern = /(\bcharacter:\s*)(['"`])([^'"`]+)\s+(?:\([^)]+\)|(?:-\s+\S+(?:\s+\S+)?))\2/g;

// We need to be careful - only clean up if the card is low rank
// Load morecards to check ranks
const moreCardsMap = new Map();
for (const c of moreCards) {
  if (c.id) moreCardsMap.set(c.id, c);
}

// Find character names with parenthetical or dash suffixes in low-rank cards
const namesToClean = new Map(); // original name → cleaned name
for (const card of moreCards) {
  if (!card.character) continue;
  // Only process D, C, B rank cards (filler enemies)
  if (!['D', 'C', 'B'].includes(card.rank)) continue;
  // Skip cards that are clearly named characters (not filler)
  // Heuristic: if the card has pullable:true and a real ID, might be important
  // But the user said "nobody filler" so let's be aggressive for D/C only
  if (!['D', 'C'].includes(card.rank)) continue;

  const name = card.character;
  // Match " (something)" at end of name
  const parenMatch = name.match(/^(.+?)\s+\([^)]+\)$/);
  if (parenMatch) {
    const cleaned = parenMatch[1].trim();
    if (cleaned && cleaned !== name) {
      namesToClean.set(name, cleaned);
      console.log(`  Name cleanup: "${name}" → "${cleaned}"`);
    }
    continue;
  }
  // Match " - something" at end of name (only if short suffix, no more than 2 words)
  const dashMatch = name.match(/^(.+?)\s+-\s+(\S+(?:\s+\S+)?)$/);
  if (dashMatch) {
    const suffix = dashMatch[2];
    // Only clean if suffix is short (1-2 words, likely a faction/color indicator)
    if (suffix.split(/\s+/).length <= 2) {
      const cleaned = dashMatch[1].trim();
      if (cleaned && cleaned !== name) {
        namesToClean.set(name, cleaned);
        console.log(`  Name cleanup: "${name}" → "${cleaned}"`);
      }
    }
  }
}

// Apply name cleanups to morecards.js
for (const [original, cleaned] of namesToClean) {
  const escapedOrig = escapeRegex(original);
  // Replace character: 'Original Name', and alias entries with the same name
  const charPattern = new RegExp(`(\\bcharacter:\\s*)(['"\`])${escapedOrig}\\2`, 'g');
  const newContent = moreContent.replace(charPattern, (match, pre, q) => {
    nameCleanCount++;
    return `${pre}${q}${cleaned}${q}`;
  });
  if (newContent !== moreContent) {
    moreContent = newContent;
  }
}

if (nameCleanCount > 0) {
  fs.writeFileSync(morecardsFile, moreContent);
  console.log(`\nCleaned up ${nameCleanCount} character name suffixes in morecards.js`);
} else {
  console.log('\nNo character name suffixes to clean up.');
}

console.log('\nCard cleanup complete!');
console.log(`Summary: ${c1 + c2} title(s) cleared, ${nameCleanCount} name suffix(es) removed.`);
