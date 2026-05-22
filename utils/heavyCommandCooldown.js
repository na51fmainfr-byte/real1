// Simple per-user cooldown utility for heavy commands
const COOLDOWN_MS = 10 * 1000; // 10 seconds
const lastRun = new Map(); // userId -> timestamp

function tryAcquire(userId) {
  if (!userId) return false;
  const now = Date.now();
  const prev = lastRun.get(userId) || 0;
  if (now - prev < COOLDOWN_MS) return false;
  lastRun.set(userId, now);
  return true;
}

function remainingMs(userId) {
  const prev = lastRun.get(userId) || 0;
  const rem = COOLDOWN_MS - (Date.now() - prev);
  return rem > 0 ? rem : 0;
}

module.exports = { tryAcquire, remainingMs };
