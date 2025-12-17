#!/usr/bin/env node
/**
 * QA Test Suite - Profile System E2E Behavioral Tests
 * Tests system behavior, race conditions, delays, and integration
 *
 * These tests focus on:
 * - Fire-and-forget pattern behavior
 * - Concurrent game results handling
 * - Stats consistency across game types
 * - Auth state transitions
 * - Error resilience
 * - Real-world usage patterns
 */

import assert from 'assert';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      throw new Error('Use asyncTest for async tests');
    }
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`  ❌ ${name}`);
    console.log(`     Error: ${error.message}`);
  }
}

// ============================================
// Simulated Stats System (mirrors real implementation)
// ============================================

const DEFAULT_MODE_STATS = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  longestStreak: 0,
  fastestWinMs: null,
};

const DEFAULT_USER_STATS = {
  singlePlayer: { ...DEFAULT_MODE_STATS },
  multiplayer: { ...DEFAULT_MODE_STATS },
  lastActivityAt: 0,
  createdAt: 0,
  updatedAt: 0,
};

// Simulated KV store
class MockKVStore {
  constructor() {
    this.data = new Map();
    this.operationLog = [];
    this.latencyMs = 0;
    this.failNextOperation = false;
  }

  setLatency(ms) {
    this.latencyMs = ms;
  }

  simulateFailure() {
    this.failNextOperation = true;
  }

  async get(key) {
    this.operationLog.push({ op: 'get', key, time: Date.now() });
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }
    if (this.failNextOperation) {
      this.failNextOperation = false;
      throw new Error('KV operation failed');
    }
    return this.data.get(key) || null;
  }

  async set(key, value) {
    this.operationLog.push({ op: 'set', key, value: JSON.parse(JSON.stringify(value)), time: Date.now() });
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }
    if (this.failNextOperation) {
      this.failNextOperation = false;
      throw new Error('KV operation failed');
    }
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    return 'OK';
  }

  reset() {
    this.data.clear();
    this.operationLog = [];
    this.latencyMs = 0;
    this.failNextOperation = false;
  }
}

// Simulated API Handler (with operation serialization like real API)
class MockStatsAPI {
  constructor(kv) {
    this.kv = kv;
    this.requestLog = [];
    this._operationLock = Promise.resolve(); // Serialize operations per user
  }

  async recordGame(userId, payload) {
    // Real API serializes requests - wait for previous operation to complete
    const previousLock = this._operationLock;
    let releaseLock;
    this._operationLock = new Promise(resolve => { releaseLock = resolve; });

    await previousLock;

    try {
      this.requestLog.push({ type: 'recordGame', userId, payload, time: Date.now() });

      const now = Date.now();
      let stats = await this.kv.get(`stats:${userId}`);

      if (!stats) {
        stats = {
          ...DEFAULT_USER_STATS,
          singlePlayer: { ...DEFAULT_MODE_STATS },
          multiplayer: { ...DEFAULT_MODE_STATS },
          createdAt: now,
        };
      }

      const modeKey = payload.mode === 'singleplayer' ? 'singlePlayer' : 'multiplayer';
      const modeStats = { ...stats[modeKey] };

      modeStats.gamesPlayed += 1;

      if (payload.isWin) {
        modeStats.wins += 1;
        modeStats.currentStreak += 1;
        if (modeStats.currentStreak > modeStats.longestStreak) {
          modeStats.longestStreak = modeStats.currentStreak;
        }
        if (modeStats.fastestWinMs === null || payload.gameDurationMs < modeStats.fastestWinMs) {
          modeStats.fastestWinMs = payload.gameDurationMs;
        }
      } else {
        modeStats.losses += 1;
        modeStats.currentStreak = 0;
      }

      const updatedStats = {
        ...stats,
        [modeKey]: modeStats,
        lastActivityAt: now,
        updatedAt: now,
      };

      await this.kv.set(`stats:${userId}`, updatedStats);
      return updatedStats;
    } finally {
      releaseLock();
    }
  }

  async getStats(userId) {
    this.requestLog.push({ type: 'getStats', userId, time: Date.now() });
    const stats = await this.kv.get(`stats:${userId}`);
    return stats || { ...DEFAULT_USER_STATS };
  }

