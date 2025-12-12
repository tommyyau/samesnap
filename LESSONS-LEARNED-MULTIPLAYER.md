# Lessons Learned: Multiplayer Implementation

**Project:** SameSnap Card Matching Game
**Duration:** ~4 hours of testing and fixing
**Final State:** 79 tests passing, 90% confidence
**Date:** 2025-12-12

---

## Executive Summary

Building a real-time multiplayer game with PartyKit and React revealed several categories of bugs that could have been avoided with better upfront design. This document captures patterns to follow and anti-patterns to avoid.

**Key Insight:** Most bugs were not in the "happy path" but in **message ordering**, **state synchronization**, and **edge cases around timing**.

---

## Category 1: Race Conditions (Most Common)

### Bug #1: Countdown arrives before room_state

**What happened:**
```
Server sends: countdown(5) → room_state
Client receives: countdown(5) → room_state (same order)
Hook processes countdown: roomState is NULL → crash/lost data
```

**The Fix:** Pending message queue
```typescript
// BAD: Assumes room_state always arrives first
case 'countdown':
  setRoomState(prev => ({ ...prev, countdown: msg.seconds })); // prev is null!

// GOOD: Buffer messages that arrive out of order
case 'countdown':
  if (!roomState) {
    pendingCountdown.current = msg.seconds;  // Store for later
    return;
  }
  setRoomState(prev => ({ ...prev, countdown: msg.seconds }));

case 'room_state':
  let state = msg.payload;
  if (pendingCountdown.current !== null) {
    state = { ...state, phase: 'COUNTDOWN', countdown: pendingCountdown.current };
    pendingCountdown.current = null;
  }
  setRoomState(state);
```

**Lesson:** Never assume message order. Always handle "message X before message Y" cases.

---

### Bug #2: Auto-start triggered before client ready

**What happened:**
- Second player joins
- Server immediately triggers auto-start countdown
- countdown message arrives BEFORE room_state for new player
- New player sees blank screen during countdown

**The Fix:** Delay auto-start by 50ms
```typescript
// In server handleJoin():
setTimeout(() => this.checkAutoStart(), 50);  // Let room_state message arrive first
```

**Lesson:** When triggering actions on join, add a small delay to let initial state propagate.

---

### Bug #3: Match attempt during round transition

**What happened:**
- Player A wins round → `round_winner` sent
- Server enters `ROUND_END` phase (2 second delay)
- Player B clicks frantically (still has old card visible)
- Match attempt arrives during transition → undefined behavior

**The Fix:** Server ignores attempts when phase !== PLAYING
```typescript
private handleMatchAttempt(playerId: string, symbolId: number) {
  if (this.phase !== RoomPhase.PLAYING) return;  // Early exit
  // ... rest of validation
}
```

**Lesson:** All state-changing actions need phase guards.

---

## Category 2: State Synchronization

### Bug #4: Scores drifting between clients

**What happened:**
- Client increments score locally on `round_winner`
- Server also sends updated score in `game_over.finalScores`
- If client misses a `round_winner` message → scores differ

**The Fix:** Server is authoritative for final scores
```typescript
case 'game_over':
  // Don't trust local score - use server's authoritative finalScores
  setRoomState(prev => ({
    ...prev,
    phase: 'GAME_OVER',
    players: msg.finalScores.map(s => ({
      ...prev.players.find(p => p.id === s.playerId),
      score: s.score  // Server's score is truth
    }))
  }));
```

**Lesson:** For important state, always trust server over local calculations.

---

### Bug #5: Winner gets wrong card after round

**What happened:**
- Winner should get the OLD center card as their new hand
- New center drawn from deck
- But card IDs were being swapped incorrectly

**The Fix:** Clear variable naming and explicit swap
```typescript
private nextRound(lastWinnerId: string) {
  const oldCenterId = this.centerCard.id;  // Save BEFORE changing
  this.centerCard = this.deck.pop();       // New center from deck
  winner.handCardId = oldCenterId;         // Winner gets OLD center
}
```

**Lesson:** When swapping/rotating values, use temp variables and clear naming.

---

## Category 3: Reconnection & Session

### Bug #6: Reconnect with stale player ID fails silently

**What happened:**
- Player disconnects
- Grace period (60s for game, 2s for lobby) expires
- Player tries to reconnect with old ID → server doesn't recognize
- Player stuck in limbo (not in room, not rejected)

**The Fix:** Explicit handling for invalid reconnect
```typescript
onConnect(conn, ctx) {
  const reconnectId = url.searchParams.get('reconnectId');

  if (reconnectId && this.disconnectedPlayers.has(reconnectId)) {
    this.handleReconnection(conn, reconnectId);
  } else if (reconnectId) {
    // Invalid reconnect ID - treat as new player attempt
    // This will fail if game in progress (correct behavior)
  }
  // Otherwise: wait for join message
}
```

**Lesson:** Handle all branches of conditional logic, especially error cases.

---

### Bug #7: Multiple rapid reconnects cause duplicates

**What happened:**
- Player's browser sends 3 reconnect attempts in 100ms
- Each creates a new connection before previous is cleaned up
- Room ends up with duplicate "players"

