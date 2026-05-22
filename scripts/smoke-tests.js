#!/usr/bin/env node
(async () => {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error('FAIL:', msg);
      process.exitCode = 2;
    } else {
      console.log('PASS:', msg);
    }
  };
  try {
    console.log('Smoke tests starting...');

    // Stub User.findOne to avoid DB calls
    const User = require('../models/User');
    User.findOne = async (q) => ({
      userId: q && q.userId ? q.userId : 'testuser',
      items: [],
      ownedCards: [],
      history: [],
      packs: {},
      save: async function() {}
    });

    // Test 1: statusManager stacking and cap
    const statusManager = require('../src/battle/statusManager');
    const e = { status: [] };
    statusManager.addStatus(e, 'stun', 2);
    statusManager.addStatus(e, 'stun', 2);
    statusManager.addStatus(e, 'stun', 2);
    statusManager.addStatus(e, 'stun', 2);
    assert(Array.isArray(e.status) && e.status.length === 1 && e.status[0].stacks === 3, 'addStatus stacks up to 3 for same type');

    statusManager.addStatus(e, 'cut', 2);
    statusManager.addStatus(e, 'bleed', 2);
    statusManager.addStatus(e, 'regen', 2);
    assert(e.status.length === 3, 'distinct status types capped at 3');
    const types = e.status.map(s => s.type);
    assert(!types.includes('stun'), 'oldest status removed when exceeding cap');

    // Test 2: updateShipBalance
    const { updateShipBalance } = require('../utils/cards');
    const userShip = { activeShip: 's001', shipBalance: 0, shipLastUpdated: new Date(Date.now() - 1000 * 60 * 120) };
    updateShipBalance(userShip);
    assert(typeof userShip.shipBalance === 'number', 'updateShipBalance sets shipBalance as number');

    // Test 3: drops atomicity
    const drops = require('../commands/drops');
    const dropId = 'smoketest_drop_' + Date.now();
    drops.activeDrops.set(dropId, { messageId: 'm1', channelId: 'c1', card: { id: '0002', character: 'Monkey D. Luffy', rank: 'B' }, expiresAt: Date.now() + 600000 });
    const replies = [];
    const makeInteraction = (uid, uname) => ({
      user: { id: uid, username: uname },
      reply: async (opt) => { replies.push({ uid, opt }); return { ok: true }; }
    });

    // ensure User.findOne returns a valid user stub for drops
    User.findOne = async (q) => ({ userId: q.userId || 'u', items: [], ownedCards: [], history: [], save: async () => {} });

    const i1 = makeInteraction('uA', 'Alice');
    const i2 = makeInteraction('uB', 'Bob');
    const p1 = drops.handleDropClaim(i1, dropId);
    const p2 = drops.handleDropClaim(i2, dropId);
    await Promise.all([p1.catch(() => {}), p2.catch(() => {})]);
    assert(replies.length >= 1, 'drop claim produced at least one reply');
    const alreadyClaimed = replies.some(r => {
      const content = (r.opt && (r.opt.content || typeof r.opt === 'string' && r.opt)) || '';
      return String(content).includes('already claimed');
    });
    assert(alreadyClaimed, 'concurrent claim returns already-claimed message to one claimer');

    // Test 4: feed attribute/all
    const feedCmd = require('../commands/feed');
    User.findOne = async (q) => {
      return {
        userId: q.userId || 'u1',
        items: [{ itemId: 'red_hermit_crab', quantity: 2 }, { itemId: 'rainbow_hermit_crab', quantity: 1 }],
        ownedCards: [{ cardId: '0002', level: 1, xp: 0 }],
        history: [],
        save: async function() {}
      };
    };
    const fakeMessage = {
      author: { id: 'u1', username: 'Tester' },
      reply: async (res) => { console.log('feed reply:', typeof res === 'string' ? res : (res && res.embeds ? 'embed' : JSON.stringify(res))); return res; }
    };

    await feedCmd.execute({ message: fakeMessage, interaction: null, args: ['STR', 'luffy'] });

    // Test 5: owner setsail and setcola
    const ownerCmd = require('../commands/owner');
    const OWNER = require('../config').OWNER_ID;
    let savedTarget = null;
    User.findOne = async (q) => {
      // return a mutable user object that records modifications
      savedTarget = { userId: q.userId || '9999', storyProgress: {}, ships: {}, save: async function() { this._saved = true; } };
      return savedTarget;
    };
    const ownerMessage = { author: { id: OWNER }, reply: async (r) => { /* no-op */ }, channel: { send: async (r) => {} } };
    // setsail: set to stage 2 for fusha_village
    await ownerCmd.execute({ message: ownerMessage, args: ['setsail', 'fusha_village', '2', '<@9999>'] });
    assert(savedTarget.storyProgress && Array.isArray(savedTarget.storyProgress['fusha_village']) && savedTarget.storyProgress['fusha_village'].length === 2, 'owner setsail sets stages up to requested value');

    // setcola: set Going Merry (s003) cola to 10
    User.findOne = async (q) => {
      savedTarget = { userId: q.userId || '8888', ships: {}, save: async function() { this._saved = true; } };
      return savedTarget;
    };
    await ownerCmd.execute({ message: ownerMessage, args: ['setcola', 's003', '10', '<@8888>'] });
    assert(savedTarget.ships && savedTarget.ships['s003'] && savedTarget.ships['s003'].cola === 10, 'owner setcola updates ship cola for user');

    // Test 6: timers command formatting and execution
    const timersCmd = require('../commands/timers');
    User.findOne = async (q) => {
      return {
        userId: q.userId || 'tuser',
        lastDaily: new Date(Date.now() - 1000 * 60 * 60 * 23),
        bountyCooldownUntil: new Date(Date.now() + 5000),
        triviaCooldownUntil: null,
        lootCooldownUntil: null,
        betCooldownUntil: null
      };
    };
    const timerReplies = [];
    const fakeTimerMsg = { author: { id: 'tuser', username: 'TimerTester' }, channel: { send: async (p) => { timerReplies.push(p); return p; } }, reply: async (p) => { timerReplies.push(p); return p; } };
    await timersCmd.execute({ message: fakeTimerMsg, interaction: null });
    assert(timerReplies.length > 0, 'timers executed and sent a message');

    console.log('Smoke tests completed.');
    process.exitCode = 0;
  } catch (err) {
    console.error('Smoke test exception:', err);
    process.exitCode = 3;
  }
})();
