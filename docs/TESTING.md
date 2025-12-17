# SameSnap Test Suite

## Overview

Comprehensive automated test suite for SameSnap covering game logic, single-player, multiplayer, and profile features.

**Total Tests: 212 | All Passing**

---

## Running Tests

```bash
# Quick validation (most common)
npm run test:quick         # 212 tests, ~5 min

# Full suite with stress tests
npm run test:all           # All tests including stress, ~15 min

# Individual suites
npm run test:logic         # 21 game logic tests
npm run test:singleplayer  # 26 single-player tests
npm run test:multiplayer   # Multiplayer + comprehensive tests
npm run test:hook          # 33 hook state tests

# Profile features only
node scripts/run-tests.mjs profile  # 77 tests (stats, cardsets, E2E)
```

**Note:** Multiplayer tests require PartyKit server: `npm run dev:party`

---

## Test File Inventory

| File | Tests | Description |
|------|-------|-------------|
| `tests/test-game-logic.mjs` | 21 | Core game logic, deck generation, Dobble property |
| `tests/test-hook-state.mjs` | 33 | React hook message handling, state transitions |
| `tests/test-single-player-updates.mjs` | 26 | Bot AI, game flow, scoring |
| `tests/test-multiplayer.mjs` | 14 | Room management, config, match mechanics |
| `tests/test-multiplayer-comprehensive.mjs` | 41 | Full game flows, arbitration, lifecycle |
| `tests/test-stats-logic.mjs` | 22 | User stats business logic |
| `tests/test-cardsets-logic.mjs` | 38 | Card set validation |
| `tests/test-profile-e2e.mjs` | 17 | E2E behavioral tests |

---

## 1. Game Logic Tests (21 tests)

**File:** `tests/test-game-logic.mjs`

### Symbol Sets
| Test | Description |
|------|-------------|
| EMOJIS array has at least 57 symbols | Verifies enough symbols for full deck |
| EMOJIS_HARD array has at least 57 symbols | Verifies HARD mode symbol set |
| SYMBOLS array maps correctly | Symbol objects have correct id/char |
| SYMBOLS_HARD array maps correctly | HARD symbols map correctly |
| BOT_NAMES has 10 unique names | Bot name pool is valid |

### Deck Generation
| Test | Description |
|------|-------------|
| generateDeck creates 57 cards for order-7 | Projective plane math produces correct deck size |
| Each card has 8 symbols (N+1 for N=7) | Cards have correct symbol count |
| Cards have unique IDs | No duplicate card IDs |
| generateDeck with custom symbols (HARD mode) works | HARD symbol set integrates correctly |

### Dobble Property (Critical)
| Test | Description |
|------|-------------|
| Any two cards share exactly ONE symbol | Mathematical guarantee of game mechanic |
| findMatch returns the correct shared symbol | Match detection works |

### Shuffle & Bot Names
| Test | Description |
|------|-------------|
| shuffle preserves all elements | No data loss during shuffle |
| shuffle creates different orderings | Randomization works |
| Bot names can be filtered by player name | Prevents name collisions |
| Bot names cycle correctly for many bots | Handles >10 bots |

---

## 2. Hook State Tests (33 tests)

**File:** `tests/test-hook-state.mjs`

Tests React hook message handling using a HookSimulator that models useMultiplayerGame behavior:

- room_state processing
- player_joined/player_left updates
- Phase transitions (WAITING → COUNTDOWN → PLAYING)
- Host reassignment
- Penalty handling
- Score updates
- Reconnection state

---

## 3. Single Player Tests (26 tests)

**File:** `tests/test-single-player-updates.mjs`

### Game Flow
- Game initialization with player and bots
- Correct card dealing
- Round transitions
- Score tracking

### Bot AI
- Bot scheduling at correct difficulty levels
- Bot timer cleanup on round end
- Bot finding correct matches

### Edge Cases
- Game completion detection
- Winner determination
- Score ties

---

## 4. Multiplayer Tests (55 tests)

**Files:** `tests/test-multiplayer.mjs`, `tests/test-multiplayer-comprehensive.mjs`

### Room Management (14 tests)
| Test | Description |
|------|-------------|
| Player can create a room and becomes host | First player is host |
| Second player can join and is not host | Subsequent players are guests |
| Duplicate names get numbered suffix | "Player" → "Player 2" |
| Room supports up to 8 players | Max capacity enforced |
| Host can set card difficulty | Config changes work |
| Host can set target player count | Auto-start threshold |
| Game auto-starts when target reached | Auto-start triggers countdown |

### Game Flow & Arbitration (41 tests)
| Test | Description |
|------|-------------|
| Complete game playthrough | Start to finish with deck exhaustion |
| Round number increments | Round counter works |
| Center card changes | New center card drawn |
| Winner gets new card | Dobble card swap mechanic |
| All players receive round_winner | Winner broadcast |
| Near-simultaneous matches: one winner selected | Tie-breaking |
| Host transfer when original host leaves | Host reassignment |
| Player disconnect broadcasts | Disconnect notification |
| Host can kick a player | Kick functionality |

---

## 5. Stats Logic Tests (22 tests)

**File:** `tests/test-stats-logic.mjs`

Tests stats business logic matching actual API behavior:

### Streak Tracking
| Test | Description |
|------|-------------|
| Win increments streak | Current streak increases |
| Loss resets streak | Current streak goes to 0 |
| Streak doesn't exceed longest | Longest streak preserved |
| New longest streak recorded | Updates when beaten |

