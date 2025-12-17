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

SameSnap is a Dobble/Spot It! style pattern recognition card game built with React 19, TypeScript, and Vite. Players race against bots to find the matching symbol between cards.

### Core Game Flow

`App.tsx` → Controls state between Lobby and Game screens
- `Lobby.tsx` → Configuration: player name, bot count, difficulty, card layout
- `Game.tsx` → Main game loop: deals cards, manages rounds, handles player/bot matches

### Key Systems

**Deck Generation** (`utils/gameLogic.ts`)
- Uses projective plane mathematics (order N=7) to generate a 57-card deck
- Mathematical guarantee: any two cards share exactly one common symbol
- 8 symbols per card, 57 total unique symbols (from `constants.ts` EMOJIS array)

**Card Layout** (`components/Card.tsx`)
- `EASY`: One symbol centered, 7 arranged in a circle around it
- `MEDIUM`: Physics-based relaxation algorithm that randomly sizes/positions symbols while preventing overlaps

**Bot AI** (`Game.tsx`)
- Bots scheduled via `setTimeout` with randomized delays based on difficulty
- Difficulty controls reaction time range (EASY: 5-10s, MEDIUM: 3-7s, HARD: 1.5-4s)
- Bots cleared and rescheduled on each new center card

**Audio** (`utils/sound.ts`)
- Web Audio API synthesizer - no audio files
- Background music: procedural pentatonic melody
- Sound effects: match sounds (different for human vs bots), error sounds

### Type Definitions (`types.ts`)

- `GameState`: LOBBY → PLAYING → ROUND_ANIMATION → GAME_OVER
- `Difficulty`: Bot speed (EASY/MEDIUM/HARD)
- `CardDifficulty`: Card layout style (EASY orderly / MEDIUM chaotic)
- `CardData`: Card with array of `SymbolItem`
- `Player`: Human or bot with hand, score, collected cards

### Path Alias

`@/*` maps to project root (configured in both tsconfig.json and vite.config.ts)
