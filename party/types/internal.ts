/**
 * Internal types and constants for the PartyKit server
 * These are NOT shared with the client
 */

import type { MatchAttempt } from '../../shared/types';

// ============================================
// TIMING CONSTANTS
// ============================================

export const TIMING = {
  /** Penalty duration for wrong match attempts */
  PENALTY_DURATION_MS: 3000,
  /** Window to collect simultaneous match attempts for arbitration */
  ARBITRATION_WINDOW_MS: 100,
  /** Grace period for reconnection after disconnect */
  RECONNECT_GRACE_PERIOD_MS: 5000,
  /** Time to fill the room before it expires */
  ROOM_TIMEOUT_MS: 60000,
  /** Time to rejoin after game over */
  REJOIN_WINDOW_MS: 20000,
  /** Rate limit: max match attempts per second */
  MAX_MATCH_ATTEMPTS_PER_SECOND: 10,
  /** Grace period during WAITING phase (shorter for React StrictMode) */
  WAITING_GRACE_PERIOD_MS: 2000,
  /** Countdown duration in seconds */
  COUNTDOWN_SECONDS: 5,
  /** Delay between round end and next round */
  ROUND_TRANSITION_DELAY_MS: 2000,
} as const;

// ============================================
// GAME CONSTANTS
// ============================================

export const GAME = {
  /** Maximum players per room */
  MAX_PLAYERS: 8,
  /** Minimum players to start */
  MIN_PLAYERS: 2,
  /** Maximum player name length */
  MAX_NAME_LENGTH: 50,
  /** Number of symbols per card (projective plane order + 1) */
  SYMBOLS_PER_CARD: 8,
  /** Total symbols in deck */
  TOTAL_SYMBOLS: 57,
} as const;

// ============================================
// INTERNAL TYPES
// ============================================

/** Pending arbitration state for resolving simultaneous matches */
export interface PendingArbitration {
  roundNumber: number;
  windowStart: number;
  attempts: MatchAttempt[];
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/** Rate limit tracking entry */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/** Disconnected player tracking */
export interface DisconnectedPlayerInfo {
  disconnectedAt: number;
}

// ============================================
// CALLBACK TYPES
// ============================================

export type VoidCallback = () => void;
export type CountdownTickCallback = (seconds: number) => void;
export type PlayerRemovedCallback = (playerId: string, remainingCount: number) => void;
export type WinnerCallback = (winnerId: string, symbolId: number) => void;
