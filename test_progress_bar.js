// Test the progress bar position calculation
const barLength = 8;
const tickInterval = 100;

// Simulate different elapsed times and check positions
console.log('Testing progress bar position calculation:');
console.log('barLength:', barLength, 'tickInterval:', tickInterval, 'ms');
console.log('');

const testTimes = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 700, 800, 900, 1000];

testTimes.forEach(elapsedMs => {
  const position = Math.floor(elapsedMs / tickInterval) % barLength;
  const bar = Array(barLength).fill('□');
  bar[position] = '■';
  console.log(`Time: ${elapsedMs}ms -> Position: ${position} -> ${bar.join('')}`);
});

console.log('');
console.log('Expected behavior:');
console.log('- Position 0: 0-99ms');
console.log('- Position 1: 100-199ms');
console.log('- Position 2: 200-299ms');
console.log('- Position 3: 300-399ms');
console.log('- Position 4: 400-499ms');
console.log('- Position 5: 500-599ms');
console.log('- Position 6: 600-699ms');
console.log('- Position 7: 700-799ms');
console.log('- Position 0 (loops): 800ms onwards');
console.log('');
console.log('Tick moves 1 position per 100ms, cycling through 8 positions');
