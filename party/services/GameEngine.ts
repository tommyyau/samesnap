/**
 * GameEngine - Core game mechanics
 *
 * Handles:
 * - Game configuration
 * - Countdown and game start
 * - Round management
 * - Match processing
 * - Game end conditions
 * - Rematch logic
 */

import type * as Party from 'partykit/server';
import {
  RoomPhase,
  PlayerStatus,
  CardData,
  MultiplayerGameConfig,
  MatchAttempt,
  GameDuration,
  SymbolItem,
} from '../../shared/types';
import { ERROR_CODES } from '../../shared/protocol';
import { generateDeck } from '../../shared/gameLogic';
import { getSymbolsForCardSet, DEFAULT_CARD_SET_ID } from '../../shared/cardSets';
import { TIMING, GAME } from '../types/internal';
import type { StateManager } from './StateManager';
import type { BroadcastService } from './BroadcastService';
import type { TimerService } from './TimerService';
import type { ArbitrationService } from './ArbitrationService';
import type { PlayerService } from './PlayerService';
import { logger } from '../utils/logger';

export class GameEngine {
  constructor(
    private room: Party.Room,
    private state: StateManager,
    private broadcast: BroadcastService,
    private timers: TimerService,
    private arbitration: ArbitrationService,
    private players: PlayerService
  ) {
    // Wire up arbitration callback
    this.arbitration.onWinnerDetermined = (winnerId, symbolId) => {
      this.processRoundWin(winnerId, symbolId);
    };
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  /**
   * Handle config update from host
   */
  handleSetConfig(connectionId: string, config: MultiplayerGameConfig): void {
    const player = this.state.getPlayerByConnection(connectionId);
    if (!player) return;

    if (!player.isHost) {
      this.broadcast.sendError(player.id, ERROR_CODES.NOT_HOST, 'Only host can set config');
      return;
    }

    if (this.state.phase !== RoomPhase.WAITING && this.state.phase !== RoomPhase.GAME_OVER) {
      this.broadcast.sendError(
        player.id,
        ERROR_CODES.INVALID_STATE,
        'Cannot change config while game in progress'
      );
      return;
    }

    this.state.config = {
      cardLayout: config.cardLayout,
      cardSetId: config.cardSetId,
      gameDuration: config.gameDuration ?? this.state.config?.gameDuration ?? GameDuration.MEDIUM,
      customSymbols: config.customSymbols,
      customSetName: config.customSetName,
    };

    this.broadcast.broadcastConfigUpdated();
  }

  // ============================================
  // GAME START
  // ============================================

  /**
   * Handle start game request from host
   */
  handleStartGame(
    connectionId: string,
    config: MultiplayerGameConfig,
    onRoomTimeout: () => void
  ): void {
    const player = this.state.getPlayerByConnection(connectionId);
    if (!player) return;

    if (!player.isHost) {
      this.broadcast.sendError(player.id, ERROR_CODES.NOT_HOST, 'Only host can start');
      return;
    }

    if (!this.state.hasEnoughPlayers()) {
      this.broadcast.sendError(
        player.id,
        ERROR_CODES.INVALID_STATE,
        'Need at least 2 players'
      );
      return;
    }

    // Store config
    this.state.config = {
      cardLayout: config.cardLayout,
      cardSetId: config.cardSetId,
      gameDuration: config.gameDuration ?? this.state.config?.gameDuration ?? GameDuration.MEDIUM,
      customSymbols: config.customSymbols,
      customSetName: config.customSetName,
    };

    this.startCountdown(onRoomTimeout);
  }

  /**
   * Start the pre-game countdown
   */
  private startCountdown(onRoomTimeout: () => void): void {
    this.state.phase = RoomPhase.COUNTDOWN;
    this.timers.clearRoomTimeout();

    this.timers.startCountdown(
      // On tick
      (seconds) => {
        if (this.state.phase === RoomPhase.COUNTDOWN) {
          this.broadcast.broadcastCountdown(seconds);
        }
      },
      // On complete
      () => {
        if (this.state.phase !== RoomPhase.COUNTDOWN) return;

        if (this.state.hasEnoughPlayers()) {
          this.startGame();
        } else {
          // Not enough players - return to waiting
          this.cancelCountdown(onRoomTimeout);
        }
      }
    );
  }

  /**
   * Cancel countdown and return to waiting
   */
  cancelCountdown(onRoomTimeout: () => void): void {
    this.timers.clearCountdown();

    if (this.state.phase === RoomPhase.COUNTDOWN) {
      this.state.phase = RoomPhase.WAITING;
      this.timers.startRoomTimeout(onRoomTimeout);
      this.broadcast.broadcastCountdownCancelled();
      this.broadcast.broadcastRoomState();
    }
  }

  /**
   * Start the actual game
   */
  private startGame(): void {
    // Get symbols
    let symbols: SymbolItem[];
    if (this.state.config?.customSymbols && this.state.config.customSymbols.length === GAME.TOTAL_SYMBOLS) {
      symbols = this.state.config.customSymbols.map((char, index) => ({
        id: index,
        char,
        name: `Symbol ${index}`,
      }));
      logger.info(this.room.id, `Using custom card set: ${this.state.config.customSetName || 'Custom'}`);
    } else {
      const cardSetId = this.state.config?.cardSetId ?? DEFAULT_CARD_SET_ID;
      symbols = getSymbolsForCardSet(cardSetId);
    }

    const generatedDeck = generateDeck(7, symbols);

    // Truncate deck based on game duration
    const gameDuration = this.state.config?.gameDuration ?? GameDuration.MEDIUM;
    const deckSize = Math.min(gameDuration, generatedDeck.length);
    this.state.fullDeck = generatedDeck.slice(0, deckSize);
    this.state.roundNumber = 0;
    this.state.penalties.clear();

    // Shuffle the deck
    const shuffledDeck = [...this.state.fullDeck];
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
    }

    // Card distribution
    const playerCount = this.state.players.size;
    const cardsForPlayers = shuffledDeck.length - 1;
    const cardsPerPlayer = Math.floor(cardsForPlayers / playerCount);

    // Set center card
    this.state.centerCard = shuffledDeck.pop() || null;

    // Deal to players
    let cardIndex = 0;
    this.state.players.forEach(player => {
      player.cardStack = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        player.cardStack.push(shuffledDeck[cardIndex].id);
        cardIndex++;
      }
    });

