# Multiplayer Integration Risks - Pre-Manual Testing

## Current State
- **Server tests:** 59/59 passing
- **UI tests:** 0 (not tested)
- **Confidence:** 75% overall, 50% "just works first try"

---

## HIGH RISK: UI Integration Issues

### 1. Symbol Click Handler Connection
**File:** `components/game/MultiplayerGame.tsx:80-84`
**Risk:** `handleSymbolClick` may not correctly call `attemptMatch()`
**Verify:** Click a symbol → check browser console for WebSocket message sent

### 2. Card Rendering with Server Data
**File:** `components/game/MultiplayerGame.tsx:260-271`
**Risk:** `roomState.yourCard` may have different structure than `Card` component expects
**Verify:** Cards render with 8 symbols visible and clickable

### 3. State Updates on round_start
**File:** `hooks/useMultiplayerGame.ts:146-163`
**Risk:** `round_start` handler updates state, but component may not re-render correctly
**Verify:** After winning round, new cards appear (not stuck on old cards)

### 4. Winner Overlay Display
**File:** `components/game/MultiplayerGame.tsx:186-208`
**Risk:** `isAnimating` and `isYouWinner` conditions may not trigger correctly
**Verify:** When you win → green "YOU GOT IT!" overlay appears

---

## MEDIUM RISK: Timing/Race Conditions

### 5. Countdown → Playing Transition
**File:** `hooks/useMultiplayerGame.ts:130-144`
**Risk:** `countdown` message may arrive before `room_state`, causing null state
**Mitigation:** Already has `pendingCountdown` handling, but untested in browser

### 6. Round End → Round Start Transition
**Server:** 2 second delay between `round_winner` and next `round_start`
**Risk:** UI may not clear `roundWinnerId` before next round, causing stale overlay
**Verify:** Overlay disappears after ~2 seconds, new round starts clean

### 7. Penalty Timer Accuracy
**File:** `components/game/MultiplayerGame.tsx:66-78`
**Risk:** Penalty countdown may drift from server time
**Verify:** Penalty shows 3-2-1-0 countdown, then allows clicking again

---

## MEDIUM RISK: Multi-Browser Sync

### 8. Both Players See Same Winner
**Risk:** Player A wins, but Player B doesn't see the notification
**Verify:** Open 2 browsers, one wins → both show same winner name

### 9. Score Sync Across Clients
**Risk:** Scores may drift between players over multiple rounds
**Verify:** After 5+ rounds, both players show identical scores for everyone

### 10. Game Over Screen Consistency
**Risk:** Final scores may differ between players
**Verify:** Both players see same final rankings on game over

---

## LOW RISK: Polish Issues

### 11. Sound Timing
**File:** `components/game/MultiplayerGame.tsx:57-63`
**Risk:** Sound plays at wrong time or not at all
**Impact:** Not game-breaking, just feels wrong

### 12. Latency Display
**File:** `components/game/MultiplayerGame.tsx:220-222`
**Risk:** Latency shows 0ms or incorrect value
**Impact:** Minor, informational only

### 13. Mobile Portrait Warning
**Risk:** Warning doesn't dismiss when rotated
**Impact:** Can't play on mobile in landscape

---

## Quick Manual Test Checklist

```
□ Start server: npm run dev:all
□ Open browser 1: http://localhost:3000
□ Open browser 2: http://localhost:3000 (incognito)

LOBBY:
□ Browser 1: Create multiplayer room, see room code
□ Browser 2: Join with same room code
□ Both see each other in player list
□ Browser 1 (host): Click "Start Now"
□ Both see countdown 5-4-3-2-1

GAMEPLAY:
□ Both see cards with 8 symbols each
□ Click matching symbol on YOUR card
□ Winner sees green "YOU GOT IT!" overlay
□ Loser sees "X got it!" message
□ After ~2 seconds, new round starts with new cards
□ Scores update correctly for both players

PENALTY:
□ Click WRONG symbol intentionally
□ See red penalty overlay and countdown
□ Cannot click during penalty
□ After 3 seconds, can click again

FULL GAME:
□ Play until "Cards Left: 0"
□ Game over screen shows
□ Winner has highest score
□ Both players see same final scores
□ "Back to Lobby" works
```

---

## If Something Breaks

### Debug Steps:
1. Open browser DevTools → Console
2. Look for errors (red text)
3. Check Network tab → WS → Messages (see raw WebSocket traffic)
4. Compare what server sends vs what UI shows

### Common Fixes:
- **Blank cards:** Check `roomState.yourCard` structure in console
- **No winner overlay:** Check `roomState.phase` transitions
- **Stuck on round:** Check if `round_start` message received
- **Scores wrong:** Check `round_winner` message `winnerId`

---

## Files to Focus On If Bugs Found

| Issue | Primary File |
|-------|--------------|
| Card not rendering | `components/game/MultiplayerGame.tsx` |
| Clicks not working | `components/Card.tsx` |
| State not updating | `hooks/useMultiplayerGame.ts` |
| Server not responding | `party/index.ts` |
| Wrong data structure | `shared/types.ts` |
