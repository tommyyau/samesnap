# SameSnap Multiplayer Implementation Plan

This document provides a complete implementation guide for converting SameSnap into a multiplayer online game. Hand this to Claude Code web agents to build.

---

## Project Context

**Current State**: Single-player React game where human plays against bots
**Goal**: Add multiplayer mode where 2-8 humans play via shared room codes (like Jackbox)
**Keep**: Single-player mode remains as separate option

**Tech Stack**:
- Frontend: React 19 + TypeScript + Vite (deployed on Vercel)
- Real-time Backend: PartyKit (free tier, runs on Cloudflare Edge)
- Room System: 4-character alphanumeric codes

---

## Task 1: Install Dependencies & Setup PartyKit

### 1.1 Install packages
```bash
npm install partysocket
npm install -D partykit concurrently
```

### 1.2 Create `partykit.json` in project root
```json
{
  "name": "samesnap",
  "main": "party/index.ts",
  "compatibilityDate": "2024-01-01"
}
```

### 1.3 Update `package.json` scripts
```json
{
  "scripts": {
    "dev": "vite",
    "dev:party": "partykit dev",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:party\"",
    "build": "vite build",
    "preview": "vite preview",
    "deploy:party": "partykit deploy"
  }
}
```

### 1.4 Create `.env.local` (add to .gitignore if not already)
```
VITE_PARTYKIT_HOST=localhost:1999
```

### 1.5 Update `vite.config.ts` to include PartyKit host
Add to the `define` object:
```typescript
'process.env.PARTYKIT_HOST': JSON.stringify(env.VITE_PARTYKIT_HOST || 'localhost:1999')
```

---

## Task 2: Create Shared Types & Protocol

### 2.1 Create `shared/types.ts`

```typescript
// ============================================
// SHARED TYPES (used by both client and server)
// ============================================

// Re-export existing types
export interface SymbolItem {
  id: number;
  char: string;
  name: string;
}

export interface CardData {
  id: number;
  symbols: SymbolItem[];
}

export enum CardDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
}

// ============================================
// MULTIPLAYER TYPES
// ============================================

export enum RoomPhase {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  ROUND_END = 'round_end',
  GAME_OVER = 'game_over',
}

export enum PlayerStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  LEFT = 'left',
}

export interface ServerPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  score: number;
  handCardId: number | null;
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  score: number;
  hasCard: boolean;
  isHost: boolean;
  isYou: boolean;
}

export interface MatchAttempt {
  playerId: string;
  symbolId: number;
  clientTimestamp: number;
  serverTimestamp: number;
  isValid: boolean;
}

export interface MultiplayerGameConfig {
  cardDifficulty: CardDifficulty;
  maxPlayers: number;
}

export interface ClientRoomState {
  roomCode: string;
  phase: RoomPhase;
  players: ClientPlayer[];
  config: MultiplayerGameConfig | null;
  deckRemaining: number;
  centerCard: CardData | null;
  yourCard: CardData | null;
  roundWinnerId: string | null;
  roundWinnerName: string | null;
  roundMatchedSymbolId: number | null;
  roundNumber: number;
  countdown?: number;
  penaltyUntil?: number;
}

// Single-player types (keep existing)
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum GameState {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  ROUND_ANIMATION = 'ROUND_ANIMATION',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  hand: CardData | null;
  collectedCards: number;
}

export interface GameConfig {
  playerName: string;
  botCount: number;
  difficulty: Difficulty;
  cardDifficulty: CardDifficulty;
}
```

### 2.2 Create `shared/protocol.ts`

```typescript
import { CardData, ClientRoomState, MultiplayerGameConfig, ClientPlayer } from './types';

// ============================================
// CLIENT -> SERVER MESSAGES
// ============================================

export type ClientMessage =
  | { type: 'join'; payload: { playerName: string } }
  | { type: 'start_game'; payload: { config: MultiplayerGameConfig } }
  | { type: 'match_attempt'; payload: { symbolId: number; clientTimestamp: number } }
  | { type: 'leave'; payload: {} }
  | { type: 'kick_player'; payload: { playerId: string } }
  | { type: 'ping'; payload: { timestamp: number } };

// ============================================
// SERVER -> CLIENT MESSAGES
// ============================================

export type ServerMessage =
  | { type: 'room_state'; payload: ClientRoomState }
  | { type: 'player_joined'; payload: { player: ClientPlayer } }
  | { type: 'player_left'; payload: { playerId: string; playerName: string } }
  | { type: 'player_disconnected'; payload: { playerId: string } }
  | { type: 'player_reconnected'; payload: { playerId: string } }
  | { type: 'countdown'; payload: { seconds: number } }
  | { type: 'round_start'; payload: { centerCard: CardData; yourCard: CardData; roundNumber: number } }
  | { type: 'round_winner'; payload: { winnerId: string; winnerName: string; matchedSymbolId: number } }
  | { type: 'game_over'; payload: { finalScores: { playerId: string; name: string; score: number }[] } }
  | { type: 'match_result'; payload: { success: boolean; reason?: string } }
  | { type: 'penalty'; payload: { until: number; reason: string } }
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong'; payload: { serverTimestamp: number; clientTimestamp: number } }
  | { type: 'you_are_host'; payload: {} };

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  ROOM_FULL: 'ROOM_FULL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  NOT_HOST: 'NOT_HOST',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_MATCH: 'INVALID_MATCH',
  IN_PENALTY: 'IN_PENALTY',
  NAME_TAKEN: 'NAME_TAKEN',
} as const;
```

