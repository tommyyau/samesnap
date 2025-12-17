# SameSnap Codebase Architecture Audit

**Date:** 2025-12-15
**Auditor:** Claude Code (Opus 4.5)
**Overall Grade:** C+ (Needs Significant Cleanup)

The codebase works but has accumulated technical debt. It shows signs of rapid development without refactoring passes.

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [What's Actually Good](#whats-actually-good)
5. [God Component Refactoring](#god-component-refactoring)
   - [party/index.ts (1,122 lines)](#1-partyindexts-1122-lines--the-monolithic-server)
   - [SinglePlayerGame.tsx (550 lines)](#2-singleplayergametsx-550-lines--extract-4-things)
   - [MultiplayerGame.tsx (485 lines)](#3-multiplayergametsx-485-lines--nearly-identical-extractions)
6. [Cleanup Priority Order](#cleanup-priority-order)

---

## Critical Issues

### 1. Test Files Dumped in Root (8 files, 7,970 LOC)

```
/test-multiplayer.mjs           (2,526 lines)
/test-multiplayer-comprehensive.mjs (1,420 lines)
/test-multiplayer-stress.mjs    (1,263 lines)
/test-hook-state.mjs            (930 lines)
/test-ui-multiplayer.mjs        (651 lines)
/test-react-integration.mjs     (493 lines)
/test-game-logic.mjs            (363 lines)
/test-single-player-updates.mjs (324 lines)
```

Meanwhile, `/tests/` directory exists and is **completely empty**. This is amateur-hour organization.

### 2. God Components

| File | LOC | Verdict |
|------|-----|---------|
| `party/index.ts` | **1,122** | Monolithic server - should be 5-6 classes |
| `components/game/SinglePlayerGame.tsx` | **550** | Does EVERYTHING - state, bots, UI, audio, sizing |
| `components/game/MultiplayerGame.tsx` | **485** | Same problem, 95% duplicated patterns |
| `components/lobby/WaitingRoom.tsx` | **370** | Orchestrates too many concerns |

### 3. Dead/Legacy Code

- `components/Lobby.tsx` (171 LOC) - **NEVER IMPORTED ANYWHERE**. This is the old lobby before the refactor. Delete it.

### 4. Hollow Utils Directory

```
/utils/gameLogic.ts  →  9 lines, just re-exports /shared/gameLogic.ts
/utils/sound.ts      →  288 lines, actual implementation
```

The utils directory is a lie - `gameLogic.ts` is just a backwards-compat shim. Either commit to `/shared/` or don't.

---

## High Priority Issues

### 5. Massive Code Duplication

`SinglePlayerGame.tsx` and `MultiplayerGame.tsx` share:
- Identical `calculateCardSize()` function (~43 lines each)
- Identical window resize listeners
- Identical victory celebration rendering
- Identical game over screen rendering
- Identical background music lifecycle management

This violates DRY hard. Extract to:
- `hooks/useResponsiveCardSize.ts`
- `hooks/useWindowDimensions.ts`
- `components/common/VictoryCelebration.tsx`
- `components/common/GameOverScoreboard.tsx`

### 6. Documentation Sprawl (9 markdown files in root)

```
CLAUDE.md                        (3 KB) - needed
README.md                        (1 KB) - needed
TESTING.md                       (12 KB) - maybe
AGENTS.md                        (14 KB) - QA tooling
FAILING-TESTS.md                 (4 KB) - should be in /docs/
LESSONS-LEARNED-MULTIPLAYER.md   (52 KB) - archive this
MULTIPLAYER-STATUS.md            (5 KB) - outdated?
TODO-MULTIPLAYER-RISKS.md        (4 KB) - outdated?
codex-conversation-1.md          (8 KB) - DELETE THIS. It's a conversation dump.
```

### 7. Skills Directory Bloat

`/skills/` contains **40 subdirectories** with:
- 36 timestamped test run logs (`test-runs-*.log`)
- QA audit artifacts
- 104 KB of findings logs

This is a QA audit workspace that's now permanent clutter. Archive or gitignore it.

### 8. Types Not Split

`shared/types.ts` (130 lines) mixes:
- Core game types (SymbolItem, CardData)
- Single-player types (GameState, Player)
- Multiplayer types (RoomPhase, PlayerStatus, ClientRoomState)

Should be:
```
/shared/types/
├── index.ts
├── core.ts
├── singleplayer.ts
└── multiplayer.ts
```

### 9. Console.log Pollution

**12 `console.log()` statements** in `party/index.ts` for server debugging. Use a proper logging framework or wrap in `DEBUG` flag.

### 10. Unused Function

`checkMatch()` in `shared/gameLogic.ts:59` is exported but **never called anywhere**. Dead code.

---

## Medium Priority Issues

### 11. Card.tsx Has Layout Algorithm

`components/Card.tsx` (272 LOC) contains a physics-based relaxation algorithm for symbol placement. This should be extracted to `hooks/useCardLayout.ts`. UI components shouldn't contain algorithms.

### 12. Sound.ts Pattern Repetition

The oscillator + gain node pattern repeats **13 times** in `utils/sound.ts`:
```typescript
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.connect(gain);
gain.connect(ctx.destination);
```
Extract a `createOscillatorNode()` helper.

### 13. Empty Test Directory Structure

```
/tests/        ← exists, empty
/tests/utils/  ← exists, empty
```
Either use it or delete it. Don't leave empty directories.

### 14. No Shared Component Directory

Components that could be shared (VictoryCelebration, GameOverScreen, ErrorModal) are duplicated inline. Need:
```
/components/common/
```

### 15. .DS_Store in Repo

macOS system file should be in `.gitignore`.

---

## What's Actually Good

- **Minimal config sprawl** - Only 1 tsconfig, 1 vite.config.ts, 1 partykit.json
- **Clean constants file** - `constants.ts` is well-organized
- **Proper TypeScript usage** - Good interfaces, enums, type safety
- **No TODO/FIXME/HACK comments** - Code is clean of technical debt markers
- **No commented-out code** - Nothing disabled and left rotting
- **Sensible directory naming** - components/, hooks/, party/, shared/ make sense

---

## God Component Refactoring

### 1. `party/index.ts` (1,122 lines) — The Monolithic Server

This is a single class doing **7 distinct jobs**:

| Responsibility | Lines | Methods |
|----------------|-------|---------|
| **Room Lifecycle** | ~100 | `startRoomTimeout`, `refreshRoomTimeout`, `handleRoomExpired`, `resetRoom`, `resetRoomForNewGame` |
| **Player Management** | ~150 | `handleJoin`, `removePlayer`, `handleKickPlayer`, `broadcastPlayerJoined` |
| **Connection Handling** | ~100 | `onConnect`, `onClose`, `handleReconnection`, `handleReconnectMessage` |
| **Game Flow** | ~200 | `startCountdown`, `cancelCountdown`, `startGame`, `nextRound`, `endGame`, `endGameLastPlayerStanding` |
| **Match Arbitration** | ~100 | `handleMatchAttempt`, `resolveArbitration`, `processRoundWin`, `checkRateLimit` |
| **Rematch/Rejoin** | ~100 | `handlePlayAgain`, `handleRejoinWindowExpired` |
| **State Broadcasting** | ~100 | `sendRoomState`, `broadcastRoomState`, `broadcastToAll`, `sendToPlayer`, `toClientPlayer` |

#### Proposed Split:

```
party/
├── index.ts              (~100 lines - thin orchestrator)
├── services/
│   ├── RoomManager.ts    (lifecycle, timeouts, reset)
│   ├── PlayerManager.ts  (join, leave, kick, host transfer)
│   ├── ConnectionManager.ts (connect, disconnect, reconnect)
│   ├── GameEngine.ts     (countdown, start, rounds, end)
│   ├── MatchArbiter.ts   (match validation, rate limiting, arbitration)
│   └── StateBroadcaster.ts (room state serialization, messaging)
└── types.ts              (server-only types like ServerPlayer, pending arbitration)
```

#### Example extraction — MatchArbiter:

```typescript
// party/services/MatchArbiter.ts
export class MatchArbiter {
  private pendingArbitration: PendingArbitration | null = null;
  private matchAttemptCounts: Map<string, RateLimitEntry> = new Map();

  constructor(
    private readonly onRoundWin: (winnerId: string, symbolId: number) => void,
    private readonly onPenalty: (playerId: string, until: number) => void
  ) {}

  attemptMatch(playerId: string, symbolId: number, playerCard: CardData, centerCard: CardData): void {
    if (!this.checkRateLimit(playerId)) return;

    const isValid = this.validateMatch(playerCard, centerCard, symbolId);
    if (!isValid) {
      this.onPenalty(playerId, Date.now() + PENALTY_DURATION);
      return;
    }

    this.addToArbitrationWindow({ playerId, symbolId, timestamp: Date.now() });
  }

  private resolveArbitration(): void {
    // Sort by timestamp, pick winner, call onRoundWin
  }
}
```

#### Refactored Orchestrator:

```typescript
// party/index.ts - After refactoring
export default class SameSnapRoom implements Party.Server {
  private playerManager: PlayerManager;
  private gameEngine: GameEngine;
  private matchArbiter: MatchArbiter;
  private broadcaster: StateBroadcaster;

  constructor(readonly room: Party.Room) {
    this.broadcaster = new StateBroadcaster(room);
    this.playerManager = new PlayerManager(this.broadcaster);
    this.matchArbiter = new MatchArbiter(
      (winnerId, symbolId) => this.gameEngine.processRoundWin(winnerId, symbolId),
      (playerId, until) => this.broadcaster.sendPenalty(playerId, until)
    );
    this.gameEngine = new GameEngine(this.playerManager, this.matchArbiter, this.broadcaster);
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    switch (msg.type) {
      case 'join': this.playerManager.handleJoin(sender, msg.payload.playerName); break;
      case 'match_attempt': this.matchArbiter.attemptMatch(/*...*/); break;
      case 'start_game': this.gameEngine.start(/*...*/); break;
      // ...
    }
  }
}
```

---

### 2. `SinglePlayerGame.tsx` (550 lines) — Extract 4 Things

**Current responsibilities:**
1. Game state management (players, center card, round logic)
2. Bot AI scheduling
3. Responsive sizing calculations
4. Victory celebration UI
5. Game over scoreboard UI
6. Penalty timer UI

#### Extraction plan:

| Extract To | Lines Saved | What It Contains |
|------------|-------------|------------------|
| `hooks/useResponsiveCardSize.ts` | ~40 | `calculateCardSize()` + window resize listener |
| `hooks/useWindowDimensions.ts` | ~10 | Shared resize logic |
| `components/common/VictoryCelebration.tsx` | ~45 | Confetti animation screen |
| `components/common/GameOverScoreboard.tsx` | ~50 | Final standings + buttons |
| `hooks/useBotAI.ts` | ~30 | Bot scheduling logic |

**After refactoring, SinglePlayerGame.tsx becomes ~375 lines** (still orchestrating, but thinner).

#### Example — VictoryCelebration.tsx:

```tsx
// components/common/VictoryCelebration.tsx
interface VictoryCelebrationProps {
  winnerName: string;
  isYouWinner: boolean;
}

export const VictoryCelebration: React.FC<VictoryCelebrationProps> = ({ winnerName, isYouWinner }) => {
  const confettiEmojis = ['🎉', '🎊', '🎈', '⭐', '✨', '🌟', '🏆'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 overflow-hidden">
      <div className="text-center z-10">
        <div className="text-5xl md:text-7xl font-black text-white drop-shadow-lg mb-4 animate-bounce">
          {isYouWinner ? 'YOU WIN!' : `${winnerName} WINS!`}
        </div>
      </div>
      {/* Floating confetti animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl md:text-5xl"
            style={{
              left: `${(i * 5) % 100}%`,
              bottom: '-10%',
              animation: `floatUp ${2 + (i % 3)}s ease-out forwards`,
              animationDelay: `${(i * 0.1) % 1}s`,
            }}
          >
            {confettiEmojis[i % confettiEmojis.length]}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-120vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
```

#### Example — useResponsiveCardSize.ts:

```typescript
// hooks/useResponsiveCardSize.ts
import { useState, useEffect, useMemo } from 'react';

interface ResponsiveCardSizeOptions {
  topBarHeight?: number;
  bottomRowHeight?: number;
  padding?: number;
  cardGap?: number;
}

export function useResponsiveCardSize(options: ResponsiveCardSizeOptions = {}) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { cardSize, isMobile } = useMemo(() => {
    const { width, height } = dimensions;
    const isMobile = width < 768;
    const isPortrait = height > width;

    const topBarHeight = options.topBarHeight ?? (isMobile ? 40 : 48);
    const bottomRowHeight = options.bottomRowHeight ?? (isMobile ? 48 : 72);
    const padding = options.padding ?? (isMobile ? 4 : 32);
    const cardGap = options.cardGap ?? (isMobile ? 16 : 32);

    const availableHeight = height - topBarHeight - bottomRowHeight - padding * 2;
    const availableWidth = width - padding * 2;

    let size: number;

    if (isMobile && isPortrait) {
      const maxHeightPerCard = (availableHeight - cardGap) / 2;
      const maxWidth = availableWidth * 0.85;
      size = Math.min(maxHeightPerCard, maxWidth, 380);
    } else if (isMobile) {
      const heightConstraint = availableHeight * 0.75;
      const widthConstraint = (availableWidth - cardGap) / 2 * 0.9;
      size = Math.min(heightConstraint, widthConstraint, 380);
    } else {
      const heightConstraint = availableHeight * 0.6;
      const widthConstraint = availableWidth * 0.35;
      size = Math.min(heightConstraint, widthConstraint, 380);
    }

    return { cardSize: Math.max(140, size), isMobile };
  }, [dimensions, options]);

  return { cardSize, isMobile, dimensions };
}
```

---

### 3. `MultiplayerGame.tsx` (485 lines) — Nearly Identical Extractions

**Shared with SinglePlayerGame:**
- Lines 26-32: Window resize listener → `useWindowDimensions`
- Lines 35-70: `calculateCardSize()` → `useResponsiveCardSize`
- Lines 190-233: Victory celebration → `VictoryCelebration.tsx`
- Lines 235-318: Game over screen → `GameOverScoreboard.tsx`

**Multiplayer-specific extractions:**

| Extract To | Lines | What It Contains |
|------------|-------|------------------|
| `components/common/ConnectionErrorModal.tsx` | ~30 | Error modal with retry/exit |
| `components/common/RoundResultOverlay.tsx` | ~25 | "YOU GOT IT!" / "X got it!" overlay |

**After refactoring, MultiplayerGame.tsx becomes ~280 lines**.

---

### Visual Diff of What Changes

**Before:**
```
SinglePlayerGame.tsx  (550 lines) ─┬─ calculateCardSize (43 lines, DUPLICATED)
                                   ├─ Victory celebration (45 lines, DUPLICATED)
                                   ├─ Game over screen (50 lines, SIMILAR)
                                   └─ Bot AI logic (30 lines)

MultiplayerGame.tsx   (485 lines) ─┬─ calculateCardSize (43 lines, DUPLICATED)
                                   ├─ Victory celebration (45 lines, DUPLICATED)
                                   ├─ Game over screen (85 lines, SIMILAR)
                                   └─ Connection error modal (30 lines)
```

**After:**
```
hooks/
├── useResponsiveCardSize.ts      (50 lines) ← shared
├── useWindowDimensions.ts        (15 lines) ← shared
└── useBotAI.ts                   (40 lines) ← SinglePlayer only

components/common/
├── VictoryCelebration.tsx        (50 lines) ← shared
├── GameOverScoreboard.tsx        (80 lines) ← shared (with variants)
├── ConnectionErrorModal.tsx      (35 lines) ← Multiplayer only
└── RoundResultOverlay.tsx        (30 lines) ← Multiplayer only

SinglePlayerGame.tsx              (~320 lines) ← orchestrator
MultiplayerGame.tsx               (~250 lines) ← orchestrator
```

---

## Cleanup Priority Order

### Quick Wins (Do First)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Move 8 test files to `/tests/` | 15 min | High - project hygiene |
| 2 | Delete `components/Lobby.tsx` | 1 min | High - removes confusion |
| 3 | Delete `codex-conversation-1.md` | 1 min | Medium - clutter |
| 4 | Delete empty `/tests/utils/` | 1 min | Low - hygiene |
| 5 | Add `.DS_Store` to `.gitignore` | 1 min | Low - hygiene |

### Medium Effort (High Value)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 6 | Create `useResponsiveCardSize` hook | 30 min | Removes 86 lines of duplication |
| 7 | Extract `VictoryCelebration.tsx` | 20 min | Removes 90 lines of duplication |
| 8 | Extract `GameOverScoreboard.tsx` | 45 min | Removes ~100 lines, unifies UI |
| 9 | Create `useBotAI` hook | 30 min | Cleans up SinglePlayerGame |
| 10 | Remove unused `checkMatch()` function | 5 min | Dead code removal |

### Major Refactoring

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 11 | Split `shared/types.ts` into subdirectory | 1 hour | Better organization |
| 12 | Split `party/index.ts` into services | 3-4 hours | Major maintainability win |
| 13 | Archive `/skills/` logs or add to `.gitignore` | 30 min | Reduces clutter |
| 14 | Move docs to `/docs/` folder | 30 min | Organization |
| 15 | Replace `console.log` with logging framework | 1 hour | Production readiness |

---

## Summary

The SameSnap codebase is functional but showing signs of rapid prototyping without cleanup passes. The main issues are:

1. **Organization** - Tests in wrong place, empty directories, documentation sprawl
2. **God Components** - Three files over 400 lines that do too much
3. **Code Duplication** - ~200 lines of identical code between game components
4. **Dead Code** - Unused component, unused function, hollow utility wrappers

The good news: the core architecture (components/, hooks/, party/, shared/) is sound. The TypeScript usage is solid. The game logic is well-tested. This is cleanup work, not a rewrite.

Estimated total cleanup time: **8-12 hours** for a thorough refactor.