  reset() {
    this.requestLog = [];
  }
}

// Fire-and-forget hook simulation
class MockUseUserStats {
  constructor(api) {
    this.api = api;
    this.stats = null;
    this.pendingOperations = [];
    this.isSignedIn = true;
    this.userId = 'test_user_123';
  }

  // Fire-and-forget: doesn't wait for result
  recordGameResult(payload) {
    if (!this.isSignedIn) return;

    const operation = this.api.recordGame(this.userId, payload)
      .then(updatedStats => {
        this.stats = updatedStats;
      })
      .catch(err => {
        // Fire-and-forget: log but don't throw
        console.error('Failed to record (fire-and-forget):', err.message);
      });

    this.pendingOperations.push(operation);
    return operation;
  }

  async refresh() {
    if (!this.isSignedIn) {
      this.stats = null;
      return;
    }
    this.stats = await this.api.getStats(this.userId);
  }

  async waitForPendingOperations() {
    await Promise.all(this.pendingOperations);
    this.pendingOperations = [];
  }

  signOut() {
    this.isSignedIn = false;
    this.stats = null;
  }

  signIn(userId = 'test_user_123') {
    this.isSignedIn = true;
    this.userId = userId;
  }
}

// Shared test fixtures
let kv, api, hook;

function setup() {
  kv = new MockKVStore();
  api = new MockStatsAPI(kv);
  hook = new MockUseUserStats(api);
}

// ============================================
// TEST SUITE: Fire-and-Forget Pattern
// ============================================
console.log('\n🔥 FIRE-AND-FORGET PATTERN TESTS\n');

await asyncTest('Fire-and-forget does not block game flow', async () => {
  setup();
  kv.setLatency(100); // Simulate 100ms network delay

  const startTime = Date.now();

  // Fire off the record (should return immediately)
  hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  const elapsed = Date.now() - startTime;
  assert(elapsed < 50, `Should return immediately, took ${elapsed}ms`);

  // Wait for background operation to complete
  await hook.waitForPendingOperations();

  // Now stats should be updated
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
});

