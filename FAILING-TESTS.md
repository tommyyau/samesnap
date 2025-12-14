# Failing Tests Analysis

## Current Failing Tests (13 total)

### Config Tests
1. **Host can update config during GAME_OVER before rematch**
   - Line: 452
   - Error: Timeout waiting for message type: round_start

### Match Tests
2. **Valid match attempt is accepted**
   - Line: 598
   - Error: Timeout waiting for message type: round_start

### Last Player Standing Tests
3. **Last player wins after winning some rounds then opponent leaves**
   - Line: 1194
   - Error: Timeout waiting for message type: round_start

4. **Last player standing works when opponent explicitly leaves (not disconnect)**
   - Line: 1257
   - Error: Timeout waiting for message type: round_start

5. **Game continues when 1 of 3 players leaves (no premature end)**
   - Line: 1333
   - Error: Timeout waiting for message type: round_start

### Rejoin Tests
6. **Solo rejoin gets booted with message after window expires**
   - Line: 1583
   - Error: Timeout waiting for message type: round_start

7. **Two players sending play_again resets room immediately**
   - Line: 1630
   - Error: Timeout waiting for message type: round_start

8. **Room code can be reused after rejoin window expires with no rejoins**
   - Line: 1691
   - Error: Timeout waiting for message type: round_start

### Game Over Exit Tests
9. **Multiple players can exit during GAME_OVER without resetting rejoin state (3 players)**
   - Line: ~1820
   - Error: Timeout waiting for message type: round_start

10. **Two players can send play_again during GAME_OVER and restart game**
    - Line: ~1910
    - Error: Timeout waiting for message type: round_start

### Play Again Room Reset Tests
11. **Play again: both players click Play Again, room resets to WAITING phase**
    - Line: 2225
    - Error: Timeout waiting for message type: round_start

12. **Play again: room_state after reset shows both players**
    - Line: 2307
    - Error: Timeout waiting for message type: round_start

13. **Play again: can start new game after room reset**
    - Line: 2379
    - Error: Timeout waiting for message type: round_start

---

## Tests That Were Removed (auto-start feature removed)

These tests were testing auto-start behavior which no longer exists:

1. **Game auto-starts when target players reached** - REMOVED
2. **Auto-start does NOT trigger when guest disconnects (ghost player fix)** - REMOVED
3. **Countdown completion fails when guest disconnects during countdown (ghost player fix)** - REMOVED
4. **Duplicate "Host can manually start game"** - REMOVED (was duplicate)

---

## Observations

### Tests Are Flaky
- Some tests pass on one run and fail on another
- Previous run showed 9 failures, current run shows 13
- All failures have the same error: "Timeout waiting for message type: round_start"

### Common Pattern in Failing Tests
All failing tests:
1. Send `start_game` message
2. Wait for `round_start` with 10000ms timeout
3. Timeout before receiving `round_start`

### Server Timing
- Server sends `countdown` messages (5,4,3,2,1,0) over 5 seconds
- Server sends `round_start` after countdown
- 10 second timeout should be sufficient but isn't reliable

### Previous Fix Applied
Many tests were fixed by changing `set_config` to `start_game`:
```javascript
// OLD (broken):
host.ws.send(JSON.stringify({ type: 'set_config', ... }));

// NEW (fixed):
host.ws.send(JSON.stringify({ type: 'start_game', ... }));
```

The failing tests already have this fix applied.