### 2.3 Create `shared/gameLogic.ts`

Copy the contents of `utils/gameLogic.ts` but update imports:
```typescript
import { CardData, SymbolItem } from './types';

// Copy SYMBOLS array here or import from a shared constants file
export const EMOJIS: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦟', '🦗', '🕷', '🕸', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓'
];

export const SYMBOLS: SymbolItem[] = EMOJIS.map((char, index) => ({
  id: index,
  char,
  name: `Symbol ${index}`
}));

// Keep all existing functions: generateDeck, shuffle, checkMatch, findMatch
// ... (copy from utils/gameLogic.ts)
```

---

## Task 3: Create PartyKit Server

### 3.1 Create `party/index.ts`

```typescript
import type * as Party from "partykit/server";
import {
  RoomPhase, PlayerStatus, ServerPlayer, ClientPlayer,
  ClientRoomState, CardData, MultiplayerGameConfig, MatchAttempt
} from "../shared/types";
import { ClientMessage, ServerMessage, ERROR_CODES } from "../shared/protocol";
import { generateDeck, findMatch, SYMBOLS } from "../shared/gameLogic";

const PENALTY_DURATION = 3000;
const ARBITRATION_WINDOW_MS = 100;
const RECONNECT_GRACE_PERIOD = 60000;
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export default class SameSnapRoom implements Party.Server {
  private phase: RoomPhase = RoomPhase.WAITING;
  private players: Map<string, ServerPlayer> = new Map();
  private hostId: string | null = null;
  private deck: CardData[] = [];
  private fullDeck: CardData[] = [];
  private centerCard: CardData | null = null;
  private config: MultiplayerGameConfig | null = null;
  private roundNumber: number = 0;
  private roundWinnerId: string | null = null;
  private roundMatchedSymbolId: number | null = null;
  private penalties: Map<string, number> = new Map();
  private pendingArbitration: {
    roundNumber: number;
    windowStart: number;
    attempts: MatchAttempt[];
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null = null;
  private disconnectedPlayers: Map<string, { player: ServerPlayer; disconnectedAt: number }> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Check for reconnection
    const url = new URL(ctx.request.url);
    const reconnectId = url.searchParams.get('reconnectId');

    if (reconnectId && this.disconnectedPlayers.has(reconnectId)) {
      this.handleReconnection(conn, reconnectId);
      return;
    }
    // New connection - wait for join message
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (!player) return;

    if (this.phase === RoomPhase.WAITING) {
      this.removePlayer(conn.id);
    } else {
      // During game - mark disconnected
      player.status = PlayerStatus.DISCONNECTED;
      this.disconnectedPlayers.set(conn.id, { player, disconnectedAt: Date.now() });
      this.broadcastToAll({ type: 'player_disconnected', payload: { playerId: conn.id } });

      setTimeout(() => {
        if (this.disconnectedPlayers.has(conn.id)) {
          this.removePlayer(conn.id);
        }
      }, RECONNECT_GRACE_PERIOD);
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: ClientMessage = JSON.parse(message);

      switch (msg.type) {
        case 'join':
          this.handleJoin(sender, msg.payload.playerName);
          break;
        case 'start_game':
          this.handleStartGame(sender, msg.payload.config);
          break;
        case 'match_attempt':
          this.handleMatchAttempt(sender.id, msg.payload.symbolId, msg.payload.clientTimestamp);
          break;
        case 'leave':
          this.removePlayer(sender.id);
          break;
        case 'kick_player':
          this.handleKickPlayer(sender.id, msg.payload.playerId);
          break;
        case 'ping':
          this.sendToPlayer(sender.id, {
            type: 'pong',
            payload: { serverTimestamp: Date.now(), clientTimestamp: msg.payload.timestamp }
          });
          break;
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  private handleJoin(conn: Party.Connection, playerName: string) {
    // Check if room is full (max 8)
    if (this.players.size >= 8) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.ROOM_FULL, message: 'Room is full' }
      });
      return;
    }

    // Check if game in progress
    if (this.phase !== RoomPhase.WAITING) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.GAME_IN_PROGRESS, message: 'Game already in progress' }
      });
      return;
    }

    // Check for duplicate names
    const nameTaken = Array.from(this.players.values()).some(p => p.name === playerName);
    const finalName = nameTaken ? `${playerName} ${this.players.size + 1}` : playerName;

    const isHost = this.players.size === 0;
    const player: ServerPlayer = {
      id: conn.id,
      name: finalName,
      status: PlayerStatus.CONNECTED,
      score: 0,
      handCardId: null,
      isHost,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    this.players.set(conn.id, player);
    if (isHost) {
      this.hostId = conn.id;
      this.sendToPlayer(conn.id, { type: 'you_are_host', payload: {} });
    }

    // Broadcast to others
    this.broadcastToAll({
      type: 'player_joined',
      payload: { player: this.toClientPlayer(player, conn.id) }
    });

    // Send full state to new player
    this.sendRoomState(conn.id);
  }

  private handleStartGame(conn: Party.Connection, config: MultiplayerGameConfig) {
    const player = this.players.get(conn.id);
    if (!player?.isHost) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.NOT_HOST, message: 'Only host can start' }
      });
      return;
    }

    if (this.players.size < 2) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Need at least 2 players' }
      });
      return;
    }

    this.config = config;
    this.startCountdown();
  }

  private startCountdown() {
    this.phase = RoomPhase.COUNTDOWN;
    let count = 3;

    const tick = () => {
      this.broadcastToAll({ type: 'countdown', payload: { seconds: count } });
      if (count > 0) {
        count--;
        setTimeout(tick, 1000);
      } else {
        this.startGame();
      }
    };
    tick();
  }

  private startGame() {
    this.fullDeck = generateDeck();
    this.deck = [...this.fullDeck];
    this.roundNumber = 0;
    this.penalties.clear();

    // Deal cards to players
    this.players.forEach(player => {
      const card = this.deck.pop();
      if (card) player.handCardId = card.id;
      player.score = 0;
    });

    // Set center card
    this.centerCard = this.deck.pop() || null;
    this.phase = RoomPhase.PLAYING;
    this.roundNumber = 1;

    // Send round_start to each player with their personal card
    this.players.forEach((player, playerId) => {
      const yourCard = this.getCardById(player.handCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: { centerCard: this.centerCard, yourCard, roundNumber: this.roundNumber }
        });
      }
    });
  }

  private handleMatchAttempt(playerId: string, symbolId: number, clientTimestamp: number) {
    const serverTimestamp = Date.now();

    if (this.phase !== RoomPhase.PLAYING) return;

    const player = this.players.get(playerId);
    if (!player || player.handCardId === null) return;

    // Check penalty
    const penaltyUntil = this.penalties.get(playerId);
    if (penaltyUntil && serverTimestamp < penaltyUntil) {
      this.sendToPlayer(playerId, {
        type: 'error',
        payload: { code: ERROR_CODES.IN_PENALTY, message: 'Wait for penalty' }
      });
      return;
    }

    // Validate match
    const playerCard = this.getCardById(player.handCardId);
    if (!playerCard || !this.centerCard) return;

    const inPlayerHand = playerCard.symbols.some(s => s.id === symbolId);
    const inCenter = this.centerCard.symbols.some(s => s.id === symbolId);
    const isValid = inPlayerHand && inCenter;

    if (!isValid) {
      const until = serverTimestamp + PENALTY_DURATION;
      this.penalties.set(playerId, until);
      this.sendToPlayer(playerId, {
        type: 'penalty',
        payload: { until, reason: 'Wrong symbol' }
      });
      return;
    }

    // Valid match - add to arbitration
    const attempt: MatchAttempt = { playerId, symbolId, clientTimestamp, serverTimestamp, isValid: true };

    if (!this.pendingArbitration) {
      this.pendingArbitration = {
        roundNumber: this.roundNumber,
        windowStart: serverTimestamp,
        attempts: [attempt],
        timeoutId: setTimeout(() => this.resolveArbitration(), ARBITRATION_WINDOW_MS)
      };
    } else if (this.pendingArbitration.roundNumber === this.roundNumber) {
      this.pendingArbitration.attempts.push(attempt);
    }
  }

  private resolveArbitration() {
    if (!this.pendingArbitration) return;

    const { attempts } = this.pendingArbitration;
    this.pendingArbitration = null;

    if (attempts.length === 0) return;

    // Sort: server timestamp, then client timestamp, then random
    attempts.sort((a, b) => {
      const serverDiff = a.serverTimestamp - b.serverTimestamp;
      if (serverDiff !== 0) return serverDiff;
      const clientDiff = a.clientTimestamp - b.clientTimestamp;
      if (clientDiff !== 0) return clientDiff;
      return Math.random() - 0.5;
    });

    const winner = attempts[0];
    this.processRoundWin(winner.playerId, winner.symbolId);
  }

  private processRoundWin(winnerId: string, symbolId: number) {
    const winner = this.players.get(winnerId);
    if (!winner) return;

    this.phase = RoomPhase.ROUND_END;
    this.roundWinnerId = winnerId;
    this.roundMatchedSymbolId = symbolId;
    winner.score += 1;

    // Broadcast winner
    this.broadcastToAll({
      type: 'round_winner',
      payload: { winnerId, winnerName: winner.name, matchedSymbolId: symbolId }
    });

    // After 2 seconds, next round
    setTimeout(() => this.nextRound(winnerId), 2000);
  }

  private nextRound(lastWinnerId: string) {
    const winner = this.players.get(lastWinnerId);
    if (!winner || !this.centerCard) return;

    // Winner's hand becomes the old center card
    const oldCenterId = this.centerCard.id;

    // Draw new center
    if (this.deck.length === 0) {
      this.endGame();
      return;
    }

    winner.handCardId = oldCenterId;
    this.centerCard = this.deck.pop() || null;
    this.roundNumber++;
    this.phase = RoomPhase.PLAYING;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;

    // Send new round to each player
    this.players.forEach((player, playerId) => {
      const yourCard = this.getCardById(player.handCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: { centerCard: this.centerCard, yourCard, roundNumber: this.roundNumber }
        });
      }
    });
  }

  private endGame() {
    this.phase = RoomPhase.GAME_OVER;
    const finalScores = Array.from(this.players.values())
      .map(p => ({ playerId: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    this.broadcastToAll({ type: 'game_over', payload: { finalScores } });
  }

  private handleKickPlayer(hostId: string, targetId: string) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return;
    this.removePlayer(targetId);
  }

  private removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.disconnectedPlayers.delete(playerId);

    this.broadcastToAll({
      type: 'player_left',
      payload: { playerId, playerName: player.name }
    });

    // Reassign host if needed
    if (player.isHost && this.players.size > 0) {
      const newHost = Array.from(this.players.values())[0];
      newHost.isHost = true;
      this.hostId = newHost.id;
      this.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
    }

    // Check if game should end
    if (this.phase !== RoomPhase.WAITING && this.players.size < 2) {
      this.endGame();
    }
  }

  private handleReconnection(conn: Party.Connection, oldId: string) {
    const data = this.disconnectedPlayers.get(oldId);
    if (!data) return;

    this.disconnectedPlayers.delete(oldId);
    const player = { ...data.player, id: conn.id, status: PlayerStatus.CONNECTED };
    this.players.delete(oldId);
    this.players.set(conn.id, player);

    if (player.isHost) this.hostId = conn.id;

    this.broadcastToAll({ type: 'player_reconnected', payload: { playerId: conn.id } });
    this.sendRoomState(conn.id);
  }

  private getCardById(cardId: number | null): CardData | null {
    if (cardId === null) return null;
    return this.fullDeck.find(c => c.id === cardId) || null;
  }

  private toClientPlayer(player: ServerPlayer, forPlayerId: string): ClientPlayer {
    return {
      id: player.id,
      name: player.name,
      status: player.status,
      score: player.score,
      hasCard: player.handCardId !== null,
      isHost: player.isHost,
      isYou: player.id === forPlayerId,
    };
  }

  private sendRoomState(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    const state: ClientRoomState = {
      roomCode: this.room.id,
      phase: this.phase,
      players: Array.from(this.players.values()).map(p => this.toClientPlayer(p, playerId)),
      config: this.config,
      deckRemaining: this.deck.length,
      centerCard: this.centerCard,
      yourCard: this.getCardById(player.handCardId),
      roundWinnerId: this.roundWinnerId,
      roundWinnerName: this.roundWinnerId ? this.players.get(this.roundWinnerId)?.name || null : null,
      roundMatchedSymbolId: this.roundMatchedSymbolId,
      roundNumber: this.roundNumber,
      penaltyUntil: this.penalties.get(playerId),
    };

    this.sendToPlayer(playerId, { type: 'room_state', payload: state });
  }

  private sendToPlayer(playerId: string, message: ServerMessage) {
    const conn = this.room.getConnection(playerId);
    if (conn) conn.send(JSON.stringify(message));
  }

  private broadcastToAll(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}
```

