# PNG Card Set Implementation Plan

This document outlines the steps to add PNG image support for special edition card sets. This is author-controlled only (no user uploads).

## Overview

- Add optional `imageUrl` field to `SymbolItem` type
- Modify Card component to render images when `imageUrl` exists
- Add image preloading to prevent flicker during gameplay
- Create folder structure for PNG assets
- Define new card sets that reference PNG images

## Prerequisites

- 57 square PNG images per card set
- Consistent naming convention (semantic names recommended)
- Images should be **256x256 pixels** (see sizing rationale below)

---

## Step 1: Extend SymbolItem Type

**File:** `shared/types.ts`

```typescript
// BEFORE
export interface SymbolItem {
  id: number;
  char: string;
  name: string;
}

// AFTER
export interface SymbolItem {
  id: number;
  char: string;        // Fallback text (can be empty string for PNG-only)
  name: string;        // Used for alt text and accessibility
  imageUrl?: string;   // Optional PNG path (relative to public folder)
}
```

**Notes:**
- `char` remains required for backward compatibility with existing emoji sets
- For PNG sets, `char` can be an empty string or a fallback emoji
- `name` becomes important for image alt text (accessibility)

---

## Step 2: Create PNG Assets Folder Structure

**Location:** `public/cardsets/`

```
public/
└── cardsets/
    └── animals/           # Example set name
        ├── cat.png
        ├── dog.png
        ├── elephant.png
        ├── ... (57 total)
        └── zebra.png
```

**Image Requirements:**
- Format: PNG (transparency supported)
- Dimensions: **256x256 pixels** (square, see rationale below)
- File names: lowercase, kebab-case (e.g., `polar-bear.png`)
- Count: Exactly 57 images per set
- File size: Target ~10-30KB per image after optimization (TinyPNG recommended)
- Total set size: ~1-1.5MB for all 57 images

**URL Pattern:**
Images in `public/cardsets/animals/cat.png` are served at `/cardsets/animals/cat.png`

### Image Sizing Rationale

**Why 256x256?**
- On larger screens, cards can be 300+ pixels, with symbols rendering at ~75px
- 256px source provides crisp rendering without upscaling artifacts
- 128x128 would look slightly fuzzy on larger displays
- 512x512 offers diminishing returns with heavier download (57 images × 512px = significant bandwidth)
- For retina displays, 512x512 is acceptable if file size isn't a concern

### Collision Detection - No Changes Needed

The Card component's physics-based layout uses **percentage-based collision radii**, not pixel dimensions:

```typescript
// From Card.tsx - collision radius calculation
radius: (12.5 * scale) * 0.9  // Based on 25% container size, not image pixels
```

**Why this works:**
- The layout algorithm operates in normalized coordinates (0-100%)
- Symbol size is determined by `scale` factor (0.85-1.25), not image resolution
- `objectFit: 'contain'` ensures images fit their containers properly
- Image resolution has zero effect on collision detection

**Best practice for images:**
- Crop images tight to the subject (minimize transparent padding)
- Images with excessive padding will appear visually smaller than their collision box
- Square aspect ratio is required - non-square images will have empty space in their collision area

---

## Step 3: Create PNG Card Set Definition

**File:** `shared/cardSets.ts` (add to existing file)

Add a helper function and new card set:

```typescript
// Helper to create PNG-based SymbolItem array
function createPngSymbols(
  setFolder: string,
  imageNames: string[]
): SymbolItem[] {
  if (imageNames.length !== 57) {
    throw new Error(`PNG card set must have exactly 57 images, got ${imageNames.length}`);
  }

  return imageNames.map((name, index) => ({
    id: index,
    char: '',  // No emoji fallback for PNG sets
    name: name.replace(/-/g, ' ').replace(/\.png$/, ''),  // "polar-bear.png" -> "polar bear"
    imageUrl: `/cardsets/${setFolder}/${name}`,
  }));
}

// Example PNG card set definition
const ANIMALS_IMAGES = [
  'cat.png',
  'dog.png',
  'elephant.png',
  // ... all 57 image filenames
  'zebra.png',
];

export const SYMBOLS_ANIMALS = createPngSymbols('animals', ANIMALS_IMAGES);

export const CARD_SET_ANIMALS: CardSet = {
  id: 'animals',
  name: 'Animals',
  description: 'Beautiful animal illustrations',
  symbols: SYMBOLS_ANIMALS,
  isBuiltIn: true,
};

// Add to BUILT_IN_CARD_SETS array
export const BUILT_IN_CARD_SETS: CardSet[] = [
  CARD_SET_CHILDREN,
  CARD_SET_CHRISTMAS,
  CARD_SET_INSANITY,
  CARD_SET_ANIMALS,  // Add new PNG set
];
```

---

## Step 4: Modify Card Component Rendering

**File:** `components/Card.tsx`

Find the symbol rendering section (around line 208) and update:

```typescript
// BEFORE (around line 208)
{symbolLayout.map((item, i) => (
  <div
    key={`${card.id}-${item.symbol.id}-${i}`}
    className={cn(
      // ... existing classes
    )}
    onClick={() => onClickSymbol(item.symbol)}
    style={{
      left: `${item.x}%`,
      top: `${item.y}%`,
      width: `${25 * item.scale}%`,
      height: `${25 * item.scale}%`,
      fontSize: `${size * 0.15 * item.scale}px`,
      transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
      // ... other styles
    }}
  >
    {item.symbol.char}
  </div>
))}

// AFTER
{symbolLayout.map((item, i) => (
  <div
    key={`${card.id}-${item.symbol.id}-${i}`}
    className={cn(
      // ... existing classes
    )}
    onClick={() => onClickSymbol(item.symbol)}
    style={{
      left: `${item.x}%`,
      top: `${item.y}%`,
      width: `${25 * item.scale}%`,
      height: `${25 * item.scale}%`,
      fontSize: item.symbol.imageUrl ? undefined : `${size * 0.15 * item.scale}px`,
      transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
      // ... other styles
    }}
  >
    {item.symbol.imageUrl ? (
      <img
        src={item.symbol.imageUrl}
        alt={item.symbol.name}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',  // Let clicks pass through to parent div
        }}
      />
    ) : (
      item.symbol.char
    )}
  </div>
))}
```

