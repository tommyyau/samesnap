# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Vite dev server on port 3000 (accessible on LAN via 0.0.0.0)
npm run build      # Production build
npm run preview    # Preview production build
```

**Mobile Access**: Dev server binds to `0.0.0.0`, so you can play on mobile devices on the same network by visiting `http://<your-local-ip>:3000`


## Architecture

SameSnap is a Dobble/Spot It! style pattern recognition card game built with React 19, TypeScript, and Vite. Players race against bots to find the matching symbol between cards.

### Core Game Flow

`App.tsx` → Controls state between Lobby and Game screens
- `Lobby.tsx` → Configuration: player name, bot count (1-5), difficulty, card layout
- `Game.tsx` → Main game loop: deals cards, manages rounds, handles player/bot matches

### Key Systems

**Deck Generation** (`utils/gameLogic.ts`)
- Uses projective plane mathematics (order N=7) to generate a 57-card deck
- Mathematical guarantee: any two cards share exactly one common symbol
- 8 symbols per card, 57 total unique symbols (from `constants.ts` EMOJIS array)
- Includes `validateDeckIntegrity()` to verify deck correctness at runtime

**Card Layout** (`components/Card.tsx`)
- `EASY`: One symbol centered, 7 arranged in a circle around it
- `MEDIUM`: Physics-based relaxation algorithm with random sizes (0.85-1.25x) while preventing overlaps
- `HARD`: More extreme chaotic layout (0.6-1.5x size variation) + visually similar themed symbols
- Supports curved text labels via SVG textPath (used for player name and "Snap Card")
- Symbol positions adjusted to accommodate top label area

**Bot AI** (`Game.tsx`)
- Bot names randomized from pool: Holly, Sophie, Abby, Rob, Antony
- Bots scheduled via `setTimeout` with randomized delays based on difficulty
- Difficulty controls reaction time range (EASY: 5-10s, MEDIUM: 3-7s, HARD: 1.5-4s)
- Bots cleared and rescheduled on each new center card

**Audio** (`utils/sound.ts`)
- Web Audio API synthesizer - no audio files
- Background music: procedural pentatonic melody
- Sound effects: match sounds (different for human vs bots), error sounds

**Responsive Design** (`Game.tsx`, `Lobby.tsx`)
- Mobile-first responsive layout using Tailwind CSS
- Portrait mode detection: shows "rotate device" overlay on mobile portrait
- Dynamic card sizing based on viewport dimensions
- Lobby uses CSS Grid for adaptive 1-column (portrait) / 2-column (landscape) layout
- Compact UI elements with responsive text sizes (text-xs md:text-sm patterns)

### Type Definitions (`types.ts`)

- `GameState`: LOBBY → PLAYING → ROUND_ANIMATION → GAME_OVER
- `Difficulty`: Bot speed (EASY/MEDIUM/HARD)
- `CardDifficulty`: Card layout style (EASY orderly / MEDIUM chaotic / HARD extreme + tricky symbols)
- `CardData`: Card with array of `SymbolItem`
- `Player`: Human or bot with hand, score, collected cards

### Constants (`constants.ts`)

- `EMOJIS`: 67 emoji symbols (57 required + extras) - used for EASY/MEDIUM
- `EMOJIS_HARD`: 57 visually similar themed symbols (fruits, sea creatures, insects, etc.) - used for HARD
- `BOT_NAMES`: ['Holly', 'Sophie', 'Abby', 'Rob', 'Antony', 'Tommy', 'Olinda', 'Kimberley', 'Alice']
- `CARD_SIZE_*`: Predefined card sizes (LG: 320px, MD: 200px, SM: 100px)
- `PENALTY_DURATION`: 3000ms penalty for wrong matches
- `BOT_SPEEDS`: Reaction time ranges per difficulty

### Path Alias

`@/*` maps to project root (configured in both tsconfig.json and vite.config.ts)
