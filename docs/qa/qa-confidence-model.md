# QA Confidence Model

> A framework for honestly assessing multiplayer system quality

---

## Confidence Dimensions

Instead of a single percentage, track confidence across multiple axes:

### 1. Requirements Coverage (RC)
**Question:** What % of documented requirements have passing tests?

| Requirement | Tested | Notes |
|-------------|--------|-------|
| Join flow | ✅ | 4 tests |
| Duplicate names | ✅ | 1 test |
| Room full (8 max) | ✅ | 1 test |
| Host assignment | ✅ | 2 tests |
| Host reassignment | ✅ | 1 test |
| Config changes | ✅ | 3 tests |
| Manual start | ✅ | 2 tests |
| Auto-start | ✅ | 3 tests |
| Countdown flow | ✅ | 2 tests |
| Countdown cancellation | ✅ | 2 tests |
| Match validation | ✅ | 2 tests |
| Penalty system | ✅ | 1 test |
| Round transitions | ✅ | 1 test |
| Game over | ⚠️ | No explicit test |
| Reconnection (URL) | ✅ | 1 test |
| Reconnection (message) | ✅ | 1 test |
| Reconnection race | ✅ | 4 tests |
| Ghost player prevention | ✅ | 3 tests |
| Room timeout | ✅ | 3 tests |
| Kick player | ⚠️ | No explicit test |
| isYou correctness | ✅ | 1 test |
| Ping/pong | ✅ | 1 test |

**RC Score: 20/22 = 91%**

### 2. Bug Discovery Rate (BDR)
**Question:** Are we finding fewer bugs over time? (Lower is better)

| Audit Window | HIGH | MEDIUM | LOW | Total | Trend |
|--------------|------|--------|-----|-------|-------|
| Audits 1-2 | 3 | 6 | 4 | 13 | baseline |
| Audits 3-4 | 0 | 0 | 3 | 3 | ↓ improving |
| Audits 5-6 | 0 | 0 | 0 | 0 | ↓ stable |
| Audit 7 | 1 | 0 | 0 | 1 | ↑ regression |

**BDR Assessment: UNSTABLE** - Found HIGH bug after "stable" period

### 3. Severity Trend (ST)
**Question:** Are remaining bugs getting less severe?

Current open issues:
- HIGH: 0
- MEDIUM: 0 (all were client-side edge cases)
- LOW: 8

**ST Score: GOOD** - No HIGH/MEDIUM open, only cosmetic/maintenance issues

### 4. Test Stability (TS)
**Question:** Do tests pass consistently?

| Suite | Tests | Pass Rate | Flaky? |
|-------|-------|-----------|--------|
| test-multiplayer.mjs | 34 | 100% | No |
| test-multiplayer-stress.mjs | 25 | 100% | No |
| test-hook-state.mjs | 25 | 100% | No |
| test-game-logic.mjs | 17 | 100% | No |
| test-multiplayer-comprehensive.mjs | ~28 | 100% | No |

**TS Score: 100%** - All tests passing, no flakiness observed

### 5. Known Gaps (KG)
**Question:** What scenarios are explicitly NOT tested?

1. **Clock skew** - Penalty/roomExpiresAt timestamps assume clock sync
2. **Concurrent matches** - Multiple players match within arbitration window
3. **Network partitions** - Player appears connected but can't receive messages
4. **Browser back button** - Mid-game navigation behavior
5. **Multiple tabs** - Same player opens room in two tabs
6. **Rapid reconnect cycles** - Player keeps disconnecting/reconnecting
7. **Memory leaks** - Long-running games accumulate state
8. **Message ordering** - Out-of-order WebSocket delivery
9. **Payload validation** - Malformed JSON, missing fields
10. **Rate limiting** - Spam protection

**KG Count: 10 significant untested scenarios**

---

## Composite Confidence Calculation

```
Confidence = (RC × 0.3) + (BDR_factor × 0.25) + (ST × 0.15) + (TS × 0.15) + (KG_factor × 0.15)

Where:
- RC = Requirements Coverage (0-100%)
- BDR_factor = 100% if decreasing, 80% if stable, 50% if increasing
- ST = Severity Trend (100% if no HIGH/MEDIUM, 80% if MEDIUM only, 50% if HIGH)
- TS = Test Stability (0-100%)
- KG_factor = 100% - (5% per known gap, max 50% penalty)
```

### Current Calculation

```
RC = 91%
BDR_factor = 50% (found HIGH bug after stable period - regression)
ST = 100% (no HIGH/MEDIUM open)
TS = 100%
KG_factor = 50% (10 gaps × 5% = 50% penalty → 50%)

Confidence = (91 × 0.3) + (50 × 0.25) + (100 × 0.15) + (100 × 0.15) + (50 × 0.15)
           = 27.3 + 12.5 + 15 + 15 + 7.5
           = 77.3%
```

**Honest Confidence: 77%**

---

## What 77% Means

- **Happy path works well** - Normal gameplay is solid
- **Edge cases are covered** - Reconnection, countdown cancellation, ghost players
- **Stability under load** - Stress tests pass
- **BUT** we keep finding bugs when we look hard
- **AND** 10 significant scenarios remain untested
- **AND** we just found a HIGH bug we thought we'd eliminated

---

## How to Improve Confidence

### To reach 85%:
1. Add tests for kick_player and game_over flows (+2% RC)
2. Go 2 full audit cycles with no new bugs found (+30% BDR → +7.5% total)
3. Test at least 3 of the known gaps (+7.5% KG)

### To reach 95%:
1. Full requirements coverage (100% RC)
2. 4+ audit cycles with no bugs (+50% BDR → full credit)
3. Test 8+ known gaps
4. Run in production for 1 week with telemetry

### To reach 99%:
1. All of the above
2. External security audit
3. Chaos engineering (inject failures)
4. Real user testing with diverse devices/networks

---

## Tracking Over Time

| Date | RC | BDR | ST | TS | KG | **Composite** |
|------|-----|-----|-----|-----|-----|---------------|
| 2025-12-13 (Audit 1) | 70% | 50% | 50% | 100% | 30% | **58%** |
| 2025-12-13 (Audit 2) | 85% | 80% | 80% | 100% | 40% | **75%** |
| 2025-12-13 (Audit 7) | 91% | 50% | 100% | 100% | 50% | **77%** |

The ghost player bug discovery **dropped our confidence** because it showed our bug detection was incomplete.

---

## Conclusion

The previous "99.5% confidence" was wishful thinking. A more honest assessment:

- **77% confidence** in the multiplayer system
- **Strong** in: requirements coverage, test stability, severity trend
- **Weak** in: bug discovery rate (found HIGH after "stable"), known gaps

The system is **production-viable for beta** but not **production-ready for launch**.
