# Card Set System Implementation Plan

This document tracks the implementation of the Card Set system - separating card layout from symbol sets and enabling custom card sets.

## Overview

**Goal**: Transform the monolithic `CardDifficulty` system (which combined layout + symbols) into a flexible system where:
- **CardLayout** controls visual arrangement (ORDERLY/CHAOTIC)
- **CardSet** controls which symbols are used (built-in or custom)

This enables:
- Independent selection of layout and symbol set
- User-created custom card sets (future)
- PNG/image-based symbols (future)

---

## Phase 1: Separate CardLayout from CardSet ✅ COMPLETE

**Branch**: `cardset`
**Commit**: `7fb8338`

### Completed Tasks

- [x] Add `CardLayout` enum (`ORDERLY` | `CHAOTIC`) to `shared/types.ts`
- [x] Add `CardSet` interface to `shared/types.ts`
- [x] Create `shared/cardSets.ts` with built-in card sets registry
- [x] Define 3 built-in card sets:
  - `children` - "Children's" (animals: 🐶🐱🐭...)
  - `mixed` - "Mixed" (themed groups: 🍎🐙🐝...)
  - `smiley` - "Smiley Faces" (faces: 😀😃😄...)
- [x] Update `GameConfig` to use `cardLayout` + `cardSetId`
- [x] Update `MultiplayerGameConfig` to use `cardLayout` + `cardSetId`
- [x] Update `Card.tsx` to use `CardLayout` instead of `CardDifficulty`
- [x] Update `SinglePlayerLobby.tsx` with separate Layout + Card Set pickers
- [x] Update `WaitingRoom.tsx` (multiplayer) with same UI changes
- [x] Update `SinglePlayerGame.tsx` to use `getSymbolsForCardSet()`
- [x] Update `MultiplayerGame.tsx` to use `cardLayout`
- [x] Update `party/index.ts` (PartyKit server) for multiplayer support
- [x] Add emoji preview to card set buttons
- [x] Build passes, dev server works

### Files Modified

| File | Changes |
|------|---------|
| `shared/types.ts` | Added `CardLayout`, `CardSet`, updated configs |
| `shared/cardSets.ts` | **NEW** - Card set registry |
| `types.ts` | Re-export new types |
| `components/Card.tsx` | Use `CardLayout` |
| `components/Lobby.tsx` | Updated (legacy, not actively used) |
| `components/lobby/SinglePlayerLobby.tsx` | New UI with Layout + Card Set pickers |
| `components/lobby/WaitingRoom.tsx` | New UI for multiplayer |
| `components/game/SinglePlayerGame.tsx` | Use `getSymbolsForCardSet()` |
| `components/game/MultiplayerGame.tsx` | Use `cardLayout` |
| `party/index.ts` | Use `getSymbolsForCardSet()` |

---

## Phase 2: Custom Card Set Creation UI 🔲 NOT STARTED

**Goal**: Allow users to create and manage their own card sets using emoji picker.

### Tasks

- [ ] Create emoji picker component with search/categories
- [ ] Create card set editor UI (add/remove emojis, name the set)
- [ ] Validate card sets (must have exactly 57 unique symbols)
- [ ] Save custom card sets to localStorage (temporary)
- [ ] Display custom card sets alongside built-in sets in lobby
- [ ] Allow editing/deleting custom card sets
- [ ] Add "paste 57 emojis" import functionality

### Considerations

- Max 57 symbols required (Dobble math constraint)
- UI should show progress (e.g., "42/57 symbols selected")
- Duplicate detection
- Preview of selected symbols

---

## Phase 3: Supabase Integration 🔲 NOT STARTED

**Goal**: Persist custom card sets to Supabase, linked to Clerk user accounts.

### Tasks

- [ ] Set up Supabase project and tables
- [ ] Create `card_sets` table schema:
  ```sql
  - id (uuid)
  - user_id (from Clerk)
  - name (string)
  - symbols (json array)
  - is_public (boolean)
  - created_at, updated_at
  ```
- [ ] Create Supabase client with Clerk JWT integration
- [ ] Migrate localStorage card sets to Supabase on login
- [ ] Load user's card sets on app startup
- [ ] CRUD operations for card sets
- [ ] Handle offline/sync scenarios

---

## Phase 4: Multiplayer Custom Card Set Sharing 🔲 NOT STARTED

**Goal**: Allow hosts to use custom card sets in multiplayer games.

### Tasks

- [ ] When host selects custom card set, send full symbol data to server
- [ ] Server stores symbols in room state (not just cardSetId)
- [ ] Broadcast symbols to all players on game start
- [ ] Consider "publish" mechanism for sharing card sets publicly
- [ ] Handle case where custom card set is deleted mid-game

### Options to Consider

**Option A**: Host sends full symbol array when starting game
- Pros: Simple, works immediately
- Cons: Larger message payload

**Option B**: Publish card sets to shared store first
- Pros: Reusable, browsable
- Cons: More complex, needs moderation

---

## Phase 5: PNG Symbol Support 🔲 FUTURE

**Goal**: Allow custom card sets to use PNG images instead of emojis.

### Tasks

- [ ] Extend `SymbolItem` to support image URLs
- [ ] Image upload/storage (Supabase Storage or similar)
- [ ] Update `Card.tsx` to render images
- [ ] Image optimization (sizing, caching)
- [ ] Fallback handling for failed image loads

---

## Architecture Notes

### Key Types

```typescript
// Layout controls visual arrangement only
enum CardLayout {
  ORDERLY = 'ORDERLY',   // 1 center + 7 in circle
  CHAOTIC = 'CHAOTIC',   // Physics-based random
}

// Card set defines the symbols
interface CardSet {
  id: string;
  name: string;
  description: string;
  symbols: SymbolItem[];  // Must have 57 items
  isBuiltIn: boolean;
}

// Symbol can be emoji (now) or image (future)
interface SymbolItem {
  id: number;
  char: string;      // Emoji character
  name: string;
  // Future: imageUrl?: string;
}
```

### Helper Functions

```typescript
// Get card set by ID (checks built-in, then custom)
getCardSetById(id: string): CardSet | undefined

// Get symbols for deck generation
getSymbolsForCardSet(cardSetId: string): SymbolItem[]
```

### Built-in Card Sets

| ID | Name | Description |
|----|------|-------------|
| `children` | Children's | Animals - 🐶🐱🐭🐹🐰... |
| `mixed` | Mixed | Themed groups - 🍎🐙🐝☀️🎸... |
| `smiley` | Smiley Faces | All faces - 😀😃😄😁😆... |

---

## Testing Checklist

### Phase 1 ✅
- [x] Single-player: ORDERLY layout works
- [x] Single-player: CHAOTIC layout works
- [x] Single-player: All 3 card sets work
- [x] Multiplayer: Host can change layout
- [x] Multiplayer: Host can change card set
- [x] Multiplayer: Non-host sees config updates
- [x] Build passes

### Phase 2
- [ ] Emoji picker opens and searches
- [ ] Can select 57 emojis
- [ ] Validation prevents < 57 or duplicates
- [ ] Custom set appears in lobby
- [ ] Custom set persists in localStorage
- [ ] Can edit/delete custom sets

### Phase 3
- [ ] Login syncs localStorage to Supabase
- [ ] Card sets load on app startup
- [ ] CRUD operations work
- [ ] Logout clears local data

### Phase 4
- [ ] Host's custom set works in multiplayer
- [ ] All players see correct symbols
- [ ] Handle deleted card set gracefully
