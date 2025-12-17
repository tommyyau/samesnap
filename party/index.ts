/**
 * SameSnapRoom - PartyKit Multiplayer Server
 *
 * This is a thin orchestrator that handles PartyKit lifecycle events
 * and routes messages to specialized services.
 *
 * Architecture:
 * - StateManager: Centralized state
 * - TimerService: All timer management
 * - BroadcastService: Messaging and state sync
 * - ArbitrationService: Match resolution and penalties
 * - PlayerService: Player lifecycle
 * - GameEngine: Core game mechanics
 */

import type * as Party from 'partykit/server';
import { RoomPhase } from '../shared/types';
import { ClientMessage } from '../shared/protocol';

// Services
import { StateManager } from './services/StateManager';
import { TimerService } from './services/TimerService';
import { BroadcastService } from './services/BroadcastService';
import { ArbitrationService } from './services/ArbitrationService';
import { PlayerService } from './services/PlayerService';
import { GameEngine } from './services/GameEngine';
import { logger } from './utils/logger';

export default class SameSnapRoom implements Party.Server {
  // Services
  private state: StateManager;
  private timers: TimerService;
  private broadcast: BroadcastService;
  private arbitration: ArbitrationService;
  private players: PlayerService;
  private game: GameEngine;

  constructor(readonly room: Party.Room) {
    // Initialize services with dependencies
    this.state = new StateManager();
    this.timers = new TimerService(this.state);
    this.broadcast = new BroadcastService(room, this.state);
    this.arbitration = new ArbitrationService(this.state, this.broadcast);
    this.players = new PlayerService(room, this.state, this.broadcast, this.timers);
    this.game = new GameEngine(
      room,
      this.state,
      this.broadcast,
      this.timers,
      this.arbitration,
      this.players
    );

    // Wire up cross-service callbacks
    this.players.onPlayerRemoved = (playerId, remainingCount) => {
      this.game.handlePlayerRemoved(remainingCount, () => this.game.handleRoomExpired());
    };
  }

  // ============================================
  // PARTYKIT LIFECYCLE HOOKS
  // ============================================

  /**
   * Handle new connection
   */
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): void {
    const url = new URL(ctx.request.url);
    const reconnectId = url.searchParams.get('reconnectId');

    if (reconnectId && this.state.disconnectedPlayers.has(reconnectId)) {
      this.players.handleReconnection(
        conn,
        reconnectId,
        () => this.game.handleRoomExpired()
      );
    }
    // New connections wait for join message
  }

  /**
   * Handle connection close
   */
  onClose(conn: Party.Connection): void {
    const playerId = this.state.connectionToPlayerId.get(conn.id);
    if (!playerId) return;

    this.players.handleDisconnect(conn, () => {
      // Grace period expired - remove player
      if (this.state.disconnectedPlayers.has(playerId)) {
        this.players.removePlayer(playerId);
      }
    });

    // During countdown, check if we still have enough players
    if (this.state.phase === RoomPhase.COUNTDOWN && !this.state.hasEnoughPlayers()) {
      this.game.cancelCountdown(() => this.game.handleRoomExpired());
    }
  }

  /**
   * Handle incoming message
   */
  onMessage(message: string, sender: Party.Connection): void {
    try {
      const msg: ClientMessage = JSON.parse(message);
      this.routeMessage(msg, sender);
    } catch (e) {
      logger.error(this.room.id, 'Invalid message:', e);
    }
  }

  // ============================================
  // MESSAGE ROUTING
  // ============================================

  /**
   * Route message to appropriate service
   */
  private routeMessage(msg: ClientMessage, sender: Party.Connection): void {
    switch (msg.type) {
      // Player lifecycle
      case 'join':
        this.handleJoinWithReset(sender, msg.payload.playerName);
        break;

      case 'reconnect':
        this.players.handleReconnectMessage(
          sender,
          msg.payload.playerId,
          () => this.game.handleRoomExpired()
        );
        break;

      case 'leave': {
        const playerId = this.state.getPlayerIdByConnection(sender.id);
        if (playerId) this.players.removePlayer(playerId);
        break;
      }

      case 'kick_player':
        this.players.handleKickPlayer(sender.id, msg.payload.playerId);
        break;

      // Game configuration
      case 'set_config':
        this.game.handleSetConfig(sender.id, msg.payload.config);
        break;

      case 'start_game':
        this.game.handleStartGame(
          sender.id,
          msg.payload.config,
          () => this.game.handleRoomExpired()
        );
        break;

      // Gameplay
      case 'match_attempt':
        this.game.handleMatchAttempt(
          sender.id,
          msg.payload.symbolId,
          msg.payload.clientTimestamp
        );
        break;

      // Post-game
      case 'play_again':
        this.game.handlePlayAgain(sender.id);
        break;

      // Utility
      case 'ping': {
        const playerId = this.state.getPlayerIdByConnection(sender.id);
        if (playerId) {
          this.broadcast.sendToPlayer(playerId, {
            type: 'pong',
            payload: {
              serverTimestamp: Date.now(),
              clientTimestamp: msg.payload.timestamp,
            },
          });
        }
        break;
      }
    }
  }

  /**
   * Handle join with potential room reset
   */
  private handleJoinWithReset(conn: Party.Connection, playerName: string): void {
    // Check if room needs reset first
    const canJoin = this.players.canJoin();
    if (!canJoin.allowed) {
      // Check if we should reset for a new game
      const rejoinWindowExpired = this.state.phase === RoomPhase.GAME_OVER &&
        (!this.state.rejoinWindowEndsAt || Date.now() > this.state.rejoinWindowEndsAt);
      const noPlayersLeft = this.state.players.size === 0;

      if (rejoinWindowExpired || noPlayersLeft) {
        this.game.resetRoomForNewGame();
      }
    }

    this.players.handleJoin(conn, playerName, () => this.game.handleRoomExpired());
  }
}