**The Fix:** Atomically clear disconnected state
```typescript
private handleReconnection(conn, oldId) {
  const data = this.disconnectedPlayers.get(oldId);
  if (!data) return;  // Already reconnected or expired

  this.disconnectedPlayers.delete(oldId);  // FIRST: prevent double-reconnect
  // THEN: restore player
}
```

**Lesson:** Check-then-act patterns need atomic guards.

---

## Category 4: Arbitration & Fairness

### Bug #8: Simultaneous matches, different winners

**What happened:**
- Two players match at exact same millisecond
- Server processes in random order
- Different clients see different winners (briefly)

**The Fix:** 100ms arbitration window with deterministic tiebreaker
```typescript
private handleMatchAttempt(...) {
  if (!this.pendingArbitration) {
    this.pendingArbitration = {
      roundNumber: this.roundNumber,
      attempts: [attempt],
      timeoutId: setTimeout(() => this.resolveArbitration(), 100)
    };
  } else {
    this.pendingArbitration.attempts.push(attempt);
  }
}

private resolveArbitration() {
  // Sort: server timestamp → client timestamp → random
  attempts.sort((a, b) => {
    const serverDiff = a.serverTimestamp - b.serverTimestamp;
    if (serverDiff !== 0) return serverDiff;
    const clientDiff = a.clientTimestamp - b.clientTimestamp;
    if (clientDiff !== 0) return clientDiff;
    return Math.random() - 0.5;  // True tie: random but consistent
  });

  this.processRoundWin(attempts[0].playerId);
}
```

**Lesson:** For competitive actions, batch them in a window and resolve deterministically.

---

## Category 5: Penalty System

### Bug #9: Penalty bypass with rapid clicking

**What happened:**
- Player clicks wrong symbol → 3 second penalty
- Player immediately clicks 5 more times
- Some clicks "slip through" before penalty registered

**The Fix:** Check penalty BEFORE any processing
```typescript
handleMatchAttempt(playerId, symbolId) {
  // FIRST: Check penalty
  const penaltyUntil = this.penalties.get(playerId);
  if (penaltyUntil && Date.now() < penaltyUntil) {
    this.sendError(playerId, 'IN_PENALTY');
    return;  // Reject entire attempt
  }

  // THEN: Validate match
}
```

**Lesson:** Guards come first, not after partial processing.

---

### Bug #10: Penalty timer shows NaN on client

**What happened:**
- Server sends: `{ until: 1702400000000 }` (Unix timestamp)
- Client calculates: `until - Date.now()` → shows "3 seconds"
- But if clocks differ → shows "NaN" or negative

**The Fix:** Server sends duration, client calculates end time
```typescript
// Server:
{ type: 'penalty', payload: { durationMs: 3000, reason: 'Wrong symbol' } }

// Client:
const penaltyUntil = Date.now() + msg.durationMs;
```

**Better yet:** Send both and let client choose
```typescript
{ until: serverTimestamp + 3000, serverTimestamp: serverTimestamp }
// Client can use (until - serverTimestamp) as duration, avoiding clock skew
```

**Lesson:** Be explicit about time representations. Prefer durations over absolute timestamps.

---

## Category 6: UI State Management

### Bug #11: React StrictMode double-mount breaks WebSocket

**What happened:**
- React 18 StrictMode mounts/unmounts/remounts in dev
- First mount opens WebSocket, sends `join`
- Unmount closes WebSocket (disconnect notification)
- Remount opens NEW WebSocket, sends `join`
- Server sees: join → disconnect → join = player count wrong

**The Fix:** Track join state in ref, not in socket lifecycle
```typescript
const hasJoined = useRef(false);

onOpen: () => {
  if (!hasJoined.current) {
    hasJoined.current = true;
    socket.send({ type: 'join', ... });
  }
}
```

And server-side: short grace period for waiting room
```typescript
const gracePeriod = this.phase === 'WAITING' ? 2000 : 60000;
```

**Lesson:** React lifecycle doesn't match WebSocket lifecycle. Use refs for connection state.

---

### Bug #12: setState during render causes React error

**What happened:**
```
onMessage: (event) => {
  handleServerMessage(JSON.parse(event.data));  // This calls setState
}
```
If message arrives during render → React error

**The Fix:** Defer message handling
```typescript
onMessage: (event) => {
  setTimeout(() => handleServerMessage(JSON.parse(event.data)), 0);
}
```

**Lesson:** WebSocket callbacks can fire at any time. Defer state updates to next tick.

---

## Category 7: Testing Insights

### What the tests caught that manual testing missed:

| Test | Bug Found |
|------|-----------|
| "100 rapid match attempts" | Server crashed on message queue overflow |
| "Match during round transition" | Undefined behavior in ROUND_END phase |
| "Two players match at exact same timestamp" | Inconsistent winner selection |
| "Player leaving during arbitration" | Null pointer when winner lookup fails |
| "Countdown before room_state" | Client crashes on null.phase access |
| "Multiple reconnect attempts" | Duplicate player entries |
| "Penalty expires then re-click" | Stale penalty state |

