# Card Set Feature - Issues & Fixes Report

**Branch:** `cardset`
**Date:** 2024-12-16
**Compared to:** `main`

---

## Summary

This report documents the issues encountered and fixes applied while implementing cloud storage for custom card sets using Vercel KV and Clerk authentication.

---

## Issue 1: Card Set Creation Button Visible When Not Signed In

### Problem
The "Create New" card set button was visible to all users, even when not signed in. Users should only see this option when authenticated.

### Root Cause
In `App.tsx`, the `canCreate` prop passed to `SinglePlayerLobby` was using a hardcoded check:
```typescript
canCreate={customSets.length < 10}
```
This only checked the count limit but **did not verify authentication status**.

### Fix Applied
Updated `App.tsx` to use the `canCreate` value from the `useCustomCardSets` hook, which properly checks both conditions:

**File:** `App.tsx`
**Line:** ~131, ~283

```typescript
// Before
const { customSets, isLoading: isLoadingCardSets, createSet, updateSet, deleteSet } = useCustomCardSets();
// ...
canCreate={customSets.length < 10}

// After
const { customSets, isLoading: isLoadingCardSets, canCreate, createSet, updateSet, deleteSet } = useCustomCardSets();
// ...
canCreate={canCreate}
```

The hook's `canCreate` is defined as:
```typescript
// hooks/useCustomCardSets.ts line 36
const canCreate = isSignedIn === true && customSets.length < MAX_CARD_SETS;
```

### Verification Steps
1. Open the app without signing in
2. Navigate to Single Player Lobby
3. **Expected:** "Create New" button should NOT be visible
4. Sign in with Google/Clerk
5. **Expected:** "Create New" button should now be visible

---

## Issue 2: User Profile Menu Shows Count Only, Not Names

### Problem
The user profile dropdown (Clerk UserButton) showed only the count of saved card sets:
```
Card Sets: 2/10
```
Users wanted to see the actual names of their saved card sets.

### Root Cause
The label in `App.tsx` was using a simple count template:
```typescript
label={isLoadingCardSets ? 'Card Sets: ...' : `Card Sets: ${customSets.length}/10`}
```

### Fix Applied
Updated the label to display card set names:

**File:** `App.tsx`
**Lines:** ~256-266

```typescript
// Before
label={isLoadingCardSets ? 'Card Sets: ...' : `Card Sets: ${customSets.length}/10`}

// After
label={isLoadingCardSets
  ? 'Card Sets: ...'
  : customSets.length === 0
    ? 'Card Sets: None (0/10)'
    : `Card Sets: ${customSets.map(s => s.name).join(', ')} (${customSets.length}/10)`
}
```

### Verification Steps
1. Sign in to the app
2. Create one or more custom card sets
3. Click on the user profile avatar in the header
4. **Expected:** Menu should show "Card Sets: MySet1, MySet2 (2/10)" instead of just "Card Sets: 2/10"

---

## Issue 3: API Routes Failing with TypeError

### Problem
API calls to `/api/cardsets` were returning 500 errors with:
```
TypeError: request.headers.get is not a function at getUserId
```

### Root Cause
The API routes were written using the **Web API Request/Response pattern**:
```typescript
async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');  // Web API method
  // ...
}
```

However, Vercel's **Node.js runtime** (required for `@clerk/backend`) uses a different request format where `headers` is a plain object, not a `Headers` instance with a `.get()` method.

### Fix Applied
Converted both API routes to use Vercel's Node.js API pattern:

**File:** `api/cardsets.ts`

```typescript
// Before (Web API pattern - doesn't work in Node.js runtime)
import type from 'somewhere';

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  // ...
}

export default async function handler(request: Request): Promise<Response> {
  const body = await request.json();
  return new Response(JSON.stringify(data), { status: 200 });
}

// After (Vercel Node.js pattern)
import type { VercelRequest, VercelResponse } from '@vercel/node';

async function getUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;  // Plain object property
  // ...
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { name, symbols } = req.body;  // Auto-parsed by Vercel
  return res.status(200).json({ data });
}
```