---

## Task 4: Create Multiplayer Hook

### 4.1 Create `hooks/useMultiplayerGame.ts`

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import usePartySocket from 'partysocket/react';
import { ClientRoomState, RoomPhase, MultiplayerGameConfig } from '../shared/types';
import { ClientMessage, ServerMessage } from '../shared/protocol';

interface UseMultiplayerGameOptions {
  roomCode: string;
  playerName: string;
  onError?: (error: { code: string; message: string }) => void;
  onKicked?: () => void;
}

export function useMultiplayerGame({ roomCode, playerName, onError, onKicked }: UseMultiplayerGameOptions) {
  const [roomState, setRoomState] = useState<ClientRoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const pingInterval = useRef<ReturnType<typeof setInterval>>();
  const reconnectData = useRef<{ roomCode: string; playerId: string } | null>(null);

  const socket = usePartySocket({
    host: import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999',
    room: roomCode,
    query: reconnectData.current ? { reconnectId: reconnectData.current.playerId } : undefined,
    onOpen: () => {
      setIsConnected(true);
      sendMessage({ type: 'join', payload: { playerName } });
      pingInterval.current = setInterval(() => {
        sendMessage({ type: 'ping', payload: { timestamp: Date.now() } });
      }, 5000);
    },
    onClose: () => {
      setIsConnected(false);
      if (pingInterval.current) clearInterval(pingInterval.current);
    },
    onMessage: (event) => {
      const message: ServerMessage = JSON.parse(event.data);
      handleServerMessage(message);
    },
  });

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }, [socket]);

  const handleServerMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'room_state':
        setRoomState(message.payload);
        // Store reconnect data
        const me = message.payload.players.find(p => p.isYou);
        if (me) {
          reconnectData.current = { roomCode, playerId: me.id };
        }
        break;

      case 'you_are_host':
        setIsHost(true);
        break;

      case 'player_joined':
        setRoomState(prev => prev ? {
          ...prev,
          players: [...prev.players.filter(p => p.id !== message.payload.player.id), message.payload.player]
        } : null);
        break;

      case 'player_left':
        if (roomState?.players.find(p => p.isYou)?.id === message.payload.playerId) {
          onKicked?.();
        }
        setRoomState(prev => prev ? {
          ...prev,
          players: prev.players.filter(p => p.id !== message.payload.playerId)
        } : null);
        break;

      case 'countdown':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.COUNTDOWN,
          countdown: message.payload.seconds
        } : null);
        break;

      case 'round_start':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.PLAYING,
          centerCard: message.payload.centerCard,
          yourCard: message.payload.yourCard,
          roundNumber: message.payload.roundNumber,
          roundWinnerId: null,
          roundMatchedSymbolId: null,
        } : null);
        break;

      case 'round_winner':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.ROUND_END,
          roundWinnerId: message.payload.winnerId,
          roundWinnerName: message.payload.winnerName,
          roundMatchedSymbolId: message.payload.matchedSymbolId,
          players: prev.players.map(p =>
            p.id === message.payload.winnerId ? { ...p, score: p.score + 1 } : p
          )
        } : null);
        break;

      case 'penalty':
        setRoomState(prev => prev ? {
          ...prev,
          penaltyUntil: message.payload.until
        } : null);
        break;

      case 'game_over':
        setRoomState(prev => prev ? {
          ...prev,
          phase: RoomPhase.GAME_OVER,
          players: message.payload.finalScores.map(s => ({
            ...prev.players.find(p => p.id === s.playerId)!,
            score: s.score
          }))
        } : null);
        break;

      case 'pong':
        setLatency(Date.now() - message.payload.clientTimestamp);
        break;

      case 'error':
        onError?.(message.payload);
        break;
    }
  }, [roomCode, roomState, onError, onKicked]);

  const attemptMatch = useCallback((symbolId: number) => {
    sendMessage({
      type: 'match_attempt',
      payload: { symbolId, clientTimestamp: Date.now() }
    });
  }, [sendMessage]);

  const startGame = useCallback((config: MultiplayerGameConfig) => {
    sendMessage({ type: 'start_game', payload: { config } });
  }, [sendMessage]);

  const leaveRoom = useCallback(() => {
    sendMessage({ type: 'leave', payload: {} });
    socket.close();
  }, [sendMessage, socket]);

  const kickPlayer = useCallback((playerId: string) => {
    sendMessage({ type: 'kick_player', payload: { playerId } });
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current);
    };
  }, []);

  return {
    roomState,
    isConnected,
    isHost,
    latency,
    attemptMatch,
    startGame,
    leaveRoom,
    kickPlayer,
  };
}

