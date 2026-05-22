#!/usr/bin/env node
const path = require('path');

function fail(msg) {
  console.error(msg);
  process.exitCode = 2;
}

try {
  const cardsModule = require(path.join(__dirname, '..', 'data', 'cards.js'));
  const cards = cardsModule && cardsModule.cards ? cardsModule.cards : cardsModule;

  const expectedIcon = {
    2: '<:2_:1503002986560094228>',
    3: '<:3_:1503002985578365118>'
  };

  const problems = [];

  // Ensure source data does not contain explicit `countIcon`/`scountIcon` literals.
  const fs = require('fs');
  const src = fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.js'), 'utf8');
  const sourceProblems = [];
  if (/\bcountIcon\s*:/.test(src)) sourceProblems.push('Found explicit "countIcon:" in data/cards.js; remove per-card icon properties');
  if (/\bscountIcon\s*:/.test(src)) sourceProblems.push('Found explicit "scountIcon:" in data/cards.js; remove per-card icon properties');
  if (sourceProblems.length) {
    console.error('Source validation FAILED:');
    sourceProblems.forEach(p => console.error(' -', p));
    process.exit(2);
  }

  cards.forEach(c => {
    if (!c || !c.id) return;

    if (Object.prototype.hasOwnProperty.call(c, 'count')) {
      const v = c.count;
      if (![2,3].includes(v)) problems.push(`${c.id}: invalid count value ${v} (must be 2 or 3)`);
      if (!c.countIcon || c.countIcon !== expectedIcon[v]) {
        problems.push(`${c.id}: flattened countIcon mismatch for count ${v} (found ${c.countIcon}, expected ${expectedIcon[v]})`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(c, 'scount')) {
      const v = c.scount;
      if (![2,3].includes(v)) problems.push(`${c.id}: invalid scount value ${v} (must be 2 or 3)`);
      if (!c.scountIcon || c.scountIcon !== expectedIcon[v]) {
        problems.push(`${c.id}: flattened scountIcon mismatch for scount ${v} (found ${c.scountIcon}, expected ${expectedIcon[v]})`);
      }
    }

    // sanity: don't allow both count and scount on same flattened card
    if (Object.prototype.hasOwnProperty.call(c, 'count') && Object.prototype.hasOwnProperty.call(c, 'scount')) {
      problems.push(`${c.id}: has both count and scount`);
    }
  });

  if (problems.length) {
    console.error('count/scount validation FAILED:');
    problems.forEach(p => console.error(' -', p));
    process.exit(2);
  }

  console.log('OK: count/scount validation passed');
  process.exit(0);

} catch (e) {
  console.error('Error running validate-card-counts:', e && e.message ? e.message : e);
  process.exit(3);
}
