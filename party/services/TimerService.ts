/**
 * TimerService - Centralized timer management
 *
 * Manages all setTimeout/clearTimeout operations in one place.
 * Prevents orphan timers and makes debugging timer issues trivial.
 */

import { TIMING, VoidCallback, CountdownTickCallback } from '../types/internal';
import type { StateManager } from './StateManager';

export class TimerService {
  // Timer references
  private roomTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private countdownIntervalId: ReturnType<typeof setTimeout> | null = null;
  private roundEndTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private rejoinWindowTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private gracePeriodTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(private state: StateManager) {}

  // ============================================
  // ROOM TIMEOUT (Lobby expiration)
  // ============================================

  /**
   * Start the room timeout timer (lobby expires if game doesn't start)
   */
  startRoomTimeout(onExpire: VoidCallback): void {
    this.clearRoomTimeout();

    this.state.roomExpiresAt = Date.now() + TIMING.ROOM_TIMEOUT_MS;
    this.roomTimeoutId = setTimeout(() => {
      this.roomTimeoutId = null;
      onExpire();
    }, TIMING.ROOM_TIMEOUT_MS);
  }

  /**
   * Refresh room timeout (extends deadline)
   */
  refreshRoomTimeout(onExpire: VoidCallback): void {
    this.startRoomTimeout(onExpire);
  }

  /**
   * Clear room timeout
   */
  clearRoomTimeout(): void {
    if (this.roomTimeoutId) {
      clearTimeout(this.roomTimeoutId);
      this.roomTimeoutId = null;
    }
    this.state.roomExpiresAt = null;
  }

  // ============================================
  // COUNTDOWN (Pre-game countdown)
  // ============================================

  /**
   * Start the pre-game countdown
   * @param onTick Called each second with remaining seconds
   * @param onComplete Called when countdown reaches 0
   */
  startCountdown(onTick: CountdownTickCallback, onComplete: VoidCallback): void {
    this.clearCountdown();

    let count = TIMING.COUNTDOWN_SECONDS;
    this.state.currentCountdown = count;

    const tick = () => {
      this.state.currentCountdown = count;
      onTick(count);

      if (count > 0) {
        count--;
        this.countdownIntervalId = setTimeout(tick, 1000);
      } else {
        this.countdownIntervalId = null;
        this.state.currentCountdown = null;
        onComplete();
      }
    };

    tick();
  }

  /**
   * Cancel the countdown
   */
  clearCountdown(): void {
    if (this.countdownIntervalId) {
      clearTimeout(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.state.currentCountdown = null;
  }

  /**
   * Check if countdown is active
   */
  isCountdownActive(): boolean {
    return this.countdownIntervalId !== null;
  }

  // ============================================
  // ROUND END (Transition to next round)
  // ============================================

  /**
   * Schedule the next round after a delay
   */
  scheduleNextRound(onNextRound: VoidCallback): void {
    this.clearRoundEnd();

    this.roundEndTimeoutId = setTimeout(() => {
      this.roundEndTimeoutId = null;
      onNextRound();
    }, TIMING.ROUND_TRANSITION_DELAY_MS);
  }

  /**
   * Cancel scheduled next round
   */
  clearRoundEnd(): void {
    if (this.roundEndTimeoutId) {
      clearTimeout(this.roundEndTimeoutId);
      this.roundEndTimeoutId = null;
    }
  }

  // ============================================
  // REJOIN WINDOW (After game over)
  // ============================================

  /**
   * Start the rejoin window timer
   */
  startRejoinWindow(onExpire: VoidCallback): void {
    this.clearRejoinWindow();

    this.state.rejoinWindowEndsAt = Date.now() + TIMING.REJOIN_WINDOW_MS;
    this.rejoinWindowTimeoutId = setTimeout(() => {
      this.rejoinWindowTimeoutId = null;
      onExpire();
    }, TIMING.REJOIN_WINDOW_MS);
  }

  /**
   * Clear rejoin window timer
   */
  clearRejoinWindow(): void {
    if (this.rejoinWindowTimeoutId) {
      clearTimeout(this.rejoinWindowTimeoutId);
      this.rejoinWindowTimeoutId = null;
    }
    this.state.rejoinWindowEndsAt = null;
  }

  /**
   * Check if rejoin window is still active
   */
  isRejoinWindowActive(): boolean {
    return this.state.rejoinWindowEndsAt !== null &&
           Date.now() <= this.state.rejoinWindowEndsAt;
  }

  // ============================================
  // GRACE PERIOD (Player disconnect)
  // ============================================

  /**
   * Start a grace period for a disconnected player
   */
  startGracePeriod(playerId: string, isWaiting: boolean, onExpire: VoidCallback): void {
    this.clearGracePeriod(playerId);

    const duration = isWaiting
      ? TIMING.WAITING_GRACE_PERIOD_MS
      : TIMING.RECONNECT_GRACE_PERIOD_MS;

    const timeoutId = setTimeout(() => {
      this.gracePeriodTimeouts.delete(playerId);
      onExpire();
    }, duration);

    this.gracePeriodTimeouts.set(playerId, timeoutId);
  }

  /**
   * Clear a specific player's grace period
   */
  clearGracePeriod(playerId: string): void {
    const timeoutId = this.gracePeriodTimeouts.get(playerId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.gracePeriodTimeouts.delete(playerId);
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  /**
   * Clear all timers (for room teardown)
   */
  clearAll(): void {
    this.clearRoomTimeout();
    this.clearCountdown();
    this.clearRoundEnd();
    this.clearRejoinWindow();

    // Clear all grace period timers
    this.gracePeriodTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.gracePeriodTimeouts.clear();
  }
}
