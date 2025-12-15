# Plan: Extend Symbol System to Support PNG Images

## Summary

Extend SameSnap's symbol system to support PNG images alongside emojis. The current system uses emoji characters (`char` property) for display, while matching is purely ID-based (`symbol.id`). This architecture makes PNG support straightforward - we add an optional `imageUrl` property and conditionally render either text or `<img>`.

---

## Current Architecture

**SymbolItem** (`shared/types.ts`):
```typescript
interface SymbolItem {
  id: number;      // Used for ALL matching logic (0-56)
  char: string;    // Emoji character for display
  name: string;    // Human-readable name
}
```

**Rendering** (`Card.tsx:208`): `{item.symbol.char}` - direct text rendering

**Key Insight**: Matching logic uses only `id` - no changes needed to game mechanics.

---

## Phase 1: MVP - Built-in PNG Support

### Step 1: Extend SymbolItem Type

**File: `shared/types.ts`**

```typescript
interface SymbolItem {
  id: number;
  char: string;            // Keep for emoji (empty string for images)
  name: string;
  type?: 'emoji' | 'image'; // Optional for backwards compat
  imageUrl?: string;        // URL to PNG
}
```

### Step 2: Create Symbol Set Registry

**New File: `shared/symbolSets.ts`**

```typescript
interface SymbolSetDefinition {
  id: string;              // e.g., 'classic', 'animals'
  name: string;            // Display name
  description: string;
  type: 'emoji' | 'image';
  category: 'builtin' | 'premium' | 'user';
  thumbnailUrl?: string;   // Preview image for UI
  symbols: SymbolItem[];   // 57+ symbols required
}
```

Convert existing emoji arrays (`SYMBOLS`, `SYMBOLS_HARD`, `SYMBOLS_INSANE`) to this format.

### Step 3: Update Card Rendering

**File: `components/Card.tsx` (line 208)**

Replace:
```typescript
{item.symbol.char}
```

With:
```typescript
{item.symbol.type === 'image' && item.symbol.imageUrl ? (
  <img
    src={item.symbol.imageUrl}
    alt={item.symbol.name}
    className="w-full h-full object-contain pointer-events-none select-none"
    draggable={false}
  />
) : (
  item.symbol.char
)}
```

### Step 4: Update Game Config

**File: `shared/types.ts`**

Add `symbolSetId` to config interfaces:
```typescript
interface MultiplayerGameConfig {
  cardDifficulty: CardDifficulty;
  gameDuration: GameDuration;
  symbolSetId?: string;  // NEW
}
```

### Step 5: Update Game Logic

**File: `shared/gameLogic.ts`**

Modify `generateDeck()`:
```typescript
export const generateDeck = (
  n: number = 7,
  symbolSetId?: string,
  customSymbols?: SymbolItem[]
): CardData[] => {
  const symbolSet = customSymbols || getSymbolSetOrDefault(symbolSetId).symbols;
  // ... rest unchanged
};
```

### Step 6: Update Server

**File: `party/index.ts`**

- Pass `symbolSetId` from config to deck generation
- Validate `symbolSetId` exists before game start
- Broadcast selected set to all clients

### Step 7: Create Image Preloader

**New File: `hooks/useImagePreloader.ts`**

Preload all 57 images before game starts:
- Track loading progress
- Show loading indicator in lobby
- Handle errors with fallback

### Step 8: Add Symbol Set Picker UI

**New File: `components/SymbolSetPicker.tsx`**

Integrate into:
- `components/lobby/SinglePlayerLobby.tsx`
- `components/lobby/WaitingRoom.tsx`

### Step 9: Add First PNG Set

**Directory: `public/symbols/sets/animals/`**

- 57 PNG files (0.png through 56.png)
- 256x256 pixels, transparent background
- `thumbnail.png` for set selector

---

## Phase 2: Future Paid Feature - User Uploads

**Not for initial implementation**, but architecture should support:

1. **User Authentication** - Associate uploads with accounts
2. **Cloud Storage** - S3/R2 for user images
3. **Validation**:
   - Exactly 57 images required
   - Size/format limits
   - Content moderation
4. **Unique Names** - Required since PNGs can't be visually identified in code
5. **Sharing** - Private vs public sets

---

## Files to Modify

| File | Changes |
|------|---------|
| `shared/types.ts` | Extend `SymbolItem`, update configs |
| `constants.ts` | May need minor updates for backwards compat |
| `components/Card.tsx` | Conditional emoji/image rendering |
| `shared/gameLogic.ts` | Accept `symbolSetId` parameter |
| `party/index.ts` | Pass symbol set through multiplayer |
| `components/lobby/SinglePlayerLobby.tsx` | Add set selector |
| `components/lobby/WaitingRoom.tsx` | Add set selector for host |

## New Files

| File | Purpose |
|------|---------|
| `shared/symbolSets.ts` | Symbol set registry and utilities |
| `components/SymbolSetPicker.tsx` | Reusable set selection UI |
| `hooks/useImagePreloader.ts` | Preload PNG images |
| `public/symbols/sets/*/` | PNG asset directories |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| **Image loading delays** | Preloader with progress bar; block game start until loaded |
| **Large file sizes** | Optimize PNGs; consider WebP with fallback |
| **Multiplayer desync** | Server validates set ID; broadcast to all clients |
| **Broken images** | `onError` fallback to placeholder emoji |
| **CSS scaling issues** | Test all layout modes (EASY/MEDIUM) with images |
| **Memory with many sets** | Clear image cache between games |

---

## PNG Image Requirements

For custom sets, images must be:
- **Format**: PNG with transparency
- **Size**: 256x256 pixels (scales well up/down)
- **Count**: Exactly 57 images (for order-7 projective plane)
- **Style**: Consistent across set, clear silhouettes
- **Names**: Must provide unique human-readable name for each

---

## Implementation Notes

1. **Backwards Compatibility**: All new fields are optional - existing emoji sets work unchanged
2. **No Matching Logic Changes**: `symbol.id` comparison unchanged
3. **Rotation Works**: CSS `transform: rotate()` works on `<img>` same as text
4. **Scaling Works**: Container-based sizing with `object-contain` handles images
5. **Click Handling**: `pointer-events-none` on `<img>` lets clicks bubble to parent div
