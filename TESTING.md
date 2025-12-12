# SameSnap Multiplayer Test Suite

## Overview

This document describes the automated test suite for SameSnap's multiplayer functionality. The tests verify game logic, WebSocket communication, and full gameplay flows.

**Total Tests: 59 | All Passing**

---

## Running Tests

```bash
# Start PartyKit server first (required for multiplayer tests)
npx partykit dev

# Run individual test suites
npm run test:logic          # 17 game logic tests
npm run test:multiplayer    # 14 basic multiplayer tests
npm run test:comprehensive  # 28 full flow tests

# Run all tests
npm run test:all            # All 59 tests
```

---

## Test Files

| File | Tests | Description |
|------|-------|-------------|
| `test-game-logic.mjs` | 17 | Core game logic, deck generation, Dobble property |
| `test-multiplayer.mjs` | 14 | Basic room management, config, match mechanics |
| `test-multiplayer-comprehensive.mjs` | 28 | Full game flows, edge cases, notifications |

---

## 1. Game Logic Tests (17 tests)

**File:** `test-game-logic.mjs`

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

### Shuffle
| Test | Description |
|------|-------------|
| shuffle preserves all elements | No data loss during shuffle |
| shuffle creates different orderings | Randomization works |

### Bot Names
| Test | Description |
|------|-------------|
| Bot names can be filtered by player name | Prevents name collisions |
| Bot names cycle correctly for many bots | Handles >10 bots |

### Card Difficulty
| Test | Description |
|------|-------------|
| CardDifficulty has three values | EASY, MEDIUM, HARD exist |
| CardDifficulty.HARD exists | Enum value accessible |

---

## 2. Basic Multiplayer Tests (14 tests)

**File:** `test-multiplayer.mjs`

### Room Management
| Test | Description |
|------|-------------|
| Player can create a room and becomes host | First player is host |
| Second player can join and is not host | Subsequent players are guests |
| Duplicate names get numbered suffix | "Player" → "Player 2" |
| Room supports up to 8 players | Max capacity enforced |

### Game Config
| Test | Description |
|------|-------------|
| Host can set card difficulty to HARD | Config changes work |
| Host can set target player count | Auto-start threshold configurable |
| Config supports all three difficulties | EASY/MEDIUM/HARD all work |

### Game Flow
| Test | Description |
|------|-------------|
| Game auto-starts when target players reached | Auto-start triggers countdown |
| Host can manually start game | Manual start works |
| Players receive cards on round_start | Card dealing works |

### Match Mechanics
| Test | Description |
|------|-------------|
| Valid match attempt is accepted | Correct matches win round |
| Invalid match attempt triggers penalty | Wrong matches penalize |

### Player Lifecycle
| Test | Description |
|------|-------------|
| Player can leave room | Graceful disconnect |
| Ping/pong works for latency | Latency measurement works |

---

## 3. Comprehensive Tests (28 tests)

**File:** `test-multiplayer-comprehensive.mjs`

### Full Game Playthrough
| Test | Description |
|------|-------------|
| Complete game: 2 players, play until deck exhausted, verify game_over | Full game from start to finish |
| Winner is player with highest score at game_over | Correct winner determination |

### Round Transitions
| Test | Description |
|------|-------------|
| Round number increments after each win | Round counter works |
| Center card changes after each round | New center card drawn |
| Winner gets new card (old center) after winning | Dobble card swap mechanic |
| Non-winner keeps their card | Losers retain their card |

### Notification Broadcasts
| Test | Description |
|------|-------------|
| All players receive round_winner message | Winner broadcast to all |
| round_winner includes correct matchedSymbolId | Symbol highlighting data sent |
| round_winner includes winnerName | Winner name included |
| All players receive game_over with all scores | Final scores broadcast |

### Arbitration (Simultaneous Matches)
| Test | Description |
|------|-------------|
| Near-simultaneous matches: one winner is selected | Tie-breaking works |
| Slightly earlier serverTimestamp wins arbitration | First arrival wins |

### Error Handling
| Test | Description |
|------|-------------|
| Room full error when 9th player tries to join | Max players enforced |
| Cannot join game in progress | Late join blocked |
| Non-host cannot start game | Host-only action |
| Non-host cannot change config | Host-only action |
| Cannot match while in penalty | Penalty enforced |
| Need at least 2 players to start | Minimum players enforced |

### Host Transfer
| Test | Description |
|------|-------------|
| New host assigned when original host leaves (waiting room) | Host reassignment |
| Host transfer works with 3+ players | Works with multiple players |

### Disconnect/Reconnect
| Test | Description |
|------|-------------|
| Player disconnect broadcasts player_disconnected | Disconnect notification |
| Game ends if only 1 player remains | Auto-end on abandonment |

### Kick Player
| Test | Description |
|------|-------------|
| Host can kick a player | Kick functionality |
| Non-host cannot kick players | Host-only action |

### Score Tracking
| Test | Description |
|------|-------------|
| Score increments correctly after each win | Score counting accurate |
| Both players see correct scores in game_over | Final scores consistent |

### Multi-Player (3-4 players)
| Test | Description |
|------|-------------|
| 3-player game works correctly | 3-player support |
| 4-player game: all receive notifications | 4-player broadcasts work |

---

## What's Verified Working

| Feature | Status | Tests |
|---------|--------|-------|
| **WebSocket Connectivity** | ✅ | Room join/leave, ping/pong |
| **Room Management** | ✅ | Create, join, leave, 8-player max |
| **Game Configuration** | ✅ | Difficulty, target players, host-only |
| **Full Gameplay** | ✅ | Start → rounds → deck exhausted → game_over |
| **Match Detection** | ✅ | Valid/invalid matches, penalties |
| **Winner Determination** | ✅ | Highest score wins, sorted correctly |
| **Round Mechanics** | ✅ | Card swaps, center card changes |
| **Notifications** | ✅ | All players receive winner/score updates |
| **Arbitration** | ✅ | Simultaneous match tie-breaking |
| **Error Handling** | ✅ | Room full, in progress, permissions |
| **Player Management** | ✅ | Host transfer, kick, disconnect |
| **Multi-player** | ✅ | 2, 3, and 4 player games |

---

## Test Architecture

### Message Handling
The test suite uses a single WebSocket message handler per player with a callback listener system to avoid duplicate message processing:

```javascript
// Single handler pushes to messages array
ws.on('message', (data) => {
  player.messages.push(msg);
  // Notify waiting listeners
  for (const listener of player._messageListeners) {
    listener(msg);
  }
});

// waitForMessage uses callbacks, not additional handlers
function waitForMessage(player, type, timeout) {
  const listener = (msg) => { /* resolve if type matches */ };
  player._messageListeners.push(listener);
}
```

### Test Utilities
- `createPlayer(roomCode, name)` - Connect and join a room
- `waitForMessage(player, type)` - Wait for specific message type
- `waitForAnyMessage(player, types)` - Wait for any of several types
- `findMatchingSymbol(card1, card2)` - Find the shared symbol
- `cleanup(...players)` - Close all connections

---

## Last Run Results

```
======================================================================
📊 COMPREHENSIVE TEST RESULTS
======================================================================
✅ Passed: 59
❌ Failed: 0
📝 Total:  59
======================================================================

✅ ALL TESTS PASSED!
======================================================================
```

**Date:** December 2024