### Mode Separation
| Test | Description |
|------|-------------|
| Single-player stats isolated | Doesn't affect multiplayer |
| Multiplayer stats isolated | Doesn't affect single-player |
| Total games aggregated | Combines both modes |

### Edge Cases
| Test | Description |
|------|-------------|
| Empty payload handling | Graceful defaults |
| Zero-time wins | Floor to 0.001s |
| Negative times rejected | Validation |
| Fastest win tracking | Only updates if faster |

---

## 6. Card Sets Logic Tests (38 tests)

**File:** `tests/test-cardsets-logic.mjs`

### Symbol Validation
| Test | Description |
|------|-------------|
| Exactly 57 symbols required | Count validation |
| Symbols must be unique | No duplicates allowed |
| Less than 57 rejected | Too few symbols |
| More than 57 rejected | Too many symbols |
| Duplicate symbols rejected | Set uniqueness check |

### Name Validation
| Test | Description |
|------|-------------|
| Empty name rejected | Required field |
| Whitespace-only rejected | Must have content |
| Name trimmed | Leading/trailing spaces removed |
| Special characters allowed | Unicode names work |

### Emoji Edge Cases
| Test | Description |
|------|-------------|
| Skin tone modifiers | 👋🏽 counts as one symbol |
| ZWJ sequences | 👨‍👩‍👧 counts as one symbol |
| Flag emojis | 🇺🇸 counts as one symbol |
| Keycap sequences | 1️⃣ counts as one symbol |
| Mixed emoji types | All types work together |

### Storage Limits
| Test | Description |
|------|-------------|
| Max 10 card sets per user | Limit enforced |
| Create at limit rejected | Clear error message |
| Delete allows new create | Limit recalculated |

---

## 7. Profile E2E Tests (17 tests)

**File:** `tests/test-profile-e2e.mjs`

Behavioral tests focusing on system behavior under realistic conditions:

### Fire-and-Forget Pattern
| Test | Description |
|------|-------------|
| Stats recording doesn't block game | Non-blocking writes |
| Failed recording doesn't throw | Graceful error handling |
| Multiple rapid recordings complete | Handles burst traffic |

### Concurrency
| Test | Description |
|------|-------------|
| Concurrent writes serialize correctly | No race conditions |
| Read during write returns consistent state | Isolation |
| Rapid refresh doesn't corrupt state | Handles retries |

### Auth State Transitions
| Test | Description |
|------|-------------|
| Sign-out clears local state | Privacy preserved |
| Sign-in loads cloud state | Data restored |
| Token refresh during operation | Handles auth changes |

### Network Conditions
| Test | Description |
|------|-------------|
| Simulated latency handled | 100-500ms delays |
| Timeout recovery | Retries on failure |

---

## Test Runner Architecture

### Parallel Execution

The test runner (`scripts/run-tests.mjs`) uses staged parallel execution:

```
Stage 1 (parallel): logic + hook + singleplayer + statslogic + cardsetslogic
Stage 2 (parallel): multiplayer + profilee2e
Stage 3 (parallel): gameflow + arbitration + lifecycle + scores
```

### Suite Groups

```bash
npm run test:quick    # Stages 1-2 (most coverage, fast)
npm run test:all      # All stages including stress
node scripts/run-tests.mjs profile  # Stats + cardsets + E2E only
```

### Logging

Results logged to `logs/test-runs-TIMESTAMP.log` with:
- Per-suite timing
- Pass/fail counts
- Test count changes vs previous run
- Symlink at `logs/test-runs-latest.log`

---

## Key Testing Patterns

### Mock Implementations

Tests use mocks that simulate real-world behavior:

```javascript
// MockKVStore - Simulates Vercel KV with latency
class MockKVStore {
  constructor(latencyMs = 50) { ... }
  async get(key) { await this.simulateLatency(); ... }
  async set(key, value) { await this.simulateLatency(); ... }
}

// MockStatsAPI - Serializes concurrent operations
class MockStatsAPI {
  async recordGame(userId, payload) {
    const previousLock = this._operationLock;
    this._operationLock = new Promise(resolve => { releaseLock = resolve; });
    await previousLock;  // Serialize operations
    try { ... } finally { releaseLock(); }
  }
}
```

### Fire-and-Forget Testing

Stats recording is designed to not block game flow:

```javascript
// Test verifies operation completes without blocking
const promise = recordGameResult(payload);
// Continue immediately - don't await
await someOtherOperation();
// Later verify it completed
await promise; // Should already be resolved
```

### Concurrency Testing

E2E tests simulate race conditions:

```javascript
// Fire multiple concurrent operations
const operations = [
  api.recordGame(userId, payload1),
  api.recordGame(userId, payload2),
  api.recordGame(userId, payload3),
];
const results = await Promise.all(operations);
// Verify serialization - all operations reflected in final state
```

---

## Verification

All 212 tests passing as of December 2024:

```
======================================================================
📊 FINAL SUMMARY
======================================================================
   Total Duration: 4m 52s
   Tests:          212/212 passed
   ✅ ALL TESTS PASSED
======================================================================
```

---

## Adding New Tests

1. Create test file in `tests/` directory
2. Add suite definition to `scripts/run-tests.mjs`:
   ```javascript
   SUITES = {
     newsuite: {
       name: 'New Suite',
       command: 'node',
       args: ['tests/test-newsuite.mjs'],
       expectedDuration: '~5s'
     }
   }
   ```
3. Add to appropriate group in `GROUPS` object
4. Run `npm run test:quick` to verify