    this.state.phase = RoomPhase.PLAYING;
    this.state.roundNumber = 1;

    // Send round_start to each player
    this.broadcastRoundStart();
  }

  // ============================================
  // MATCH HANDLING
  // ============================================

  /**
   * Handle a match attempt from a player
   */
  handleMatchAttempt(connectionId: string, symbolId: number, clientTimestamp: number): void {
    const playerId = this.state.connectionToPlayerId.get(connectionId);
    if (!playerId) return;

    const serverTimestamp = Date.now();

    // Validate symbol ID
    if (!this.arbitration.isValidSymbolId(symbolId)) {
      logger.error(this.room.id, `Invalid symbolId: ${symbolId} from ${playerId}`);
      return;
    }

    // Rate limiting
    if (!this.arbitration.checkRateLimit(connectionId)) {
      logger.warn(this.room.id, `Rate limited: ${connectionId}`);
      return;
    }

    // Check game state
    if (this.state.phase !== RoomPhase.PLAYING) return;

    const player = this.state.players.get(playerId);
    if (!player || player.cardStack.length === 0) return;

    // Check penalty
    if (this.arbitration.isPenalized(playerId)) {
      this.broadcast.sendError(playerId, ERROR_CODES.IN_PENALTY, 'Wait for penalty');
      return;
    }

    // Validate match
    const validation = this.arbitration.validateMatch(playerId, symbolId);
    if (!validation.valid) {
      this.arbitration.applyPenalty(playerId, 'Wrong symbol');
      return;
    }

    // Valid match - add to arbitration
    const attempt: MatchAttempt = {
      playerId,
      symbolId,
      clientTimestamp,
      serverTimestamp,
      isValid: true,
    };
    this.arbitration.addMatchAttempt(attempt);
  }

  /**
   * Process a round win (called by ArbitrationService)
   */
  private processRoundWin(winnerId: string, symbolId: number): void {
    const winner = this.state.players.get(winnerId);
    if (!winner) return;

    this.state.phase = RoomPhase.ROUND_END;
    this.state.roundWinnerId = winnerId;
    this.state.roundMatchedSymbolId = symbolId;

    // Winner's top card becomes center
    const oldTopCardId = winner.cardStack.shift();
    if (oldTopCardId !== undefined) {
      this.state.centerCard = this.state.getCardById(oldTopCardId);
    }

    this.broadcast.broadcastRoundWinner(
      winnerId,
      winner.name,
      symbolId,
      winner.cardStack.length
    );

    // Check for game over
    if (winner.cardStack.length === 0) {
      this.endGame('stack_emptied', winnerId, winner.name);
      return;
    }

    // Schedule next round
    this.timers.scheduleNextRound(() => this.nextRound());
  }

  /**
   * Start the next round
   */
  private nextRound(): void {
    if (this.state.phase !== RoomPhase.ROUND_END) return;
    if (!this.state.centerCard) return;

    this.state.roundNumber++;
    this.state.phase = RoomPhase.PLAYING;
    this.state.roundWinnerId = null;
    this.state.roundMatchedSymbolId = null;

    this.broadcastRoundStart();
  }

  /**
   * Broadcast round_start to all players
   */
  private broadcastRoundStart(): void {
    this.state.players.forEach((player, playerId) => {
      if (player.cardStack.length === 0) return;

      const topCardId = player.cardStack[0];
      const yourCard = this.state.getCardById(topCardId);

      if (yourCard && this.state.centerCard) {
        this.broadcast.sendToPlayer(playerId, {
          type: 'round_start',
          payload: {
            centerCard: this.state.centerCard,
            yourCard,
            yourCardsRemaining: player.cardStack.length,
            allPlayersRemaining: this.state.getAllPlayersRemaining(),
            roundNumber: this.state.roundNumber,
          },
        });
      }
    });
  }

  // ============================================
  // GAME END
  // ============================================

  /**
   * End the game
   */
  endGame(
    reason: 'stack_emptied' | 'last_player_standing' = 'stack_emptied',
    winnerId?: string,
    winnerName?: string
  ): void {
    // Clear pending timers
    this.timers.clearRoundEnd();
    this.arbitration.cancelPendingArbitration();
    this.arbitration.clearAllPenalties();

    this.state.phase = RoomPhase.GAME_OVER;
    this.state.lastGameEndReason = reason;
    this.state.playersWantRematch.clear();

    // Calculate standings
    const finalStandings = Array.from(this.state.players.values())
      .map(p => ({ playerId: p.id, name: p.name, cardsRemaining: p.cardStack.length }))
      .sort((a, b) => a.cardsRemaining - b.cardsRemaining);

    // Determine winner
    const actualWinnerId = winnerId || finalStandings[0]?.playerId || '';
    const actualWinnerName = winnerName || finalStandings[0]?.name || 'Unknown';
    this.state.lastWinnerId = actualWinnerId || null;
    this.state.lastWinnerName = actualWinnerName;

    // Start rejoin window
    this.timers.startRejoinWindow(() => this.handleRejoinWindowExpired());

    this.broadcast.broadcastGameOver(
      actualWinnerId,
      actualWinnerName,
      finalStandings,
      reason,
      TIMING.REJOIN_WINDOW_MS
    );
  }

  /**
   * End game due to last player standing
   */
  endGameLastPlayerStanding(): void {
    logger.info(this.room.id, `Last player standing triggered, phase=${this.state.phase}`);

    const survivor = Array.from(this.state.players.values())[0];
    if (!survivor) {
      logger.info(this.room.id, 'No survivor found, ending game');
      this.endGame('last_player_standing');
      return;
    }

    survivor.cardStack = [];
    logger.info(this.room.id, `Survivor: ${survivor.name} (${survivor.id}) wins`);
    this.endGame('last_player_standing', survivor.id, survivor.name);
  }

  /**
   * Handle player removal during game
   */
  handlePlayerRemoved(remainingCount: number, onRoomTimeout: () => void): void {
    if (remainingCount < GAME.MIN_PLAYERS) {
      if (this.state.phase === RoomPhase.COUNTDOWN) {
        this.cancelCountdown(onRoomTimeout);
      } else if (this.state.phase === RoomPhase.PLAYING || this.state.phase === RoomPhase.ROUND_END) {
        this.endGameLastPlayerStanding();
      } else if (this.state.phase !== RoomPhase.WAITING && this.state.phase !== RoomPhase.GAME_OVER) {
        this.endGame();
      }
    }
  }

  // ============================================
  // REMATCH LOGIC
  // ============================================

  /**
   * Handle play again request
   */
  handlePlayAgain(connectionId: string): void {
    const playerId = this.state.connectionToPlayerId.get(connectionId);
    if (!playerId) return;

    const player = this.state.players.get(playerId);
    if (!player) return;

    if (this.state.phase !== RoomPhase.GAME_OVER) {
      this.broadcast.sendError(
        playerId,
        ERROR_CODES.INVALID_STATE,
        'Cannot play again - game not in GAME_OVER phase'
      );
      return;
    }

    if (!this.timers.isRejoinWindowActive()) {
      this.broadcast.sendError(
        playerId,
        ERROR_CODES.INVALID_STATE,
        'Rejoin window has expired'
      );
      return;
    }

    this.state.playersWantRematch.add(playerId);
    logger.info(this.room.id, `Player ${player.name} wants rematch. Count: ${this.state.playersWantRematch.size}`);

    this.broadcast.broadcastPlayAgainAck(playerId);

    // If 2+ want rematch, reset early
    if (this.state.playersWantRematch.size >= GAME.MIN_PLAYERS) {
      logger.info(this.room.id, '2+ players want rematch, resetting room early');
      this.handleRejoinWindowExpired();
    }
  }

  /**
   * Handle rejoin window expiration
   */
  private handleRejoinWindowExpired(): void {
    this.timers.clearRejoinWindow();

    const rematchPlayers = Array.from(this.state.playersWantRematch).filter(pid => {
      const player = this.state.players.get(pid);
      return player && player.status === PlayerStatus.CONNECTED;
    });

    logger.info(this.room.id, `Rejoin window expired. Rematch players: ${rematchPlayers.length}`);

    if (rematchPlayers.length === 0) {
      logger.info(this.room.id, 'No players want rematch, resetting room');
      this.broadcast.broadcastRoomExpired('No players rejoined after game over');
      this.resetRoomForNewGame();
      return;
    }

    if (rematchPlayers.length === 1) {
      const soloPlayerId = rematchPlayers[0];
      logger.info(this.room.id, 'Only 1 player rejoined, booting them');

      this.broadcast.sendToPlayer(soloPlayerId, {
        type: 'solo_rejoin_boot',
        payload: { message: "You're the only one who rejoined. Please create a new room." },
      });

      const player = this.state.players.get(soloPlayerId);
      if (player) {
        const conn = this.room.getConnection(player.connectionId);
        if (conn) setTimeout(() => conn.close(), 100);
      }
      return;
    }

    // 2+ players - reset room
    logger.info(this.room.id, `${rematchPlayers.length} players want rematch, resetting room`);
    this.resetRoom(rematchPlayers);
  }

  /**
   * Reset room for rematch (keeping specified players)
   */
  private resetRoom(keepPlayerIds: string[]): void {
    // Remove players who didn't want rematch
    const playersToRemove: string[] = [];
    Array.from(this.state.players.keys()).forEach(playerId => {
      if (!keepPlayerIds.includes(playerId)) {
        playersToRemove.push(playerId);
      }
    });

    for (const pid of playersToRemove) {
      const player = this.state.players.get(pid);
      if (player) {
        const conn = this.room.getConnection(player.connectionId);
        if (conn) conn.close();
        this.state.players.delete(pid);
        this.state.connectionToPlayerId.delete(player.connectionId);
      }
    }

    // Reset game state
    this.state.phase = RoomPhase.WAITING;
    this.state.resetGameState();
    this.state.disconnectedPlayers.clear();

    // Ensure host
    if (!this.state.hostId || !this.state.players.has(this.state.hostId)) {
      const firstPlayer = Array.from(this.state.players.values())[0];
      if (firstPlayer) {
        this.state.players.forEach(p => {
          p.isHost = false;
        });
        firstPlayer.isHost = true;
        this.state.hostId = firstPlayer.id;
        this.broadcast.sendToPlayer(firstPlayer.id, { type: 'you_are_host', payload: {} });
      }
    }

    // Re-arm room timeout
    this.timers.startRoomTimeout(() => this.handleRoomExpired());

    this.broadcast.broadcastRoomReset();
    this.broadcast.broadcastRoomState();

    logger.info(this.room.id, `Room reset. ${this.state.players.size} players in waiting room`);
  }

  /**
   * Reset room for completely new game
   */
  resetRoomForNewGame(): void {
    this.timers.clearAll();
    this.players.closeAllConnections();
    this.state.resetAll();
    logger.info(this.room.id, 'Room completely reset for new game');
  }

  /**
   * Handle room expiration (lobby timeout)
   */
  handleRoomExpired(): void {
    if (this.state.phase !== RoomPhase.WAITING) return;

    logger.info(this.room.id, 'Lobby timer expired');
    this.broadcast.broadcastRoomExpired('Room closed due to inactivity. Please create a new room.');
    this.players.closeAllConnections();
  }
}
