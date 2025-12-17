#!/usr/bin/env node
/**
 * QA Test Suite - Stats Logic & Business Rules
 * Tests stats tracking, streak calculations, fastest win tracking
 *
 * These tests validate the business logic for:
 * - Stats initialization and defaults
 * - Win/loss tracking and streak calculations
 * - Fastest win time comparisons
 * - Mode separation (single-player vs multiplayer)
 * - Timestamp accuracy
 */

import assert from 'assert';

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
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
// Mock Implementation of Stats Logic
// (Mirrors the actual API logic for testing)
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

// Simulates the POST /api/stats logic
function recordGameResult(stats, payload) {
  const now = Date.now();

  // Initialize if first game
  if (!stats) {
    stats = {
      ...DEFAULT_USER_STATS,
      singlePlayer: { ...DEFAULT_MODE_STATS },
      multiplayer: { ...DEFAULT_MODE_STATS },
      createdAt: now,
    };
  }

  // Get the mode stats to update
  const modeKey = payload.mode === 'singleplayer' ? 'singlePlayer' : 'multiplayer';
  const modeStats = { ...stats[modeKey] };

  // Update stats
  modeStats.gamesPlayed += 1;

  if (payload.isWin) {
    modeStats.wins += 1;
    modeStats.currentStreak += 1;

    // Update longest streak if current is higher
    if (modeStats.currentStreak > modeStats.longestStreak) {
      modeStats.longestStreak = modeStats.currentStreak;
    }

    // Update fastest win if this is faster (or first win)
    if (modeStats.fastestWinMs === null || payload.gameDurationMs < modeStats.fastestWinMs) {
      modeStats.fastestWinMs = payload.gameDurationMs;
    }
  } else {
    modeStats.losses += 1;
    modeStats.currentStreak = 0; // Reset streak on loss
  }

  return {
    ...stats,
    [modeKey]: modeStats,
    lastActivityAt: now,
    updatedAt: now,
  };
}

// ============================================
// TEST SUITE: Default Stats
// ============================================
console.log('\n📊 DEFAULT STATS TESTS\n');

test('Default stats have zero values', () => {
  const stats = { ...DEFAULT_USER_STATS, singlePlayer: { ...DEFAULT_MODE_STATS }, multiplayer: { ...DEFAULT_MODE_STATS } };

  assert.strictEqual(stats.singlePlayer.gamesPlayed, 0);
  assert.strictEqual(stats.singlePlayer.wins, 0);
  assert.strictEqual(stats.singlePlayer.losses, 0);
  assert.strictEqual(stats.singlePlayer.currentStreak, 0);
  assert.strictEqual(stats.singlePlayer.longestStreak, 0);
  assert.strictEqual(stats.singlePlayer.fastestWinMs, null);

  assert.strictEqual(stats.multiplayer.gamesPlayed, 0);
});

test('Default stats have null fastestWinMs (not 0)', () => {
  const stats = { ...DEFAULT_USER_STATS, singlePlayer: { ...DEFAULT_MODE_STATS } };
  assert.strictEqual(stats.singlePlayer.fastestWinMs, null, 'fastestWinMs should be null, not 0');
});

// ============================================
// TEST SUITE: Game Recording - Wins
// ============================================
console.log('\n🏆 WIN TRACKING TESTS\n');

test('First win increments all counters correctly', () => {
  const payload = {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  };

  const result = recordGameResult(null, payload);

  assert.strictEqual(result.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(result.singlePlayer.wins, 1);
  assert.strictEqual(result.singlePlayer.losses, 0);
  assert.strictEqual(result.singlePlayer.currentStreak, 1);
  assert.strictEqual(result.singlePlayer.longestStreak, 1);
  assert.strictEqual(result.singlePlayer.fastestWinMs, 30000);
});

test('Consecutive wins increase streak correctly', () => {
  let stats = null;

  const winPayload = {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  };

  // Win 5 games in a row
  for (let i = 0; i < 5; i++) {
    stats = recordGameResult(stats, winPayload);
  }

  assert.strictEqual(stats.singlePlayer.gamesPlayed, 5);
  assert.strictEqual(stats.singlePlayer.wins, 5);
  assert.strictEqual(stats.singlePlayer.currentStreak, 5);
  assert.strictEqual(stats.singlePlayer.longestStreak, 5);
});

test('Faster win updates fastestWinMs', () => {
  let stats = null;

  // First win: 30 seconds
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 30000);

  // Second win: 20 seconds (faster)
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 20000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 20000, 'Should update to faster time');
});

