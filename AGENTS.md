# Repository Guidelines

## Project Structure & Module Organization
SameSnap combines a Vite + React TypeScript client with PartyKit multiplayer services. `App.tsx`, `index.tsx`, and `index.html` start the UI, while `components/game` and `components/lobby` keep feature-specific views. Shared types and logic live in `shared/` so both the browser bundle and the PartyKit handlers inside `party/` stay in sync. Hooks under `hooks/` (e.g., `useMultiplayerGame.ts`) wrap connection state, and `utils/` plus `constants.ts` carry math and emoji helpers. Vite emits builds into `dist/`.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — launch the Vite dev server for the React client.
- `npm run dev:party` — boot the PartyKit room service defined in `partykit.json`.
- `npm run dev:all` — run both client and PartyKit servers concurrently.
- `npm run build && npm run preview` — produce a production bundle in `dist/` and serve it locally.
- `npm run test` — run logic, multiplayer, and hook suites; use `test:ui`, `test:comprehensive`, or `test:stress` for targeted runs.

## Coding Style & Naming Conventions
Write new code in TypeScript, use the `@/` alias, and favor functional React components. Match the two-space indentation, trailing commas, and single quotes. Export named symbols from shared helpers so PartyKit and the client can tree-shake safely. Keep hooks named `useX`, components `PascalCase`, and folders in `components/` grouped by domain (e.g., `game`, `lobby`).

## Testing Guidelines
The root `test-*.mjs` scripts rely on Node’s `assert` helpers and custom harness logging, so keep suites deterministic. Add new scripts as needed and register them in `package.json`. Prefer descriptive test names such as `player should rejoin room after reconnect`. Run `npm run test:all` before merging and include deterministic regression cases for every bug fix or gameplay tweak.

## Commit & Pull Request Guidelines
Recent commits use succinct, capitalized statements (`Add PartyKit multiplayer support`, `WIP: Fix multiplayer room auto-start race conditions`). Mirror that style, optionally prefixing `WIP:` when the change is unfinished. Pull requests should outline the scenario, cite the commands/tests executed, and link to an AI Studio ticket. Attach screenshots for UI or stress changes and call out PartyKit schema updates.

## Security & Configuration Tips
Store secrets such as `GEMINI_API_KEY` in `.env.local` (git-ignored) and never commit them. Update `partykit.json` carefully—room name or host changes impact production rooms immediately. When touching shared types, confirm both the client (`npm run build`) and PartyKit service (`npm run dev:party`) still start before pushing.

---

## Multiplayer Development: Lessons Learned

### The Core Mental Model

**Multiplayer is not "handling messages from multiple connections." It is "N independent state machines that must stay synchronized."**

Every client maintains its own local state. The server is the source of truth. Every message must be analyzed from the perspective of ALL clients simultaneously, not just the actor.

### The Critical Question

Before implementing ANY server message or broadcast, ask:

```
What does each client's local state look like AFTER this message?
```

Draw it out:
```
Event: Player B joins

Server state after:
  players: [A, B], hostId: A

Player A receives:
  player_joined: { player: B, isYou: FALSE, isHost: FALSE }

Player B receives:
  room_state: { players: [A(isYou:false), B(isYou:TRUE)], ... }

Invariants:
  - Exactly one player has isYou=true per client ✓
  - Exactly one player has isHost=true globally ✓
  - Player counts match across all clients ✓
```

### Broadcast vs. Per-Connection Messages

**Broadcasts send identical bytes to all clients.** If ANY field in the payload should differ per recipient, you cannot use a simple broadcast.

| Message Type | Can Broadcast? | Why |
|--------------|----------------|-----|
| `player_left` | Yes | Same info for everyone |
| `round_winner` | Yes | Same winner for everyone |
| `countdown` | Yes | Same countdown for everyone |
| `host_changed` | Yes | Same new host for everyone |
| `player_joined` | **NO** | `isYou` differs per recipient |
| `room_state` | **NO** | `isYou`, `yourCard` differ per recipient |
| `round_start` | **NO** | `yourCard` differs per recipient |

When you need per-client data, iterate over connections and send individually:
```typescript
private broadcastPlayerJoined(player: ServerPlayer) {
  for (const conn of this.room.getConnections()) {
    const targetPlayerId = this.connectionToPlayerId.get(conn.id);
    if (!targetPlayerId) continue;
    conn.send(JSON.stringify({
      type: 'player_joined',
      payload: { player: this.toClientPlayer(player, targetPlayerId) }
    }));
  }
}
```