**File:** `api/cardsets/[id].ts`

Same pattern applied - converted from Web API to Vercel Node.js API.

### Key Differences

| Aspect | Web API (Edge) | Vercel Node.js |
|--------|---------------|----------------|
| Types | `Request`, `Response` | `VercelRequest`, `VercelResponse` |
| Headers | `request.headers.get('Authorization')` | `req.headers.authorization` |
| Body | `await request.json()` | `req.body` (auto-parsed) |
| Response | `new Response(JSON.stringify(data))` | `res.status(200).json(data)` |
| Query params | Parse from URL | `req.query.id` |

### Verification Steps
1. Sign in to the app
2. Navigate to Single Player Lobby
3. Click "Create New" card set button
4. Fill in name and select 57 emojis
5. Click Save
6. **Expected:** Card set saves successfully without 500 error
7. Check Vercel logs - no `TypeError: request.headers.get is not a function`

---

## Issue 4: Card Sets Not Syncing Across Environments

### Problem (Not a Bug - Expected Behavior)
User created card sets on one environment (e.g., production) but they don't appear on another environment (e.g., preview branch).

### Explanation
This is **expected behavior**, not a bug. Vercel KV (Upstash Redis) stores are environment-specific:

- **Production** deployment → Production KV database
- **Preview** deployments → Preview KV database (separate)
- **Local dev** → May not have KV access

Card sets are keyed by Clerk user ID:
```typescript
await kv.get<StoredCardSet[]>(`cardsets:${userId}`)
```

So the same user will have different data in different KV stores.

### Resolution Options
1. **Connect preview to production KV** (not recommended for testing)
2. **Re-create card sets** on each environment
3. **Add export/import feature** (future enhancement)

---

## Files Changed

| File | Changes |
|------|---------|
| `App.tsx` | Use `canCreate` from hook; show card set names in profile menu |
| `api/cardsets.ts` | Convert to Vercel Node.js API pattern |
| `api/cardsets/[id].ts` | Convert to Vercel Node.js API pattern |
| `constants.ts` | Christmas card set emojis (unrelated) |
| `shared/cardSets.ts` | Renamed "Mixed" to "Christmas" (unrelated) |

---

## Commits

1. `2f22138` - Fix: Hide card set creation button when not signed in
2. `9f2e239` - Show card set names in user profile menu
3. `446ccd4` - Fix: Use Node.js runtime for API routes (Edge incompatible with @clerk/backend)

---

## Testing Checklist

### Authentication Gating
- [ ] "Create New" button hidden when signed out
- [ ] "Create New" button visible when signed in
- [ ] Edit/Delete buttons only appear for own custom sets

### API Functionality
- [ ] GET /api/cardsets returns user's card sets
- [ ] POST /api/cardsets creates new card set
- [ ] PUT /api/cardsets/[id] updates card set
- [ ] DELETE /api/cardsets/[id] deletes card set
- [ ] All endpoints return 401 when not authenticated

### User Profile Menu
- [ ] Shows "Card Sets: None (0/10)" when empty
- [ ] Shows "Card Sets: SetName (1/10)" with one set
- [ ] Shows "Card Sets: Set1, Set2 (2/10)" with multiple sets

### Error Handling
- [ ] No TypeError in Vercel logs
- [ ] Proper error messages shown to user on failure

---

## Architecture Notes

### Why Node.js Runtime?
The `@clerk/backend` package requires Node.js crypto modules that are not available in the Edge runtime. This is why we must use `VercelRequest`/`VercelResponse` instead of the Web API pattern.

### Data Flow
```
User Action → React Component → useCustomCardSets hook → cloudCardSets.ts → /api/cardsets → Vercel KV
```

### Storage Key Pattern
```
cardsets:${clerkUserId}  →  StoredCardSet[]
```

Each user's card sets are stored as a single JSON array under their Clerk user ID.