// Room code utilities
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

---

## Task 5: Create Lobby Components

### 5.1 Create `components/lobby/MainMenu.tsx`

```typescript
import React, { useState } from 'react';
import { Users, User, ArrowRight } from 'lucide-react';

interface MainMenuProps {
  onSinglePlayer: () => void;
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ onSinglePlayer, onCreateRoom, onJoinRoom }) => {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreate = () => {
    if (playerName.trim()) {
      onCreateRoom(playerName.trim());
    }
  };

  const handleJoin = () => {
    if (playerName.trim() && roomCode.trim().length === 4) {
      onJoinRoom(roomCode.trim().toUpperCase(), playerName.trim());
    }
  };

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
            SameSnap
          </h1>
          <p className="text-gray-500 mb-8">Spot the match. Be the fastest.</p>

          <div className="space-y-4">
            <button
              onClick={onSinglePlayer}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <User size={24} /> Play Solo vs Bots
            </button>

            <button
              onClick={() => setMode('create')}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <Users size={24} /> Create Multiplayer Room
            </button>

            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all"
            >
              <ArrowRight size={24} /> Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
        <button onClick={() => setMode('menu')} className="text-gray-500 mb-4">&larr; Back</button>

        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {mode === 'create' ? 'Create Room' : 'Join Room'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none font-semibold"
              placeholder="Enter your name"
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none font-semibold text-center text-2xl tracking-widest"
                placeholder="ABCD"
                maxLength={4}
              />
            </div>
          )}

          <button
            onClick={mode === 'create' ? handleCreate : handleJoin}
            disabled={!playerName.trim() || (mode === 'join' && roomCode.length !== 4)}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-yellow-900 disabled:text-gray-500 rounded-2xl text-xl font-black transition-all"
          >
            {mode === 'create' ? 'Create Room' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
```