### Identity Management: Player ID vs Connection ID

**Player IDs must be stable across reconnections. Connection IDs change every time.**

- `playerId`: Logical identity, persists across reconnects, stored in localStorage
- `connectionId`: WebSocket session, changes on every connect
- Maintain a `connectionToPlayerId` mapping on the server
- Client persists `playerId` and sends it as `reconnectId` on reconnect

```typescript
// Server maintains mapping
private connectionToPlayerId: Map<string, string> = new Map();

// Client persists and sends reconnectId
const roomPath = reconnectId
  ? `${roomCode}?reconnectId=${encodeURIComponent(reconnectId)}`
  : roomCode;
```

### The Client-Server Contract

**The server and client are two halves of a contract. Test BOTH sides.**

A feature is not complete if:
- Server handles a query param the client never sends
- Server broadcasts a message type the client doesn't handle
- Client expects data the server doesn't include

Example failure: Server supported `?reconnectId=X` but React hook never sent it. Tests passed because they manually supplied reconnectId—but real users couldn't reconnect.

### State Synchronization Checklist

For every piece of state, answer:

1. **Who is the source of truth?** (Usually the server)
2. **When does it change?** (List all events)
3. **How do clients learn about changes?** (Which message, which field)
4. **What happens if a client misses an update?** (Reconnection, late join)

Example: `deckRemaining`
- Source of truth: Server's `this.deck.length`
- Changes: Every round when a card is drawn
- Clients learn: Must be included in `round_start` payload
- Missed updates: Reconnecting client gets current value in `room_state`

### Common Multiplayer Bugs (Case Studies)

#### Bug 1: Broadcast with per-client data
```typescript
// WRONG: isYou will be wrong for other clients
this.broadcastToAll({
  type: 'player_joined',
  payload: { player: this.toClientPlayer(player, joiningPlayerId) }
});

// RIGHT: Send to each client with their perspective
for (const conn of this.room.getConnections()) {
  const targetId = this.connectionToPlayerId.get(conn.id);
  conn.send(JSON.stringify({
    type: 'player_joined',
    payload: { player: this.toClientPlayer(player, targetId) }
  }));
}
```

#### Bug 2: Notifying only the actor
```typescript
// WRONG: Only new host knows they're host
if (player.isHost && this.players.size > 0) {
  const newHost = Array.from(this.players.values())[0];
  newHost.isHost = true;
  this.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
  // Other clients still think old player was host!
}

// RIGHT: Notify everyone
this.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
this.broadcastToAll({ type: 'host_changed', payload: { playerId: newHost.id } });
```

#### Bug 3: ID mutation on reconnect
```typescript
// WRONG: Player ID changes, other clients can't find them
const player = { ...data.player, id: conn.id };  // ID is now connection ID
this.broadcastToAll({ type: 'player_reconnected', payload: { playerId: conn.id } });

// RIGHT: Keep player ID stable, update connection mapping
player.connectionId = conn.id;
this.connectionToPlayerId.set(conn.id, player.id);
this.broadcastToAll({ type: 'player_reconnected', payload: { playerId: player.id } });
```

#### Bug 4: Client doesn't implement server expectation
```typescript
// Server expects: ws://host/room?reconnectId=abc123
const reconnectId = url.searchParams.get('reconnectId');

// WRONG: Client never sends it
const socket = usePartySocket({ host, room: roomCode });

// RIGHT: Client persists and sends reconnectId
const roomPath = reconnectId
  ? `${roomCode}?reconnectId=${encodeURIComponent(reconnectId)}`
  : roomCode;
const socket = usePartySocket({ host, room: roomPath });
```

#### Bug 5: Stale derived state
```typescript
// WRONG: deckRemaining only sent once in room_state
// Client shows "45 cards left" for the entire game

// RIGHT: Include in every round_start
this.sendToPlayer(playerId, {
  type: 'round_start',
  payload: {
    centerCard: this.centerCard,
    yourCard,
    roundNumber: this.roundNumber,
    deckRemaining: this.deck.length  // Keep clients updated
  }
});
```

### Testing Multiplayer Code

#### Test the Bystander, Not Just the Actor

```javascript
// WRONG: Only tests what the joining player sees
const guest = await createPlayer(roomCode, 'Guest');
assert(guest.roomState.players.length === 2);

// RIGHT: Test what existing players see when someone joins
const host = await createPlayer(roomCode, 'Host');
const guest = await createPlayer(roomCode, 'Guest');
const hostNotification = await waitForMessage(host, 'player_joined');
assert(hostNotification.payload.player.isYou === false);  // Host sees isYou=false for Guest
```

