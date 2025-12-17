# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
vercel dev         # Start local dev server with API routes (RECOMMENDED)
npm run dev:party  # Start PartyKit multiplayer server on port 1999
npm run build      # Production build
npm run preview    # Preview production build
```

### Local Development

**Use `vercel dev` instead of `npm run dev`** for local development. The app uses Vercel serverless functions for API routes (`/api/cardsets`, `/api/stats`). These only work with:
- `vercel dev` - runs both frontend and API routes locally
- Production deployment on Vercel

Using `npm run dev` (Vite only) will cause API calls to fail - custom card sets and user stats won't load.

Note: Requires environment variables in `.env.local`:
- `CLERK_SECRET_KEY` - for API authentication
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` - for Vercel KV storage

### PartyKit Local Development

The `dev:party` script includes `--disable-request-cf-fetch` flag. This is a pragmatic local dev workaround - Miniflare (the local Cloudflare simulator) can crash when trying to simulate Cloudflare's `request.cf` object. This flag is:
- **Only needed locally** - real Cloudflare provides `request.cf` natively
- **Not required for production** - will be resolved when deployed to Cloudflare
- **Not relevant to this app** - we don't use any CF-specific request data (geo-location, etc.)

## Architecture

SameSnap is a Dobble/Spot It! style pattern recognition card game built with React 19, TypeScript, and Vite. Supports both single-player (vs bots) and real-time multiplayer modes.

### Core Game Flow

`App.tsx` → Routes between screens based on game mode
- `components/lobby/SinglePlayerLobby.tsx` → Single-player configuration
- `components/lobby/WaitingRoom.tsx` → Multiplayer room lobby
- `components/game/SinglePlayerGame.tsx` → Single-player game loop
- `components/game/MultiplayerGame.tsx` → Real-time multiplayer game

### Key Systems

**Deck Generation** (`shared/gameLogic.ts`)
- Uses projective plane mathematics (order N=7) to generate a 57-card deck
- Mathematical guarantee: any two cards share exactly one common symbol
- 8 symbols per card, 57 total unique symbols (from `constants.ts` EMOJIS array)

**Card Layout** (`components/Card.tsx`)
- `EASY`: One symbol centered, 7 arranged in a circle around it
- `MEDIUM`: Physics-based relaxation algorithm that randomly sizes/positions symbols while preventing overlaps

**Bot AI** (`hooks/useBotAI.ts`)
- Bots scheduled via `setTimeout` with randomized delays based on difficulty
- Difficulty controls reaction time range (EASY: 5-10s, MEDIUM: 3-7s, HARD: 1.5-4s)
- Bots cleared and rescheduled on each new center card

**Audio** (`utils/sound.ts`, `hooks/useGameAudio.ts`)
- Web Audio API synthesizer - no audio files
- Background music: procedural pentatonic melody
- Sound effects: match sounds (different for human vs bots), error sounds

**Multiplayer Server** (`party/`)
- PartyKit-based real-time game server
- Service-oriented architecture:
  - `party/index.ts` - Thin orchestrator (connection handling)
  - `party/services/GameEngine.ts` - Core game state machine
  - `party/services/PlayerService.ts` - Player management
  - `party/services/ArbitrationService.ts` - Match conflict resolution
  - `party/services/TimerService.ts` - Round timing
  - `party/services/BroadcastService.ts` - State synchronization
  - `party/services/StateManager.ts` - Persistence

### Type Definitions (`shared/types/`)

Modular type system:
- `shared/types/core.ts` - Base types (GameState, Difficulty, CardData, Player)
- `shared/types/singleplayer.ts` - Single-player specific types
- `shared/types/multiplayer.ts` - Multiplayer protocol types
- `shared/types/stats.ts` - User statistics types

Key types:
- `GameState`: LOBBY → PLAYING → ROUND_ANIMATION → GAME_OVER
- `Difficulty`: Bot speed (EASY/MEDIUM/HARD)
- `CardLayout`: Card layout style (EASY orderly / MEDIUM chaotic)
- `CardData`: Card with array of `SymbolItem`
- `Player`: Human or bot with hand, score, collected cards

### Custom Hooks (`hooks/`)

- `useBotAI.ts` - Bot scheduling and AI logic
- `useGameAudio.ts` - Audio lifecycle management
- `useMultiplayerGame.ts` - WebSocket game state management
- `useResponsiveCardSize.ts` - Responsive card sizing
- `useRoomCountdown.ts` - Clock-skew safe countdown timer

### Shared Components (`components/common/`)

- `GameOverScoreboard.tsx` - Unified scoreboard (supports single/multiplayer)
- `VictoryCelebration.tsx` - Win celebration screen
- `ConfirmModal.tsx` - Confirmation dialogs
- `ConnectionErrorModal.tsx` - Connection error handling

### Path Alias

`@/*` maps to project root (configured in both tsconfig.json and vite.config.ts)

## Testing

### Test Commands

```bash
npm run test:quick         # Quick validation (212 tests, ~5 min)
npm run test:all           # Full suite including stress tests (~15 min)
npm run test:logic         # Game logic only (21 tests)
npm run test:multiplayer   # WebSocket multiplayer tests
npm run test:singleplayer  # Single-player bot tests
node scripts/run-tests.mjs profile  # Profile/stats/cardsets only (77 tests)
```

### Test Architecture

Tests are organized in `/tests/` directory with parallel execution support:

| Category | Tests | Focus |
|----------|-------|-------|
| Game Logic | 21 | Deck generation, Dobble property, symbols |
| Hook State | 33 | React hook message handling |
| Single Player | 26 | Bot AI, game flow, scoring |
| Multiplayer | 55 | WebSocket rooms, arbitration, lifecycle |
| Stats Logic | 22 | User stats business logic, streaks, mode separation |
| Card Sets Logic | 38 | Validation, 57 symbols, emoji edge cases |
| Profile E2E | 17 | Fire-and-forget patterns, concurrency, auth flows |

### Test Runner (`scripts/run-tests.mjs`)

- Stages run sequentially, suites within stages run in parallel
- Results logged to `logs/test-runs-*.log` with timing data
- Tracks test count changes between runs

### Key Testing Patterns

**Fire-and-forget testing**: Stats recording doesn't block game flow - tests verify operations complete without blocking

**Concurrency testing**: Profile E2E tests simulate race conditions with operation serialization to match real API behavior

**Mock implementations**: Tests use MockKVStore and MockStatsAPI with configurable latency to simulate real-world conditions
