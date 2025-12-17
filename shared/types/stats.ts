// ============================================
// USER STATS TYPES
// ============================================

import { CardLayout } from './core';
import { Difficulty } from './singleplayer';

export type GameMode = 'singleplayer' | 'multiplayer';
export type WinReason = 'stack_emptied' | 'last_player_standing';

/** Stats for a single game mode (single-player or multiplayer) */
export interface ModeStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestStreak: number;
  fastestWinMs: number | null; // null if never won
}

/** User stats stored in Vercel KV at key stats:{userId} */
export interface UserStats {
  singlePlayer: ModeStats;
  multiplayer: ModeStats;
  lastActivityAt: number; // Unix timestamp (ms)
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
}

/** Game context recorded with each game result */
export interface GameContext {
  botDifficulty?: Difficulty; // Single-player only
  cardLayout: CardLayout;
  cardSetId: string;
  cardSetName: string;
  playerCount: number;
}

/** Payload sent to POST /api/stats to record a game result */
export interface RecordGamePayload {
  mode: GameMode;
  isWin: boolean;
  winReason?: WinReason;
  gameDurationMs: number;
  context: GameContext;
}

/** Default stats for new users */
export const DEFAULT_MODE_STATS: ModeStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  longestStreak: 0,
  fastestWinMs: null,
};

export const DEFAULT_USER_STATS: UserStats = {
  singlePlayer: { ...DEFAULT_MODE_STATS },
  multiplayer: { ...DEFAULT_MODE_STATS },
  lastActivityAt: 0,
  createdAt: 0,
  updatedAt: 0,
};
