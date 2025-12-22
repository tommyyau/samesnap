/**
 * PlayerService - Player lifecycle management
 *
 * Handles:
 * - Player join/leave
 * - Disconnection/reconnection
 * - Host management
 * - Name sanitization
 */

import type * as Party from 'partykit/server';
import {
  RoomPhase,
  PlayerStatus,
  ServerPlayer,
} from '../../shared/types';
import { ERROR_CODES } from '../../shared/protocol';
import { GAME, PlayerRemovedCallback } from '../types/internal';
import type { StateManager } from './StateManager';
import type { BroadcastService } from './BroadcastService';
import type { TimerService } from './TimerService';

export class PlayerService {
  /** Callback when a player is removed (for game logic to react) */
  onPlayerRemoved: PlayerRemovedCallback | null = null;

  constructor(
    private room: Party.Room,
    private state: StateManager,
    private broadcast: BroadcastService,
    private timers: TimerService
  ) {}

  // ============================================
  // JOIN HANDLING
  // ============================================

  /**
   * Handle a new player joining
   */
  handleJoin(
    conn: Party.Connection,
    playerName: string,
    onRoomTimeout: () => void
  ): void {
    // Check if this connection already has a player (duplicate join)
    const existingPlayerId = this.state.connectionToPlayerId.get(conn.id);
    if (existingPlayerId && this.state.players.has(existingPlayerId)) {
      this.broadcast.sendRoomState(existingPlayerId);
      return;
    }

    // Check room capacity
    if (this.state.isRoomFull()) {
      this.broadcast.sendErrorToConnection(conn, ERROR_CODES.ROOM_FULL, 'Room is full');
      return;
    }

    // Check game state
    if (this.state.phase !== RoomPhase.WAITING) {
      const rejoinWindowExpired = this.state.phase === RoomPhase.GAME_OVER &&
        (!this.state.rejoinWindowEndsAt || Date.now() > this.state.rejoinWindowEndsAt);
      const noPlayersLeft = this.state.players.size === 0;

      if (!rejoinWindowExpired && !noPlayersLeft) {
        this.broadcast.sendErrorToConnection(
          conn,
          ERROR_CODES.GAME_IN_PROGRESS,
          'Game already in progress'
        );
        return;
      }
      // Room can be reused - reset will happen via GameEngine
    }

    // Sanitize and deduplicate name
    const sanitizedName = this.sanitizePlayerName(playerName);
    const finalName = this.state.isNameTaken(sanitizedName)
      ? `${sanitizedName} ${this.state.players.size + 1}`
      : sanitizedName;

    // Create player
    const isHost = this.state.players.size === 0;
    const playerId = this.generatePlayerId();
    const player: ServerPlayer = {
      id: playerId,
      connectionId: conn.id,
      name: finalName,
      status: PlayerStatus.CONNECTED,
      cardStack: [],
      isHost,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    // Add to state
    this.state.players.set(playerId, player);
    this.state.connectionToPlayerId.set(conn.id, playerId);

    if (isHost) {
      this.state.hostId = playerId;
      this.state.initializeDefaultConfig();
      this.broadcast.sendToPlayer(playerId, { type: 'you_are_host', payload: {} });
      this.timers.startRoomTimeout(onRoomTimeout);
    }
    // No refresh on player join - 30-minute timeout is sufficient

    // Notify all players
    this.broadcast.broadcastPlayerJoined(player);
    this.broadcast.sendRoomState(playerId);
  }

  /**
   * Check if a new player can join (for pre-validation)
   */
  canJoin(): { allowed: boolean; reason?: string } {
    if (this.state.isRoomFull()) {
      return { allowed: false, reason: 'Room is full' };
    }
    if (this.state.phase !== RoomPhase.WAITING) {
      const rejoinWindowExpired = this.state.phase === RoomPhase.GAME_OVER &&
        (!this.state.rejoinWindowEndsAt || Date.now() > this.state.rejoinWindowEndsAt);
      const noPlayersLeft = this.state.players.size === 0;

      if (!rejoinWindowExpired && !noPlayersLeft) {
        return { allowed: false, reason: 'Game in progress' };
      }
    }
    return { allowed: true };
  }

  // ============================================
  // DISCONNECT HANDLING
  // ============================================

  /**
   * Handle player disconnect (connection closed)
   */
  handleDisconnect(conn: Party.Connection, onGraceExpire: () => void): void {
    const playerId = this.state.connectionToPlayerId.get(conn.id);
    if (!playerId) return;

    const player = this.state.players.get(playerId);
    if (!player) return;

    // Mark as disconnected
    player.status = PlayerStatus.DISCONNECTED;
    this.state.disconnectedPlayers.set(playerId, { disconnectedAt: Date.now() });
    this.state.connectionToPlayerId.delete(conn.id);

    this.broadcast.broadcastPlayerDisconnected(playerId);

    // Start grace period (host gets extended grace in all phases)
    const isWaiting = this.state.phase === RoomPhase.WAITING;
    this.timers.startGracePeriod(playerId, isWaiting, player.isHost, onGraceExpire);
  }

  // ============================================
  // RECONNECTION HANDLING
  // ============================================

  /**
   * Handle URL-based reconnection (reconnectId in query string)
   */
  handleReconnection(
    conn: Party.Connection,
    playerId: string,
    onRoomTimeout: () => void
  ): boolean {
    if (!this.state.disconnectedPlayers.has(playerId)) {
      return false;
    }

    this.state.disconnectedPlayers.delete(playerId);
    this.timers.clearGracePeriod(playerId);

    const player = this.state.players.get(playerId);
    if (!player) return false;

    // Restore connection
    player.connectionId = conn.id;
    player.status = PlayerStatus.CONNECTED;
    player.lastSeen = Date.now();
    this.state.connectionToPlayerId.set(conn.id, playerId);

    if (player.isHost) {
      this.state.hostId = playerId;
    }

    this.broadcast.broadcastPlayerReconnected(playerId);
    // No refresh on reconnect - 30-minute timeout is sufficient

    this.broadcast.sendRoomState(playerId);
    return true;
  }

  /**
   * Handle reconnect message (alternative to URL-based)
   */
  handleReconnectMessage(
    conn: Party.Connection,
    playerId: string,
    onRoomTimeout: () => void
  ): void {
    if (this.state.disconnectedPlayers.has(playerId)) {
      this.handleReconnection(conn, playerId, onRoomTimeout);
    } else if (this.state.players.has(playerId)) {
      // Player exists - update connection mapping
      const player = this.state.players.get(playerId)!;
      this.state.connectionToPlayerId.delete(player.connectionId);
      player.connectionId = conn.id;
      this.state.connectionToPlayerId.set(conn.id, playerId);
      this.broadcast.sendRoomState(playerId);
    } else {
      // Unknown player
      this.broadcast.sendErrorToConnection(
        conn,
        ERROR_CODES.PLAYER_NOT_FOUND,
        'Cannot reconnect - player not found or session expired'
      );
    }
  }

  // ============================================
  // PLAYER REMOVAL
  // ============================================

  /**
   * Remove a player from the room
   */
  removePlayer(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    const playerName = player.name;
    const wasHost = player.isHost;

    // Clean up
    this.state.players.delete(playerId);
    this.state.disconnectedPlayers.delete(playerId);
    this.state.connectionToPlayerId.delete(player.connectionId);
    this.state.playersWantRematch.delete(playerId);
    this.timers.clearGracePeriod(playerId);

    this.broadcast.broadcastPlayerLeft(playerId, playerName);

    // Reassign host if needed
    if (wasHost && this.state.players.size > 0) {
      this.reassignHost();
    } else if (this.state.players.size === 0) {
      this.state.hostId = null;
    }

    // Notify game logic
    if (this.onPlayerRemoved) {
      this.onPlayerRemoved(playerId, this.state.players.size);
    }
  }

  /**
   * Handle kick request from host
   */
  handleKickPlayer(hostConnectionId: string, targetPlayerId: string): void {
    const host = this.state.getPlayerByConnection(hostConnectionId);
    if (!host?.isHost) return;

    this.removePlayer(targetPlayerId);
  }

  // ============================================
  // HOST MANAGEMENT
  // ============================================

  /**
   * Reassign host to the first available player
   */
  private reassignHost(): void {
    const newHost = Array.from(this.state.players.values())[0];
    if (!newHost) return;

    // Clear old host flags
    this.state.players.forEach(player => {
      player.isHost = false;
    });

    // Set new host
    newHost.isHost = true;
    this.state.hostId = newHost.id;

    this.broadcast.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
    this.broadcast.broadcastHostChanged(newHost.id);
  }

  /**
   * Check if a player is the host
   */
  isHost(playerId: string): boolean {
    const player = this.state.players.get(playerId);
    return player?.isHost ?? false;
  }

  /**
   * Check if a connection belongs to the host
   */
  isHostConnection(connectionId: string): boolean {
    const player = this.state.getPlayerByConnection(connectionId);
    return player?.isHost ?? false;
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Sanitize a player name
   */
  private sanitizePlayerName(name: string): string {
    return name.trim().slice(0, GAME.MAX_NAME_LENGTH).replace(/[<>]/g, '');
  }

  /**
   * Generate a unique player ID
   */
  private generatePlayerId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
  }

  /**
   * Close all player connections
   */
  closeAllConnections(): void {
    this.state.players.forEach(player => {
      const conn = this.room.getConnection(player.connectionId);
      if (conn) conn.close();
    });
  }
}