**Key Changes:**
- Conditional render: `<img>` when `imageUrl` exists, text otherwise
- `fontSize` only applied to emoji symbols (undefined for images)
- Image uses `width: 100%` to fill the container (which already has correct sizing)
- `objectFit: 'contain'` preserves aspect ratio
- `pointerEvents: 'none'` ensures click handler on parent div works
- `draggable={false}` prevents accidental image dragging

---

## Step 5: Add Image Preloading

**File:** `hooks/useImagePreloader.ts` (new file)

```typescript
import { useEffect, useState } from 'react';
import type { SymbolItem } from '@/shared/types';

export function useImagePreloader(symbols: SymbolItem[]) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const imageUrls = symbols
      .filter((s) => s.imageUrl)
      .map((s) => s.imageUrl!);

    // No images to preload (emoji set)
    if (imageUrls.length === 0) {
      setLoaded(true);
      setProgress(100);
      return;
    }

    let loadedCount = 0;

    const promises = imageUrls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / imageUrls.length) * 100));
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to preload image: ${url}`);
          loadedCount++;
          setProgress(Math.round((loadedCount / imageUrls.length) * 100));
          resolve();  // Resolve anyway to not block game
        };
        img.src = url;
      });
    });

    Promise.all(promises).then(() => {
      setLoaded(true);
    });
  }, [symbols]);

  return { loaded, progress };
}
```

---

## Step 6: Integrate Preloader in Game Components

**File:** `components/game/SinglePlayerGame.tsx` (and `MultiplayerGame.tsx`)

```typescript
import { useImagePreloader } from '@/hooks/useImagePreloader';

// Inside the component, after symbols are resolved:
const symbols = /* existing symbol resolution logic */;
const { loaded: imagesLoaded, progress } = useImagePreloader(symbols);

// Show loading state if images aren't ready
if (!imagesLoaded) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div>Loading card set...</div>
      <div>{progress}%</div>
      {/* Or use a proper loading spinner/progress bar */}
    </div>
  );
}

// Rest of component renders normally once images are loaded
```

---

## Step 7: Update Card Set Selection UI (Optional)

**File:** `components/cardset/CardSetsDrawer.tsx` (or wherever card sets are displayed)

If you want to show a preview thumbnail for PNG sets:

```typescript
// Add a preview image to CardSet type (optional)
export interface CardSet {
  id: string;
  name: string;
  description: string;
  symbols: SymbolItem[];
  isBuiltIn: boolean;
  previewImage?: string;  // Optional: "/cardsets/animals/preview.png"
}

// In the UI, show either preview image or first few emojis
{cardSet.previewImage ? (
  <img src={cardSet.previewImage} alt={cardSet.name} />
) : (
  <span>{cardSet.symbols.slice(0, 4).map(s => s.char).join('')}</span>
)}
```

---

## Testing Checklist

- [ ] Type changes compile without errors
- [ ] Existing emoji card sets still work correctly
- [ ] PNG card set appears in card set selection
- [ ] Images preload before game starts (no flicker)
- [ ] Images render at correct size on cards
- [ ] Images rotate correctly with card layout
- [ ] Click detection works on PNG symbols
- [ ] Highlight effect works when symbol is matched
- [ ] Game plays correctly end-to-end with PNG set
- [ ] Mobile: images render correctly at smaller sizes
- [ ] Performance: no lag with 57 images loaded

---

## File Change Summary

| File | Change |
|------|--------|
| `shared/types.ts` | Add `imageUrl?: string` to SymbolItem |
| `shared/cardSets.ts` | Add helper function and PNG card set definitions |
| `components/Card.tsx` | Conditional img/text rendering |
| `hooks/useImagePreloader.ts` | New file for preloading |
| `components/game/SinglePlayerGame.tsx` | Integrate preloader |
| `components/game/MultiplayerGame.tsx` | Integrate preloader |
| `public/cardsets/{setname}/*.png` | 57 PNG images per set |

---

## Creating a New PNG Card Set (Future Sets)

1. Create folder: `public/cardsets/{setname}/`
2. Add 57 square PNG images with semantic names
3. Add to `shared/cardSets.ts`:
   ```typescript
   const SETNAME_IMAGES = ['image1.png', 'image2.png', /* ... 57 total */];
   export const SYMBOLS_SETNAME = createPngSymbols('setname', SETNAME_IMAGES);
   export const CARD_SET_SETNAME: CardSet = {
     id: 'setname',
     name: 'Display Name',
     description: 'Description for UI',
     symbols: SYMBOLS_SETNAME,
     isBuiltIn: true,
   };
   ```
4. Add to `BUILT_IN_CARD_SETS` array
5. Done!

---

## Notes

- Images are served statically from `/public` - no API changes needed
- The 57-image requirement comes from projective plane math (order N=7)
- Semantic names improve accessibility (used as alt text)
- Consider image optimization (TinyPNG, etc.) before adding to repo
