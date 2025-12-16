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

## Phase 2: Custom Card Set Creation UI ✅ COMPLETE

**Goal**: Allow users to create and manage their own card sets using emoji picker.

### Completed Tasks

- [x] Create emoji picker component with search/categories
- [x] Create card set editor UI (add/remove emojis, name the set)
- [x] Validate card sets (must have exactly 57 unique symbols)
- [x] Save custom card sets to localStorage (temporary)
- [x] Display custom card sets alongside built-in sets in lobby
- [x] Allow editing/deleting custom card sets
- [x] Add "paste 57 emojis" import functionality

### Files Created

| File | Purpose |
|------|---------|
| `components/cardset/CardSetEditor.tsx` | Full card set editor with 57-slot grid, progress bar, paste modal |
| `components/cardset/EmojiPicker.tsx` | Searchable emoji picker with categories |
| `data/emojiData.ts` | Emoji database with names for search |
| `utils/customCardSets.ts` | localStorage CRUD operations with validation |
| `hooks/useCustomCardSets.ts` | React hook for managing custom card sets |

### Features Implemented

- 57-slot visual grid showing filled/empty positions
- Progress bar with completion status
- Emoji search by name across all categories
- Category tabs for browsing emojis
- Paste modal to import 57 emojis from any source
- Shuffle order, clear all buttons
- Edit/delete buttons on custom sets in lobby
- Validation: exactly 57 unique symbols required

---

## Phase 3: Vercel KV Integration 🔲 NOT STARTED

**Goal**: Persist custom card sets to Vercel KV, linked to Clerk user accounts. Users get cloud sync when logged in, localStorage fallback when not.

### Why Vercel KV over Supabase?

- No dormancy/pausing (Supabase free tier pauses after 7 days inactivity)
- Already using Vercel for deployment
- Simple key-value storage is sufficient for card sets
- Pay-per-request pricing, no idle costs

### Data Model

```
Key: cardsets:{clerkUserId}
Value: JSON array of StoredCardSet objects
```

```typescript
interface StoredCardSet {
  id: string;           // e.g., "custom_1234567890_abc123"
  name: string;         // "My Card Set"
  symbols: string[];    // Array of 57 emoji characters
  createdAt: number;    // Unix timestamp
  updatedAt: number;    // Unix timestamp
}
```

### User Experience

| User State | Card Sets Available |
|------------|---------------------|
| **Not logged in** | Built-in sets only (Children's, Christmas, Smiley) |
| **Logged in** | Built-in sets + Custom sets from Vercel KV |

**Note**: "Create New" button only shown to logged-in users. This simplifies the implementation by removing localStorage sync complexity.

### Tasks

- [ ] Add `@vercel/kv` package
- [ ] Create API routes with Clerk auth:
  - [ ] `GET /api/cardsets` - List user's card sets
  - [ ] `POST /api/cardsets` - Create new card set
  - [ ] `PUT /api/cardsets/[id]` - Update card set
  - [ ] `DELETE /api/cardsets/[id]` - Delete card set
- [ ] Add Clerk middleware to protect `/api/*` routes
- [ ] Create `utils/cloudCardSets.ts` - API client functions
- [ ] Update `useCustomCardSets` hook:
  - [ ] Return empty array if not logged in
  - [ ] Fetch from KV on mount (if logged in)
  - [ ] CRUD operations go directly to KV
- [ ] Update UI:
  - [ ] Hide "Create New" button when not logged in
  - [ ] Show prompt to sign in to create custom sets (optional)
- [ ] Remove localStorage code (`utils/customCardSets.ts`) after KV is working
- [ ] Add loading states for cloud operations

### Files to Create

| File | Purpose |
|------|---------|
| `api/cardsets/route.ts` | GET (list) and POST (create) |
| `api/cardsets/[id]/route.ts` | PUT (update) and DELETE |
| `middleware.ts` | Clerk auth for API routes |
| `utils/cloudCardSets.ts` | Client-side API wrapper (replaces localStorage version) |

### Files to Deprecate

| File | Action |
|------|--------|
| `utils/customCardSets.ts` | Delete after Phase 3 complete |

### Environment Variables

```
KV_REST_API_URL=<from Vercel dashboard>
KV_REST_API_TOKEN=<from Vercel dashboard>
```

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

### Phase 2 ✅
- [x] Emoji picker opens and searches
- [x] Can select 57 emojis
- [x] Validation prevents < 57 or duplicates
- [x] Custom set appears in lobby
- [x] Custom set persists in localStorage
- [x] Can edit/delete custom sets

### Phase 3
- [ ] Not logged in: only built-in card sets shown, no "Create New" button
- [ ] Logged in: custom card sets load from Vercel KV
- [ ] Logged in: CRUD operations work via API
- [ ] Cross-device: card sets appear on different device when logged in
- [ ] localStorage code removed (deprecated)

### Phase 4
- [ ] Host's custom set works in multiplayer
- [ ] All players see correct symbols
- [ ] Handle deleted card set gracefully
