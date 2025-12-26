/**
 * ArbitrationService - Match resolution and penalty management
 *
 * Handles:
 * - Match attempt validation
 * - Rate limiting
 * - Penalty application and tracking
 * - Arbitration window for simultaneous matches
 */

import { MatchAttempt, SoCloseEntry } from '../../shared/types';
import {
  TIMING,
  GAME,
  PendingArbitration,
  WinnerCallback,
} from '../types/internal';
import type { StateManager } from './StateManager';
import type { BroadcastService } from './BroadcastService';

/** Callback when close-call capture window closes */
export type CloseCallWindowClosedCallback = (hasCloseCalls: boolean) => void;

export class ArbitrationService {
  private pendingArbitration: PendingArbitration | null = null;

  /** Callback when a winner is determined */
  onWinnerDetermined: WinnerCallback | null = null;

  /** Callback when close-call capture window closes */
  onCloseCallWindowClosed: CloseCallWindowClosedCallback | null = null;

  // ============================================
  // CLOSE-CALL CAPTURE STATE
  // ============================================

  /** Whether we're currently capturing close-call attempts */
  private closeCallCaptureActive: boolean = false;

  /** Timeout for closing the close-call capture window */
  private closeCallCaptureTimeout: ReturnType<typeof setTimeout> | null = null;

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

    // Store winner timestamp for close-call delta calculations
    this.state.winnerTimestamp = winner.serverTimestamp;

    // Start close-call capture window (2 seconds)
    this.startCloseCallCapture();

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

  // ============================================
  // CLOSE-CALL CAPTURE
  // ============================================

  /**
   * Start the close-call capture window (2 seconds after winner)
   */
  private startCloseCallCapture(): void {
    this.closeCallCaptureActive = true;
    this.state.soCloseEntries = [];

    this.closeCallCaptureTimeout = setTimeout(() => {
      this.closeCallCaptureActive = false;
      this.closeCallCaptureTimeout = null;

      // Notify that capture window is closed
      if (this.onCloseCallWindowClosed) {
        this.onCloseCallWindowClosed(this.state.soCloseEntries.length > 0);
      }
    }, TIMING.ROUND_TRANSITION_DELAY_MS);
  }

  /**
   * Check if close-call capture is currently active
   */
  isCloseCallCaptureActive(): boolean {
    return this.closeCallCaptureActive;
  }

  /**
   * Process a close-call attempt during the capture window
   * @returns true if the attempt was recorded, false if ignored
   */
  processCloseCallAttempt(
    playerId: string,
    playerName: string,
    serverTimestamp: number
  ): boolean {
    if (!this.closeCallCaptureActive || !this.state.winnerTimestamp) {
      return false;
    }

    // Calculate delta from winner
    const deltaMs = serverTimestamp - this.state.winnerTimestamp;

    // Only capture if within the window and positive delta
    if (deltaMs <= 0 || deltaMs > TIMING.ROUND_TRANSITION_DELAY_MS) {
      return false;
    }

    // Check for duplicate (same player already recorded)
    if (this.state.soCloseEntries.some(e => e.playerId === playerId)) {
      return false;
    }

    // Add entry
    const entry: SoCloseEntry = {
      playerId,
      playerName,
      deltaMs,
    };

    this.state.soCloseEntries.push(entry);

    // Keep sorted by deltaMs
    this.state.soCloseEntries.sort((a, b) => a.deltaMs - b.deltaMs);

    return true;
  }

  /**
   * Cancel the close-call capture window
   */
  cancelCloseCallCapture(): void {
    if (this.closeCallCaptureTimeout) {
      clearTimeout(this.closeCallCaptureTimeout);
      this.closeCallCaptureTimeout = null;
    }
    this.closeCallCaptureActive = false;
  }

  /**
   * Validate a match against the previous round's cards (for close-call validation)
   * Used during ROUND_END phase when cards have already moved
   */
  validateCloseCallMatch(
    playerId: string,
    symbolId: number
  ): { valid: true } | { valid: false; reason: string } {
    // Get previous player top card
    const previousPlayerCard = this.state.previousPlayerTopCards.get(playerId);
    if (!previousPlayerCard) {
      return { valid: false, reason: 'No previous card for player' };
    }

    // Get previous center card
    const previousCenterCard = this.state.previousCenterCard;
    if (!previousCenterCard) {
      return { valid: false, reason: 'No previous center card' };
    }

    // Check if symbol is on both cards
    const inPlayerHand = previousPlayerCard.symbols.some(s => s.id === symbolId);
    const inCenter = previousCenterCard.symbols.some(s => s.id === symbolId);

    if (!inPlayerHand || !inCenter) {
      return { valid: false, reason: 'Symbol not on both previous cards' };
    }

    return { valid: true };
  }
}