### 5.2 Create `components/lobby/WaitingRoom.tsx`

```typescript
import React, { useState } from 'react';
import { Copy, Check, Crown, Wifi, WifiOff, Play, LogOut } from 'lucide-react';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { CardDifficulty, RoomPhase } from '../../shared/types';

interface WaitingRoomProps {
  roomCode: string;
  playerName: string;
  onLeave: () => void;
  onGameStart: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomCode, playerName, onLeave, onGameStart }) => {
  const [copied, setCopied] = useState(false);
  const [cardDifficulty, setCardDifficulty] = useState<CardDifficulty>(CardDifficulty.EASY);

  const { roomState, isConnected, isHost, latency, startGame, leaveRoom } = useMultiplayerGame({
    roomCode,
    playerName,
    onError: (err) => console.error(err),
    onKicked: onLeave,
  });

  // Redirect to game when it starts
  React.useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING || roomState?.phase === RoomPhase.COUNTDOWN) {
      onGameStart();
    }
  }, [roomState?.phase, onGameStart]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartGame = () => {
    startGame({ cardDifficulty, maxPlayers: 8 });
  };

  const handleLeave = () => {
    leaveRoom();
    onLeave();
  };

  const canStart = isHost && (roomState?.players.length || 0) >= 2;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
        {/* Connection Status */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-2 text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? `Connected (${latency}ms)` : 'Disconnected'}
          </div>
        </div>

        {/* Room Code */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-sm mb-1">ROOM CODE</p>
          <div
            onClick={copyRoomCode}
            className="text-5xl font-black tracking-widest text-indigo-600 cursor-pointer hover:text-indigo-500 flex items-center justify-center gap-2"
          >
            {roomCode}
            {copied ? <Check size={24} className="text-green-500" /> : <Copy size={24} />}
          </div>
          <p className="text-gray-400 text-xs mt-1">Click to copy</p>
        </div>

        {/* Players List */}
        <div className="mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">
            Players ({roomState?.players.length || 0}/8)
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {roomState?.players.map((player) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-xl ${
                  player.isYou ? 'bg-indigo-100 border-2 border-indigo-300' : 'bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {player.isHost && <Crown size={16} className="text-yellow-500" />}
                  <span className="font-semibold">{player.name}</span>
                  {player.isYou && <span className="text-xs text-indigo-500">(You)</span>}
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  player.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
            ))}
          </div>
        </div>

        {/* Game Settings (Host Only) */}
        {isHost && (
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-2">Card Layout</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCardDifficulty(CardDifficulty.EASY)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardDifficulty === CardDifficulty.EASY
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Easy (Orderly)
              </button>
              <button
                onClick={() => setCardDifficulty(CardDifficulty.MEDIUM)}
                className={`py-2 rounded-xl text-sm font-bold transition-all ${
                  cardDifficulty === CardDifficulty.MEDIUM
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Medium (Chaotic)
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-300 text-yellow-900 disabled:text-gray-500 rounded-2xl text-xl font-black flex items-center justify-center gap-2 transition-all"
            >
              <Play size={24} />
              {canStart ? 'Start Game' : 'Need 2+ Players'}
            </button>
          ) : (
            <div className="text-center py-4 bg-gray-100 rounded-2xl text-gray-500 font-semibold">
              Waiting for host to start...
            </div>
          )}

          <button
            onClick={handleLeave}
            className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            <LogOut size={20} /> Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;
