/**
 * ArbitrationService - Match resolution and penalty management
 *
 * Handles:
 * - Match attempt validation
 * - Rate limiting
 * - Penalty application and tracking
 * - Arbitration window for simultaneous matches
 */

import { MatchAttempt } from '../../shared/types';
import {
  TIMING,
  GAME,
  PendingArbitration,
  WinnerCallback,
} from '../types/internal';
import type { StateManager } from './StateManager';
import type { BroadcastService } from './BroadcastService';

export class ArbitrationService {
  private pendingArbitration: PendingArbitration | null = null;

  /** Callback when a winner is determined */
  onWinnerDetermined: WinnerCallback | null = null;

  constructor(
    private state: StateManager,
    private broadcast: BroadcastService
  ) {}

  // ============================================
  // RATE LIMITING
  // ============================================

  /**
   * Check if a connection is within rate limits
   * @returns true if allowed, false if rate limited
   */
  checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    const entry = this.state.matchAttemptCounts.get(connectionId);

    if (!entry || now > entry.resetTime) {
      this.state.matchAttemptCounts.set(connectionId, {
        count: 1,
        resetTime: now + 1000,
      });
      return true;
    }

    if (entry.count >= TIMING.MAX_MATCH_ATTEMPTS_PER_SECOND) {
      return false;
    }

    entry.count++;
    return true;
  }

  // ============================================
  // MATCH VALIDATION
  // ============================================

  /**
   * Validate a symbol ID
   */
  isValidSymbolId(symbolId: number): boolean {
    return typeof symbolId === 'number' &&
           Number.isInteger(symbolId) &&
           symbolId >= 0 &&
           symbolId < GAME.TOTAL_SYMBOLS;
  }

  /**
   * Validate a match attempt
   * @returns { valid: true } or { valid: false, reason: string }
   */
  validateMatch(
    playerId: string,
    symbolId: number
  ): { valid: true } | { valid: false; reason: string } {
    const player = this.state.players.get(playerId);
    if (!player || player.cardStack.length === 0) {
      return { valid: false, reason: 'Player has no cards' };
    }

    const topCardId = player.cardStack[0];
    const playerCard = this.state.getCardById(topCardId);
    if (!playerCard) {
      return { valid: false, reason: 'Player card not found' };
    }

    if (!this.state.centerCard) {
      return { valid: false, reason: 'No center card' };
    }

    const inPlayerHand = playerCard.symbols.some(s => s.id === symbolId);
    const inCenter = this.state.centerCard.symbols.some(s => s.id === symbolId);

    if (!inPlayerHand || !inCenter) {
      return { valid: false, reason: 'Symbol not on both cards' };
    }

    return { valid: true };
  }

  // ============================================
  // PENALTY MANAGEMENT
  // ============================================

  /**
   * Check if a player is currently penalized
   */
  isPenalized(playerId: string): boolean {
    const penaltyUntil = this.state.penalties.get(playerId);
    if (!penaltyUntil) return false;
    return Date.now() < penaltyUntil;
  }

  /**
   * Apply a penalty to a player
   */
  applyPenalty(playerId: string, reason: string): void {
    const now = Date.now();
    const until = now + TIMING.PENALTY_DURATION_MS;
    this.state.penalties.set(playerId, until);

    this.broadcast.sendToPlayer(playerId, {
      type: 'penalty',
      payload: {
        serverTimestamp: now,
        durationMs: TIMING.PENALTY_DURATION_MS,
        reason,
      },
    });
  }

  /**
   * Get remaining penalty time for a player
   */
  getPenaltyRemaining(playerId: string): number | undefined {
    const penaltyUntil = this.state.penalties.get(playerId);
    if (!penaltyUntil) return undefined;
    const remaining = penaltyUntil - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  /**
   * Clear all penalties (e.g., on game end)
   */
  clearAllPenalties(): void {
    this.state.penalties.clear();
  }

  // ============================================
  // ARBITRATION
  // ============================================

  /**
   * Add a valid match attempt to the arbitration window
   */
  addMatchAttempt(attempt: MatchAttempt): void {
    if (!this.pendingArbitration) {
      // Start new arbitration window
      this.pendingArbitration = {
        roundNumber: this.state.roundNumber,
        windowStart: attempt.serverTimestamp,
        attempts: [attempt],
        timeoutId: setTimeout(
          () => this.resolveArbitration(),
          TIMING.ARBITRATION_WINDOW_MS
        ),
      };
    } else if (this.pendingArbitration.roundNumber === this.state.roundNumber) {
      // Add to existing window
      this.pendingArbitration.attempts.push(attempt);
    }
    // Ignore attempts from different rounds
  }

  /**
   * Resolve the arbitration window and determine winner
   */
  private resolveArbitration(): void {
    if (!this.pendingArbitration) return;

    const { attempts } = this.pendingArbitration;
    this.pendingArbitration = null;

    if (attempts.length === 0) return;

    // Sort by server timestamp, then random for ties
    attempts.sort((a, b) => {
      const serverDiff = a.serverTimestamp - b.serverTimestamp;
      if (serverDiff !== 0) return serverDiff;
      return Math.random() - 0.5;
    });

    const winner = attempts[0];

    // Notify via callback
    if (this.onWinnerDetermined) {
      this.onWinnerDetermined(winner.playerId, winner.symbolId);
    }
  }

  /**
   * Cancel any pending arbitration (e.g., on game end)
   */
  cancelPendingArbitration(): void {
    if (this.pendingArbitration?.timeoutId) {
      clearTimeout(this.pendingArbitration.timeoutId);
      this.pendingArbitration = null;
    }
  }

  /**
   * Check if there's pending arbitration for the current round
   */
  hasPendingArbitration(): boolean {
    return this.pendingArbitration !== null &&
           this.pendingArbitration.roundNumber === this.state.roundNumber;
  }
}