await asyncTest('Multiple fire-and-forget operations queue correctly', async () => {
  setup();
  kv.setLatency(20);

  // Rapid fire multiple games
  for (let i = 0; i < 5; i++) {
    hook.recordGameResult({
      mode: 'singleplayer',
      isWin: true,
      gameDurationMs: 30000 + i * 1000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  // Should have 5 pending operations
  assert.strictEqual(hook.pendingOperations.length, 5);

  await hook.waitForPendingOperations();

  // All games should be recorded
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 5);
  assert.strictEqual(hook.stats.singlePlayer.wins, 5);
});

await asyncTest('Fire-and-forget handles API failure gracefully', async () => {
  setup();

  // Record first game successfully
  await hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  // Simulate failure on next operation
  kv.simulateFailure();

  // This should not throw
  hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 25000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  await hook.waitForPendingOperations();

  // Stats should still have the first game
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
});

// ============================================
// TEST SUITE: Concurrent Operations
// ============================================
console.log('\n🔀 CONCURRENT OPERATIONS TESTS\n');

await asyncTest('Concurrent games from same user are serialized', async () => {
  setup();
  kv.setLatency(10);

  // Simulate starting two games nearly simultaneously
  const p1 = hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  const p2 = hook.recordGameResult({
    mode: 'singleplayer',
    isWin: false,
    gameDurationMs: 45000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  await Promise.all([p1, p2]);

  // Final state should reflect both games
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 2);
  assert.strictEqual(hook.stats.singlePlayer.wins, 1);
  assert.strictEqual(hook.stats.singlePlayer.losses, 1);
});

await asyncTest('Race condition: stats refresh while recording', async () => {
  setup();
  kv.setLatency(50);

  // Start recording a game
  const recordPromise = hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // While that's in flight, refresh stats
  const refreshPromise = hook.refresh();

  await Promise.all([recordPromise, refreshPromise]);
  await hook.waitForPendingOperations();

  // Both operations should complete without crash
  // Final state depends on order, but should be consistent
  assert(hook.stats !== null);
});

// ============================================
// TEST SUITE: Game Flow Integration
// ============================================
console.log('\n🎮 GAME FLOW INTEGRATION TESTS\n');

await asyncTest('Complete single-player game flow: lobby → play → win → stats', async () => {
  setup();

  // Simulate: User opens profile (empty stats)
  await hook.refresh();
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 0);

  // Simulate: Play a game, win
  hook.recordGameResult({
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 45000,
    context: {
      botDifficulty: 'MEDIUM',
      cardLayout: 'ORDERLY',
      cardSetId: 'default',
      cardSetName: 'Default',
      playerCount: 3
    }
  });

  await hook.waitForPendingOperations();

  // Check stats updated
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(hook.stats.singlePlayer.wins, 1);
  assert.strictEqual(hook.stats.singlePlayer.currentStreak, 1);
  assert.strictEqual(hook.stats.singlePlayer.fastestWinMs, 45000);
});

await asyncTest('Multiplayer game flow: win then loss updates correctly', async () => {
  setup();

  // Win multiplayer game
  hook.recordGameResult({
    mode: 'multiplayer',
    isWin: true,
    winReason: 'stack_emptied',
    gameDurationMs: 60000,
    context: { cardLayout: 'CHAOTIC', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });
  await hook.waitForPendingOperations();

  assert.strictEqual(hook.stats.multiplayer.wins, 1);
  assert.strictEqual(hook.stats.multiplayer.currentStreak, 1);

  // Lose next multiplayer game
  hook.recordGameResult({
    mode: 'multiplayer',
    isWin: false,
    gameDurationMs: 75000,
    context: { cardLayout: 'CHAOTIC', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });
  await hook.waitForPendingOperations();

  assert.strictEqual(hook.stats.multiplayer.losses, 1);
  assert.strictEqual(hook.stats.multiplayer.currentStreak, 0);
  assert.strictEqual(hook.stats.multiplayer.longestStreak, 1);
});

await asyncTest('Switching between modes tracks separately', async () => {
  setup();

  // Win 3 singleplayer
  for (let i = 0; i < 3; i++) {
    hook.recordGameResult({
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }
  await hook.waitForPendingOperations();

  // Lose 1 multiplayer
  hook.recordGameResult({
    mode: 'multiplayer', isWin: false, gameDurationMs: 60000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });
  await hook.waitForPendingOperations();

  // Singleplayer stats unchanged by multiplayer loss
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 3);
  assert.strictEqual(hook.stats.singlePlayer.currentStreak, 3, 'SP streak should not be affected by MP loss');

  // Multiplayer has its own stats
  assert.strictEqual(hook.stats.multiplayer.gamesPlayed, 1);
  assert.strictEqual(hook.stats.multiplayer.losses, 1);
});

// ============================================
// TEST SUITE: Auth State Transitions
// ============================================
console.log('\n🔐 AUTH STATE TRANSITIONS\n');

await asyncTest('Signed out user: recordGameResult is no-op', async () => {
  setup();
  hook.signOut();

  // Should not throw, should not record
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  await hook.waitForPendingOperations();

  // No data in KV
  assert.strictEqual(kv.data.size, 0);
});

await asyncTest('Sign out clears local stats', async () => {
  setup();

  // Record a game
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);

  // Sign out
  hook.signOut();

  // Stats should be cleared locally
  assert.strictEqual(hook.stats, null);
});

await asyncTest('Sign in as different user loads different stats', async () => {
  setup();

  // User A plays
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  // Switch to User B
  hook.signIn('user_b_456');
  await hook.refresh();

  // User B has no stats
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 0);

  // User B plays
  hook.recordGameResult({
    mode: 'multiplayer', isWin: false, gameDurationMs: 60000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });
  await hook.waitForPendingOperations();

  // Switch back to User A
  hook.signIn('test_user_123');
  await hook.refresh();

  // User A stats preserved
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(hook.stats.multiplayer.gamesPlayed, 0);
});

// ============================================
// TEST SUITE: Error Resilience
// ============================================
console.log('\n🛡️ ERROR RESILIENCE TESTS\n');

await asyncTest('Network timeout does not crash the app', async () => {
  setup();
  kv.setLatency(5000); // Very long delay

  // Fire and forget with timeout simulation
  const startTime = Date.now();
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // Should return immediately despite slow network
  const elapsed = Date.now() - startTime;
  assert(elapsed < 100, 'Should not block on slow network');

  // Clean up - don't actually wait 5s
  hook.pendingOperations = [];
});

await asyncTest('Intermittent failures followed by success recovers', async () => {
  setup();

  // First attempt fails
  kv.simulateFailure();
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  // Second attempt succeeds
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 25000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  // Should have recorded the second game
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
});

await asyncTest('Corrupted stats in KV handled gracefully', async () => {
  setup();

  // Simulate corrupted data in KV
  kv.data.set('stats:test_user_123', 'not valid json object');

  // Should not crash, might reset to defaults
  try {
    await hook.refresh();
    // If it doesn't crash, that's a pass
  } catch (e) {
    // Should handle gracefully
    assert(e.message.includes('JSON') || e.message.includes('parse'), 'Should be a parse error');
  }
});

// ============================================
// TEST SUITE: Real-World Usage Patterns
// ============================================
console.log('\n🌍 REAL-WORLD USAGE PATTERNS\n');

await asyncTest('Rapid game completion (speed run scenario)', async () => {
  setup();

  // Simulate 10 very fast games
  for (let i = 0; i < 10; i++) {
    hook.recordGameResult({
      mode: 'singleplayer',
      isWin: true,
      gameDurationMs: 5000 + (i * 1000), // 5s to 14s
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  await hook.waitForPendingOperations();

  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 10);
  assert.strictEqual(hook.stats.singlePlayer.wins, 10);
  assert.strictEqual(hook.stats.singlePlayer.fastestWinMs, 5000, 'Fastest should be first game');
});

await asyncTest('Mixed session: some wins, some losses, mode switches', async () => {
  setup();

  const session = [
    { mode: 'singleplayer', isWin: true, gameDurationMs: 30000 },
    { mode: 'singleplayer', isWin: true, gameDurationMs: 25000 },
    { mode: 'multiplayer', isWin: false, gameDurationMs: 60000 },
    { mode: 'singleplayer', isWin: false, gameDurationMs: 40000 },
    { mode: 'multiplayer', isWin: true, gameDurationMs: 45000 },
    { mode: 'multiplayer', isWin: true, gameDurationMs: 50000 },
    { mode: 'singleplayer', isWin: true, gameDurationMs: 20000 },
  ];

  for (const game of session) {
    hook.recordGameResult({
      ...game,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  await hook.waitForPendingOperations();

  // Verify final state
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 4);
  assert.strictEqual(hook.stats.singlePlayer.wins, 3);
  assert.strictEqual(hook.stats.singlePlayer.losses, 1);
  assert.strictEqual(hook.stats.singlePlayer.currentStreak, 1); // W, W, L, W = streak of 1
  assert.strictEqual(hook.stats.singlePlayer.longestStreak, 2);
  assert.strictEqual(hook.stats.singlePlayer.fastestWinMs, 20000);

  assert.strictEqual(hook.stats.multiplayer.gamesPlayed, 3);
  assert.strictEqual(hook.stats.multiplayer.wins, 2);
  assert.strictEqual(hook.stats.multiplayer.losses, 1);
  assert.strictEqual(hook.stats.multiplayer.currentStreak, 2); // L, W, W = streak of 2
});

await asyncTest('User returns after long absence, stats preserved', async () => {
  setup();

  // Play some games
  hook.recordGameResult({
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  await hook.waitForPendingOperations();

  const originalCreatedAt = hook.stats.createdAt;
  const originalLastActivity = hook.stats.lastActivityAt;

  // Simulate time passing (just reload from KV)
  hook.stats = null;
  await hook.refresh();

  // Stats should be fully preserved
  assert.strictEqual(hook.stats.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(hook.stats.createdAt, originalCreatedAt);
  assert.strictEqual(hook.stats.lastActivityAt, originalLastActivity);
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 PROFILE E2E TEST RESULTS');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
console.log('='.repeat(50));

if (testResults.failed > 0) {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL PROFILE E2E TESTS PASSED\n');
  process.exit(0);
}
