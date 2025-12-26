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
  /** Grace period for reconnection after disconnect (non-host, during game) */
  RECONNECT_GRACE_PERIOD_MS: 5000,
  /** Grace period for HOST reconnection (any phase) - 5 minutes */
  HOST_RECONNECT_GRACE_PERIOD_MS: 300000,
  /** Time to fill the room before it expires - 30 minutes (host controls start) */
  ROOM_TIMEOUT_MS: 1800000,
  /** Time to rejoin after game over - 30 minutes (no pressure to rematch) */
  REJOIN_WINDOW_MS: 1800000,
  /** Rate limit: max match attempts per second */
  MAX_MATCH_ATTEMPTS_PER_SECOND: 10,
  /** Grace period during WAITING phase - 5 minutes (no urgency, host controls start) */
  WAITING_GRACE_PERIOD_MS: 300000,
  /** Countdown duration in seconds */
  COUNTDOWN_SECONDS: 5,
  /** Delay between round end and next round (used for leaderboard display) */
  ROUND_TRANSITION_DELAY_MS: 3500,
  /** Window to capture close-call attempts after winner determined (non-winners can still click) */
  CLOSE_CALL_CAPTURE_MS: 1500,
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
