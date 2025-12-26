// ============================================
// MULTIPLAYER TYPES
// ============================================

import { CardData, CardLayout, GameDuration } from './core';

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
  connectionId: string;
  name: string;
  status: PlayerStatus;
  cardStack: number[]; // Array of card IDs, top card at index 0
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  cardsRemaining: number; // Cards left in player's stack (0 = winner)
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

/** A player who almost won the round - made a valid match attempt shortly after the winner */
export interface SoCloseEntry {
  playerId: string;
  playerName: string;
  deltaMs: number;  // Time behind winner in milliseconds
}

export interface MultiplayerGameConfig {
  cardLayout: CardLayout;
  cardSetId: string;
  gameDuration: GameDuration;
  /** Custom symbols (57 emoji chars) - sent when using a custom card set */
  customSymbols?: string[];
  /** Custom set name - for display purposes */
  customSetName?: string;
}

export interface ClientRoomState {
  roomCode: string;
  phase: RoomPhase;
  players: ClientPlayer[];
  config: MultiplayerGameConfig | null;
  centerCard: CardData | null;
  yourCard: CardData | null;
  roundWinnerId: string | null;
  roundWinnerName: string | null;
  roundMatchedSymbolId: number | null;
  countdown?: number;
  penaltyUntil?: number; // Client-side computed: when penalty ends (local clock)
  penaltyRemainingMs?: number; // Server-sent: remaining penalty duration in ms (clock-skew safe)
  roomExpiresAt?: number; // DEPRECATED: Timestamp when room expires (use roomExpiresInMs)
  roomExpiresInMs?: number; // Duration until room expires in ms (clock-skew safe)
  gameEndReason?: 'stack_emptied' | 'last_player_standing'; // Why the game ended
  rejoinWindowEndsAt?: number; // Timestamp when rejoin window ends (10s after game_over)
  playersWantRematch?: string[]; // IDs of players who clicked "Play Again"
  soCloseEntries?: SoCloseEntry[]; // Players who almost won (for "So Close" leaderboard)
  showSoCloseLeaderboard?: boolean; // True when leaderboard should be displayed
}
