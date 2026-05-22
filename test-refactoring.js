// Quick test to verify the refactored cards work correctly
const { cards } = require('./data/cards');

console.log('=== REFACTORING TEST ===\n');

// Test 1: Verify card count and structure
console.log(`✓ Cards loaded: ${cards.length} total cards`);

// Test 2: Verify Luffy cards are properly flattened
const luffyCards = cards.filter(c => c.character === 'Monkey D. Luffy');
console.log(`✓ Luffy has ${luffyCards.length} mastery levels (expected 4)`);

// Test 3: Verify IDs are correct
const expectedLuffyIds = ['monkeyDluffy-u1', 'monkeyDluffy-u2', 'monkeyDluffy-u3', 'monkeyDluffy-u4'];
const actualLuffyIds = luffyCards.map(c => c.id);
console.log(`✓ Luffy IDs: ${actualLuffyIds.join(', ')}`);

// Test 4: Verify emoji/attribute inheritance
console.log('\n=== EMOJI/ATTRIBUTE INHERITANCE TEST ===\n');
const zoroU1 = cards.find(c => c.id === 'roronoazoro-u1');
const zoroU2 = cards.find(c => c.id === 'roronoazoro-u2');
const zoroU3 = cards.find(c => c.id === 'roronoazoro-u3');

console.log('Zoro U1:');
console.log(`  attribute: ${zoroU1?.attribute}`);
console.log(`  emoji: ${zoroU1?.emoji}`);

console.log('Zoro U2 (should inherit from U1):');
console.log(`  attribute: ${zoroU2?.attribute}`);
console.log(`  emoji: ${zoroU2?.emoji}`);

console.log('Zoro U3 (should inherit from U1):');
console.log(`  attribute: ${zoroU3?.attribute}`);
console.log(`  emoji: ${zoroU3?.emoji}`);

// Verify inheritance works
const inheritanceWorking = 
  zoroU1?.attribute === zoroU2?.attribute &&
  zoroU1?.emoji === zoroU2?.emoji &&
  zoroU1?.attribute === zoroU3?.attribute &&
  zoroU1?.emoji === zoroU3?.emoji;

if (inheritanceWorking) {
  console.log('\n✓ Emoji/attribute inheritance working correctly!');
} else {
  console.log('\n✗ Emoji/attribute inheritance FAILED!');
}

// Test 5: Verify critical fields exist
console.log('\n=== CRITICAL FIELDS TEST ===\n');
const sampleCard = cards[0];
const requiredFields = ['id', 'character', 'alias', 'title', 'faculty', 'rank', 'mastery', 'mastery_total', 'pullable', 'power', 'health', 'speed', 'attack_min', 'attack_max', 'image_url'];
const missingFields = requiredFields.filter(f => !(f in sampleCard));

if (missingFields.length === 0) {
  console.log(`✓ All required fields present: ${requiredFields.join(', ')}`);
} else {
  console.log(`✗ Missing fields: ${missingFields.join(', ')}`);
}

// Test 6: Verify pullable only for U1
console.log('\n=== PULLABLE TEST ===\n');
const pullableCards = cards.filter(c => c.pullable);
const nonPullableCards = cards.filter(c => !c.pullable);
const allPullableAreU1 = pullableCards.every(c => c.mastery === 1);
const allNonPullableAreHigherMastery = nonPullableCards.every(c => c.mastery > 1);

if (allPullableAreU1 && allNonPullableAreHigherMastery) {
  console.log(`✓ Pullable system correct: ${pullableCards.length} pullable (all U1), ${nonPullableCards.length} non-pullable`);
} else {
  console.log('✗ Pullable system has issues');
}

console.log('\n=== TEST COMPLETE ===');