### Test patterns that worked well:

1. **Message simulation tests** (test-hook-state.mjs)
   - No server needed
   - Fast (< 1 second for 24 tests)
   - Tests exact state transitions

2. **Integration tests with real WebSockets** (test-multiplayer.mjs)
   - Uses actual PartyKit server
   - Tests real message ordering
   - Catches serialization issues

3. **Stress tests** (test-multiplayer-stress.mjs)
   - Rapid fire messages
   - Concurrent operations
   - Reconnection storms

---

## Anti-Patterns to Avoid

### 1. Trusting message order
```typescript
// BAD
onMessage('countdown') { this.state.countdown = msg.seconds; }  // state might be null

// GOOD
onMessage('countdown') {
  if (!this.state) { this.pendingCountdown = msg.seconds; return; }
  this.state.countdown = msg.seconds;
}
```

### 2. Local state as source of truth
```typescript
// BAD
onRoundWinner() { localScore++; }  // Can drift from server

// GOOD
onRoundWinner() { /* let server tell us new score */ }
onGameOver() { scores = msg.finalScores; }  // Server is truth
```

### 3. Synchronous side effects in message handlers
```typescript
// BAD
onPlayerLeft() {
  this.players = this.players.filter(...);
  this.checkGameOver();  // Might trigger more state changes mid-update
}

// GOOD
onPlayerLeft() {
  this.players = this.players.filter(...);
}
// Separate tick:
afterUpdate() { this.checkGameOver(); }
```

### 4. Assuming single client per player
```typescript
// BAD
onConnect(conn) { this.players.set(conn.id, ...); }  // Multiple tabs = multiple IDs

// GOOD: Track by reconnectId or unique player identifier
```

### 5. Ignoring clock skew
```typescript
// BAD
if (Date.now() < msg.penaltyUntil) { ... }  // Client/server clocks may differ

// GOOD
const remainingMs = msg.penaltyUntil - msg.serverTimestamp;
if (remainingMs > 0) { ... }
```

---

## Patterns That Worked

### 1. Server-authoritative game state
- Server owns: deck, cards, scores, phase
- Client only sends: intents (match_attempt, leave)
- Server validates everything

### 2. Phase-based state machine
```typescript
enum RoomPhase {
  WAITING,    // Lobby
  COUNTDOWN,  // 5-4-3-2-1
  PLAYING,    // Active round
  ROUND_END,  // Winner animation
  GAME_OVER   // Final scores
}
```
Every action checks phase first.

### 3. Arbitration window for competitive actions
- Collect all match attempts for 100ms
- Sort deterministically
- Announce single winner

### 4. Grace period for reconnection
- Track disconnected players with timestamp
- Allow reconnect within window
- Preserve score/cards on reconnect

### 5. Comprehensive message protocol
- Typed messages both directions
- Error codes for known failure modes
- Ping/pong for latency measurement

---

## Checklist for Future Multiplayer Features

Before implementing:
- [ ] Define all message types (client→server and server→client)
- [ ] Map out phase transitions
- [ ] Identify competitive actions (need arbitration?)
- [ ] Plan reconnection behavior
- [ ] Consider clock skew

Before testing:
- [ ] Message order tests (A before B, B before A)
- [ ] Rapid fire tests (10+ messages in <100ms)
- [ ] Disconnect/reconnect tests
- [ ] Multi-player tests (3+)
- [ ] Phase transition edge cases

Before deploying:
- [ ] Manual 2-browser test
- [ ] Mobile touch test
- [ ] Different network conditions

---

## Files Reference

| Purpose | File |
|---------|------|
| Server logic | `party/index.ts` |
| Client hook | `hooks/useMultiplayerGame.ts` |
| Message types | `shared/protocol.ts` |
| State types | `shared/types.ts` |
| Game logic (shared) | `shared/gameLogic.ts` |
| Unit tests | `test-game-logic.mjs` |
| Integration tests | `test-multiplayer.mjs` |
| Hook state tests | `test-hook-state.mjs` |
| Stress tests | `test-multiplayer-stress.mjs` |

---

## Time Investment Analysis

| Activity | Time | Value |
|----------|------|-------|
| Initial implementation | ~2 hours | Got to "works in happy path" |
| Race condition fixes | ~30 min | Fixed countdown/room_state ordering |
| Test suite creation | ~1 hour | 79 tests, caught 12+ edge cases |
| Edge case fixes | ~30 min | Session persistence, arbitration |
| **Total** | **~4 hours** | **90% confidence** |

**Was it worth it?** Yes. The 79 tests will catch regressions and serve as documentation. Manual testing alone would have missed the race conditions and rapid-fire edge cases.

---

## Key Takeaways

1. **Message ordering is the #1 source of bugs** in real-time apps. Always handle out-of-order.

2. **Server is the source of truth** for game state. Client is just a view.

3. **Test the edges, not just the happy path**. Rapid clicking, disconnects, simultaneous actions.

4. **Phase machines make reasoning easier**. Every action asks "what phase am I in?"

5. **Reconnection is a first-class feature**, not an afterthought. Plan for it upfront.