test('Slower win does NOT update fastestWinMs', () => {
  let stats = null;

  // First win: 20 seconds
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 20000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // Second win: 30 seconds (slower)
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 20000, 'Should keep faster time');
});

// ============================================
// TEST SUITE: Game Recording - Losses
// ============================================
console.log('\n💔 LOSS TRACKING TESTS\n');

test('Loss resets currentStreak to 0', () => {
  let stats = null;

  // Win 3 games
  for (let i = 0; i < 3; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer',
      isWin: true,
      gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  assert.strictEqual(stats.singlePlayer.currentStreak, 3);

  // Lose
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: false,
    gameDurationMs: 45000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.currentStreak, 0, 'Streak should reset to 0 on loss');
  assert.strictEqual(stats.singlePlayer.longestStreak, 3, 'Longest streak should be preserved');
  assert.strictEqual(stats.singlePlayer.losses, 1);
});

test('Loss does NOT update fastestWinMs', () => {
  let stats = null;

  // Win with 30s
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: true,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // Lose with 10s (even though faster)
  stats = recordGameResult(stats, {
    mode: 'singleplayer',
    isWin: false,
    gameDurationMs: 10000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 30000, 'Loss time should not affect fastestWinMs');
});

test('First game as loss has null fastestWinMs', () => {
  const stats = recordGameResult(null, {
    mode: 'singleplayer',
    isWin: false,
    gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(stats.singlePlayer.losses, 1);
  assert.strictEqual(stats.singlePlayer.fastestWinMs, null, 'No wins yet, should be null');
});

// ============================================
// TEST SUITE: Streak Edge Cases
// ============================================
console.log('\n🔥 STREAK EDGE CASES\n');

test('Win after loss starts new streak at 1', () => {
  let stats = null;

  // Win 3, lose 1, win 1
  for (let i = 0; i < 3; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }
  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: false, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.currentStreak, 1, 'New streak after loss');
  assert.strictEqual(stats.singlePlayer.longestStreak, 3, 'Longest preserved');
});

test('New streak can surpass previous longest', () => {
  let stats = null;

  // Win 3, lose 1, win 5
  for (let i = 0; i < 3; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }
  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: false, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  for (let i = 0; i < 5; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  assert.strictEqual(stats.singlePlayer.currentStreak, 5);
  assert.strictEqual(stats.singlePlayer.longestStreak, 5, 'Longest should be updated');
});

test('Multiple consecutive losses dont go negative', () => {
  let stats = null;

  // Lose 5 times
  for (let i = 0; i < 5; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: false, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  assert.strictEqual(stats.singlePlayer.currentStreak, 0);
  assert.strictEqual(stats.singlePlayer.losses, 5);
  assert.strictEqual(stats.singlePlayer.longestStreak, 0);
});

// ============================================
// TEST SUITE: Mode Separation
// ============================================
console.log('\n🎮 MODE SEPARATION TESTS\n');

test('Singleplayer stats are separate from multiplayer', () => {
  let stats = null;

  // Win singleplayer
  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // Lose multiplayer
  stats = recordGameResult(stats, {
    mode: 'multiplayer', isWin: false, gameDurationMs: 45000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });

  assert.strictEqual(stats.singlePlayer.gamesPlayed, 1);
  assert.strictEqual(stats.singlePlayer.wins, 1);
  assert.strictEqual(stats.singlePlayer.currentStreak, 1);

  assert.strictEqual(stats.multiplayer.gamesPlayed, 1);
  assert.strictEqual(stats.multiplayer.losses, 1);
  assert.strictEqual(stats.multiplayer.currentStreak, 0);
});

test('Multiplayer loss does not affect singleplayer streak', () => {
  let stats = null;

  // Win 3 singleplayer
  for (let i = 0; i < 3; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  // Lose multiplayer
  stats = recordGameResult(stats, {
    mode: 'multiplayer', isWin: false, gameDurationMs: 45000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });

  assert.strictEqual(stats.singlePlayer.currentStreak, 3, 'SP streak unaffected by MP loss');
  assert.strictEqual(stats.multiplayer.currentStreak, 0);
});

test('Each mode tracks its own fastest win', () => {
  let stats = null;

  // Fast singleplayer win
  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 15000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  // Slower multiplayer win
  stats = recordGameResult(stats, {
    mode: 'multiplayer', isWin: true, gameDurationMs: 60000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 4 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 15000);
  assert.strictEqual(stats.multiplayer.fastestWinMs, 60000);
});

// ============================================
// TEST SUITE: Timestamp Tracking
// ============================================
console.log('\n⏰ TIMESTAMP TESTS\n');

test('First game sets createdAt timestamp', () => {
  const before = Date.now();
  const stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  const after = Date.now();

  assert(stats.createdAt >= before && stats.createdAt <= after, 'createdAt should be current time');
});

test('Each game updates lastActivityAt', () => {
  let stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  const firstActivity = stats.lastActivityAt;

  // Small delay to ensure different timestamp
  const delay = 5;
  const start = Date.now();
  while (Date.now() - start < delay) {}

  stats = recordGameResult(stats, {
    mode: 'singleplayer', isWin: false, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert(stats.lastActivityAt >= firstActivity, 'lastActivityAt should be updated');
});

test('createdAt is preserved across games', () => {
  let stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });
  const originalCreatedAt = stats.createdAt;

  // Play more games
  for (let i = 0; i < 5; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: true, gameDurationMs: 30000,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  assert.strictEqual(stats.createdAt, originalCreatedAt, 'createdAt should never change');
});

// ============================================
// TEST SUITE: Edge Cases
// ============================================
console.log('\n🔧 EDGE CASES\n');

test('Very fast win time (1ms) is recorded', () => {
  const stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 1,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 1);
});

test('Zero duration win is recorded', () => {
  const stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: 0,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, 0);
});

test('Very long game duration is recorded', () => {
  const longDuration = 3600000; // 1 hour
  const stats = recordGameResult(null, {
    mode: 'singleplayer', isWin: true, gameDurationMs: longDuration,
    context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
  });

  assert.strictEqual(stats.singlePlayer.fastestWinMs, longDuration);
});

test('Large number of games tracked correctly', () => {
  let stats = null;
  const gameCount = 1000;

  for (let i = 0; i < gameCount; i++) {
    stats = recordGameResult(stats, {
      mode: 'singleplayer', isWin: i % 2 === 0, gameDurationMs: 30000 + i,
      context: { cardLayout: 'ORDERLY', cardSetId: 'default', cardSetName: 'Default', playerCount: 2 }
    });
  }

  assert.strictEqual(stats.singlePlayer.gamesPlayed, gameCount);
  assert.strictEqual(stats.singlePlayer.wins, gameCount / 2);
  assert.strictEqual(stats.singlePlayer.losses, gameCount / 2);
  assert.strictEqual(stats.singlePlayer.fastestWinMs, 30000, 'First win was fastest');
});

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(50));
console.log('📊 STATS LOGIC TEST RESULTS');
console.log('='.repeat(50));
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📝 Total:  ${testResults.passed + testResults.failed}`);
console.log('='.repeat(50));

if (testResults.failed > 0) {
  console.log('\n❌ SOME TESTS FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL STATS LOGIC TESTS PASSED\n');
  process.exit(0);
}