#### Test the Actual Client Code

```javascript
// WRONG: Test manually crafts reconnectId (proves server works, not client)
const reconnected = await createPlayer(roomCode, 'Player', { reconnectId: oldId });

// RIGHT: Test that React hook actually persists and sends reconnectId
// Use Playwright to: join room, note playerId, refresh page, verify reconnection
```

#### Assert State Invariants

After every significant event, verify:
```javascript
// Exactly one isYou per client
const youCount = player.roomState.players.filter(p => p.isYou).length;
assert(youCount === 1, `Expected 1 isYou, got ${youCount}`);

// Exactly one host globally
const hostCount = player.roomState.players.filter(p => p.isHost).length;
assert(hostCount === 1, `Expected 1 host, got ${hostCount}`);

// Player counts match
assert(host.roomState.players.length === guest.roomState.players.length);
```

### Pre-Implementation Checklist

Before writing any multiplayer feature:

- [ ] What message type(s) will be sent?
- [ ] Is it a broadcast or per-connection?
- [ ] What does each client see after this message?
- [ ] What invariants must hold? (one host, one isYou, etc.)
- [ ] Does the client code implement what the server expects?
- [ ] What if a client reconnects mid-feature?
- [ ] What do bystanders (non-actors) see?

### Post-Implementation Checklist

Before marking a multiplayer feature complete:

- [ ] Tested with 3+ clients (not just 2)
- [ ] Tested what non-actors see
- [ ] Tested reconnection during this feature
- [ ] Verified client actually sends what server expects
- [ ] Added invariant assertions to tests
- [ ] Documented message contract (broadcast vs per-connection)

### The Fundamental Lesson

**"It works" is not the same as "it's correct for all clients."**

A feature that passes tests for the actor can still be completely broken for everyone else. Always ask: "What does Player B see when Player A does X?"

---

### React + WebSocket Pitfalls

These patterns were discovered through deep code review after all tests passed:

#### Stale Closures in useCallback

```typescript
// WRONG: roomState captured at creation, never updates
const handleMessage = useCallback((msg) => {
  const player = roomState?.players.find(p => p.id === msg.id);  // Stale!
}, []);  // roomState not in deps

// RIGHT: Read current state inside updater
const handleMessage = useCallback((msg) => {
  let foundPlayer = null;
  setRoomState(prev => {
    foundPlayer = prev?.players.find(p => p.id === msg.id);  // Current!
    return prev;
  });
}, []);
```

#### useMemo vs useState for Dynamic Values

```typescript
// WRONG: Cached once, never updates when server assigns ID
const reconnectId = useMemo(() => localStorage.getItem(key), [key]);

// RIGHT: State that triggers re-render when updated
const [reconnectId, setReconnectId] = useState(() => localStorage.getItem(key));
// Later: setReconnectId(newId) causes roomPath to recalculate
```

#### Synced State Initialization

```typescript
// WRONG: Defaults overwrite server state on mount
const [config, setConfig] = useState({ difficulty: 'EASY' });
useEffect(() => {
  if (isHost) sendConfig(config);  // Pushes local before receiving server!
}, [isHost]);

// RIGHT: Initialize unknown, sync FROM server first
const [config, setConfig] = useState(null);
const [synced, setSynced] = useState(false);
useEffect(() => {
  if (serverConfig && !synced) {
    setConfig(serverConfig);
    setSynced(true);
  }
}, [serverConfig, synced]);
```

#### Timer Cleanup in Server Code

```typescript
// WRONG: Timer fires even after state change
setTimeout(() => this.startGame(), 5000);  // No handle, no guards

// RIGHT: Store handle, add guards, cancel explicitly
this.timerId = setTimeout(() => {
  if (this.phase !== RoomPhase.COUNTDOWN) return;  // Guard
  if (this.players.size < 2) return;  // Guard
  this.startGame();
}, 5000);

// In cleanup: clearTimeout(this.timerId);
```

---

**See Also:** [LESSONS-LEARNED-MULTIPLAYER.md](./LESSONS-LEARNED-MULTIPLAYER.md) for the full post-mortem of all bugs discovered during implementation and verification, including:
- 12 initial bugs across race conditions, state sync, reconnection, and arbitration
- Test infrastructure fixes (message queue duplication, helper drift)
- PartyKit local dev workaround (`--disable-request-cf-fetch`)
- 5 deep code review bugs that passed tests but would fail in production (React closures, timer cleanup, config sync)