```

---

## Task 6: Create Multiplayer Game Component

### 6.1 Create `components/game/MultiplayerGame.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useMultiplayerGame } from '../../hooks/useMultiplayerGame';
import { RoomPhase, SymbolItem, CardDifficulty } from '../../shared/types';
import { playMatchSound, playErrorSound, startBackgroundMusic, stopBackgroundMusic } from '../../utils/sound';
import Card from '../Card';
import { Trophy, XCircle, Zap, User, Wifi } from 'lucide-react';

interface MultiplayerGameProps {
  roomCode: string;
  playerName: string;
  onExit: () => void;
}

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ roomCode, playerName, onExit }) => {
  const { roomState, isConnected, latency, attemptMatch, leaveRoom } = useMultiplayerGame({
    roomCode,
    playerName,
    onError: (err) => console.error(err),
    onKicked: onExit,
  });

  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState(0);

  // Start/stop background music
  useEffect(() => {
    if (roomState?.phase === RoomPhase.PLAYING) {
      startBackgroundMusic();
    }
    return () => stopBackgroundMusic();
  }, [roomState?.phase]);

  // Play sounds on round winner
  useEffect(() => {
    if (roomState?.phase === RoomPhase.ROUND_END && roomState.roundWinnerId) {
      const isYouWinner = roomState.players.find(p => p.isYou)?.id === roomState.roundWinnerId;
      playMatchSound(-1, isYouWinner);
    }
  }, [roomState?.phase, roomState?.roundWinnerId]);

  // Penalty countdown
  useEffect(() => {
    if (roomState?.penaltyUntil && roomState.penaltyUntil > Date.now()) {
      playErrorSound();
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((roomState.penaltyUntil! - Date.now()) / 1000));
        setPenaltyTimeLeft(left);
        if (left <= 0) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPenaltyTimeLeft(0);
    }
  }, [roomState?.penaltyUntil]);

  const handleSymbolClick = (symbol: SymbolItem) => {
    if (roomState?.phase !== RoomPhase.PLAYING) return;
    if (roomState.penaltyUntil && Date.now() < roomState.penaltyUntil) return;
    attemptMatch(symbol.id);
  };

  const handleExit = () => {
    stopBackgroundMusic();
    leaveRoom();
    onExit();
  };

  if (!roomState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-xl font-bold text-gray-500">Connecting...</div>
      </div>
    );
  }

  // Countdown screen
  if (roomState.phase === RoomPhase.COUNTDOWN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white">
        <div className="text-9xl font-black animate-pulse">{roomState.countdown}</div>
        <div className="text-2xl mt-4">Get Ready!</div>
      </div>
    );
  }

  // Game Over screen
  if (roomState.phase === RoomPhase.GAME_OVER) {
    const sortedPlayers = [...roomState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const isYouWinner = winner?.isYou;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-indigo-900 text-white p-4">
        <div className="bg-white text-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full text-center">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${isYouWinner ? 'text-yellow-400' : 'text-gray-400'}`} />
          <h2 className="text-4xl font-bold mb-2">{isYouWinner ? 'You Won!' : `${winner?.name} Wins!`}</h2>
          <p className="text-gray-500 mb-6">Final Scores</p>

          <div className="space-y-3 mb-8">
            {sortedPlayers.map((p, idx) => (
              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl font-bold ${p.isYou ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-6">#{idx + 1}</span>
                  <span>{p.name}</span>
                  {p.isYou && <span className="text-xs text-indigo-500">(You)</span>}
                </div>
                <span className="text-indigo-600">{p.score} cards</span>
              </div>
            ))}
          </div>

          <button onClick={handleExit} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const you = roomState.players.find(p => p.isYou);
  const opponents = roomState.players.filter(p => !p.isYou);
  const isPenaltyActive = penaltyTimeLeft > 0;
  const isAnimating = roomState.phase === RoomPhase.ROUND_END;
  const cardSize = window.innerWidth < 768 ? 200 : 320;

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white shadow-sm p-2 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <button onClick={handleExit} className="text-slate-500 hover:text-red-600 font-bold text-sm px-3 py-1 rounded hover:bg-slate-100">
            EXIT
          </button>
          <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-lg">
            <span className="text-xs text-gray-500 uppercase font-bold">Cards Left</span>
            <span className="font-bold text-indigo-700">{roomState.deckRemaining}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Wifi size={12} /> {latency}ms
          </div>
        </div>

        {/* Round Winner Message */}
        {isAnimating && roomState.roundWinnerName && (
          <div className="font-bold text-lg text-green-600 animate-pulse">
            {roomState.roundWinnerName} found the match!
          </div>
        )}

        <div className={`px-3 py-1 rounded-lg flex items-center gap-2 ${isPenaltyActive ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
          {isPenaltyActive ? <XCircle size={16}/> : <Zap size={16}/>}
          <span className="font-bold text-sm">{isPenaltyActive ? `WAIT ${penaltyTimeLeft}s` : 'READY'}</span>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4">

        {/* Opponents (Top) */}
        <div className="flex gap-4 mb-4 overflow-x-auto w-full justify-center py-2">
          {opponents.map(player => (
            <div key={player.id} className={`flex flex-col items-center transition-all ${roomState.roundWinnerId === player.id ? 'scale-110' : 'opacity-80'}`}>
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500 border-4 border-white shadow">
                {player.name[0].toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
                {player.score}
              </div>
              <span className="text-xs font-bold mt-1 text-gray-500">{player.name}</span>
              {roomState.roundWinnerId === player.id && <div className="text-xs text-green-600 font-bold">Got it!</div>}
            </div>
          ))}
        </div>

        {/* Center Arena */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">

          {/* Your Card */}
          <div className="relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-indigo-600 font-bold tracking-widest text-sm uppercase flex items-center gap-1">
              <User size={14}/> {you?.name || 'You'}
            </div>
            {roomState.yourCard && (
              <Card
                card={roomState.yourCard}
                size={cardSize}
                layoutMode={roomState.config?.cardDifficulty || CardDifficulty.EASY}
                onClickSymbol={handleSymbolClick}
                disabled={isPenaltyActive || isAnimating}
                highlightError={isPenaltyActive}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                className="border-indigo-500 bg-indigo-50 shadow-indigo-200"
                interactive={true}
              />
            )}
            {isPenaltyActive && (
              <div className="absolute inset-0 bg-red-500/20 rounded-full z-20 flex items-center justify-center backdrop-blur-[2px] animate-pulse pointer-events-none">
                <XCircle className="text-red-600 w-16 h-16" />
              </div>
            )}
            <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white text-lg font-bold w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
              {you?.score || 0}
            </div>
          </div>

          {/* Center Card */}
          <div className="relative">
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-gray-400 font-bold tracking-widest text-sm uppercase">
              Center
            </div>
            {roomState.centerCard && (
              <Card
                card={roomState.centerCard}
                size={cardSize}
                layoutMode={roomState.config?.cardDifficulty || CardDifficulty.EASY}
                highlightSymbolId={isAnimating ? roomState.roundMatchedSymbolId : null}
                disabled={true}
                interactive={false}
              />
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-500 text-sm hidden md:block">
          Find the ONE symbol that matches between CENTER and YOUR card. Click it on YOUR card!
        </div>
      </div>
    </div>
  );
};

export default MultiplayerGame;
```

---

## Task 7: Update App.tsx for Routing

### 7.1 Replace `App.tsx` content

```typescript
import React, { useState } from 'react';
import MainMenu from './components/lobby/MainMenu';
import SinglePlayerLobby from './components/lobby/SinglePlayerLobby';
import SinglePlayerGame from './components/game/SinglePlayerGame';
import WaitingRoom from './components/lobby/WaitingRoom';
import MultiplayerGame from './components/game/MultiplayerGame';
import { GameConfig } from './shared/types';
import { generateRoomCode } from './hooks/useMultiplayerGame';

enum AppMode {
  MENU = 'menu',
  SINGLE_PLAYER_LOBBY = 'sp_lobby',
  SINGLE_PLAYER_GAME = 'sp_game',
  MULTIPLAYER_WAITING = 'mp_waiting',
  MULTIPLAYER_GAME = 'mp_game',
}

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.MENU);
  const [singlePlayerConfig, setSinglePlayerConfig] = useState<GameConfig | null>(null);
  const [multiplayerContext, setMultiplayerContext] = useState<{
    roomCode: string;
    playerName: string;
  } | null>(null);

  const handleSinglePlayer = () => {
    setMode(AppMode.SINGLE_PLAYER_LOBBY);
  };

  const handleCreateRoom = (playerName: string) => {
    const roomCode = generateRoomCode();
    setMultiplayerContext({ roomCode, playerName });
    setMode(AppMode.MULTIPLAYER_WAITING);
  };

  const handleJoinRoom = (roomCode: string, playerName: string) => {
    setMultiplayerContext({ roomCode, playerName });
    setMode(AppMode.MULTIPLAYER_WAITING);
  };

  const handleStartSinglePlayer = (config: GameConfig) => {
    setSinglePlayerConfig(config);
    setMode(AppMode.SINGLE_PLAYER_GAME);
  };

  const handleBackToMenu = () => {
    setMode(AppMode.MENU);
    setSinglePlayerConfig(null);
    setMultiplayerContext(null);
  };

  const handleMultiplayerGameStart = () => {
    setMode(AppMode.MULTIPLAYER_GAME);
  };

  return (
    <div className="min-h-screen">
      {mode === AppMode.MENU && (
        <MainMenu
          onSinglePlayer={handleSinglePlayer}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      )}

      {mode === AppMode.SINGLE_PLAYER_LOBBY && (
        <SinglePlayerLobby
          onStart={handleStartSinglePlayer}
          onBack={handleBackToMenu}
        />
      )}

      {mode === AppMode.SINGLE_PLAYER_GAME && singlePlayerConfig && (
        <SinglePlayerGame
          config={singlePlayerConfig}
          onExit={handleBackToMenu}
        />
      )}

      {mode === AppMode.MULTIPLAYER_WAITING && multiplayerContext && (
        <WaitingRoom
          roomCode={multiplayerContext.roomCode}
          playerName={multiplayerContext.playerName}
          onLeave={handleBackToMenu}
          onGameStart={handleMultiplayerGameStart}
        />
      )}

      {mode === AppMode.MULTIPLAYER_GAME && multiplayerContext && (
        <MultiplayerGame
          roomCode={multiplayerContext.roomCode}
          playerName={multiplayerContext.playerName}
          onExit={handleBackToMenu}
        />
      )}
    </div>
  );
}

export default App;
```

---

## Task 8: Rename Existing Files

1. Rename `components/Lobby.tsx` → `components/lobby/SinglePlayerLobby.tsx`
   - Add `onBack` prop for returning to main menu
   - Update imports

2. Rename `components/Game.tsx` → `components/game/SinglePlayerGame.tsx`
   - Update imports

3. Move `types.ts` → `shared/types.ts` (or keep both and have shared import from it)

4. Move `utils/gameLogic.ts` → `shared/gameLogic.ts`

---

## Task 9: Deployment

### 9.1 Deploy PartyKit
```bash
npx partykit deploy
```

This will give you a URL like: `samesnap.YOUR_USERNAME.partykit.dev`

### 9.2 Update Vercel Environment Variables
In Vercel dashboard, add:
```
VITE_PARTYKIT_HOST=samesnap.YOUR_USERNAME.partykit.dev
```

### 9.3 Deploy Frontend
```bash
npm run build
# Push to GitHub, Vercel auto-deploys
```

---

## Testing Checklist

- [ ] Single-player mode still works as before
- [ ] Can create a room and see room code
- [ ] Second player can join with room code
- [ ] Player list updates in real-time
- [ ] Host can start game with 2+ players
- [ ] Countdown displays correctly
- [ ] Cards are dealt and displayed
- [ ] Clicking correct symbol wins round
- [ ] Wrong click triggers 3s penalty
- [ ] Round winner shown, then next round starts
- [ ] Game ends when deck is empty
- [ ] Final scores shown correctly
- [ ] Can return to menu after game
- [ ] Reconnection works if player refreshes

---

## Summary

This plan adds multiplayer to SameSnap while keeping single-player intact. The key components are:

1. **PartyKit Server** (`party/index.ts`) - Handles rooms, game state, match arbitration
2. **Shared Types** (`shared/`) - Types and game logic used by both client and server
3. **Multiplayer Hook** (`hooks/useMultiplayerGame.ts`) - WebSocket connection and state
4. **New Components** - MainMenu, WaitingRoom, MultiplayerGame
5. **Updated App.tsx** - Routes between single/multiplayer modes

The server is authoritative for all game state. Clients send match attempts, server validates and broadcasts results. 100ms arbitration window handles near-simultaneous clicks fairly.
