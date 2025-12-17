/**
 * BroadcastService - Messaging and state synchronization
 *
 * Handles all outgoing messages to clients, including:
 * - Individual player messages
 * - Room-wide broadcasts
 * - State serialization for clients
 */

import type * as Party from 'partykit/server';
import {
  RoomPhase,
  PlayerStatus,
  ServerPlayer,
  ClientPlayer,
  ClientRoomState,
} from '../../shared/types';
import { ServerMessage, ERROR_CODES } from '../../shared/protocol';
import type { StateManager } from './StateManager';

export class BroadcastService {
  constructor(
    private room: Party.Room,
    private state: StateManager
  ) {}

  // ============================================
  // INDIVIDUAL MESSAGES
  // ============================================

  /**
   * Send a message to a specific player by ID
   */
  sendToPlayer(playerId: string, message: ServerMessage): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    const conn = this.room.getConnection(player.connectionId);
    if (conn) {
      conn.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message directly to a connection
   */
  sendToConnection(conn: Party.Connection, message: ServerMessage): void {
    conn.send(JSON.stringify(message));
  }

  /**
   * Send an error to a specific player
   */
  sendError(playerId: string, code: string, message: string): void {
    this.sendToPlayer(playerId, {
      type: 'error',
      payload: { code, message },
    });
  }

  /**
   * Send an error directly to a connection
   */
  sendErrorToConnection(conn: Party.Connection, code: string, message: string): void {
    this.sendToConnection(conn, {
      type: 'error',
      payload: { code, message },
    });
  }

  // ============================================
  // BROADCASTS
  // ============================================

  /**
   * Broadcast a message to all connected clients
   */
  broadcastToAll(message: ServerMessage): void {
    this.room.broadcast(JSON.stringify(message));
  }

  /**
   * Broadcast that a player joined (personalized isYou for each recipient)
   */
  broadcastPlayerJoined(player: ServerPlayer): void {
    Array.from(this.room.getConnections()).forEach(conn => {
      const targetPlayerId = this.state.connectionToPlayerId.get(conn.id);
      if (!targetPlayerId) return;

      conn.send(JSON.stringify({
        type: 'player_joined',
        payload: { player: this.toClientPlayer(player, targetPlayerId) },
      }));
    });
  }

  // ============================================
  // STATE SYNCHRONIZATION
  // ============================================

  /**
   * Send full room state to a specific player
   */
  sendRoomState(playerId: string): void {
    const player = this.state.players.get(playerId);
    if (!player) return;

    const clientState = this.buildClientRoomState(playerId);
    this.sendToPlayer(playerId, { type: 'room_state', payload: clientState });
  }

  /**
   * Broadcast room state to all connected players (personalized per player)
   */
  broadcastRoomState(): void {
    this.state.players.forEach((player, playerId) => {
      if (player.status === PlayerStatus.CONNECTED) {
        this.sendRoomState(playerId);
      }
    });
  }

  // ============================================
  // TRANSFORMATIONS
  // ============================================

  /**
   * Transform ServerPlayer to ClientPlayer (hiding internal data)
   */
  toClientPlayer(player: ServerPlayer, forPlayerId: string): ClientPlayer {
    return {
      id: player.id,
      name: player.name,
      status: player.status,
      cardsRemaining: player.cardStack.length,
      isHost: player.isHost,
      isYou: player.id === forPlayerId,
    };
  }

  /**
   * Build full client room state for a specific player
   */
  buildClientRoomState(forPlayerId: string): ClientRoomState {
    const player = this.state.players.get(forPlayerId);

    // Get player's top card if they have one
    const topCardId = player && player.cardStack.length > 0
      ? player.cardStack[0]
      : null;

    // Get penalty remaining for this player
    const penaltyUntil = this.state.penalties.get(forPlayerId);
    const penaltyRemainingMs = penaltyUntil
      ? Math.max(0, penaltyUntil - Date.now())
      : undefined;

    return {
      roomCode: this.room.id,
      phase: this.state.phase,
      players: Array.from(this.state.players.values())
        .map(p => this.toClientPlayer(p, forPlayerId)),
      config: this.state.config,
      centerCard: this.state.centerCard,
      yourCard: this.state.getCardById(topCardId),
      roundWinnerId: this.state.roundWinnerId,
      roundWinnerName: this.state.roundWinnerId
        ? this.state.players.get(this.state.roundWinnerId)?.name || null
        : null,
      roundMatchedSymbolId: this.state.roundMatchedSymbolId,
      penaltyRemainingMs: penaltyRemainingMs && penaltyRemainingMs > 0
        ? penaltyRemainingMs
        : undefined,
      roomExpiresAt: this.state.roomExpiresAt || undefined,
      roomExpiresInMs: this.state.roomExpiresAt
        ? Math.max(0, this.state.roomExpiresAt - Date.now())
        : undefined,
      countdown: this.state.currentCountdown ?? undefined,
      gameEndReason: this.state.phase === RoomPhase.GAME_OVER
        ? this.state.lastGameEndReason
        : undefined,
      rejoinWindowEndsAt: this.state.rejoinWindowEndsAt || undefined,
      playersWantRematch: this.state.playersWantRematch.size > 0
        ? Array.from(this.state.playersWantRematch)
        : undefined,
    };
  }

  // ============================================
  // SPECIFIC BROADCASTS
  // ============================================

  /**
   * Broadcast countdown tick
   */
  broadcastCountdown(seconds: number): void {
    this.broadcastToAll({ type: 'countdown', payload: { seconds } });
  }

  /**
   * Broadcast that countdown was cancelled
   */
  broadcastCountdownCancelled(): void {
    this.broadcastToAll({ type: 'countdown', payload: { seconds: -1 } });
  }

  /**
   * Broadcast round winner
   */
  broadcastRoundWinner(
    winnerId: string,
    winnerName: string,
    matchedSymbolId: number,
    winnerCardsRemaining: number
  ): void {
    this.broadcastToAll({
      type: 'round_winner',
      payload: { winnerId, winnerName, matchedSymbolId, winnerCardsRemaining },
    });
  }

  /**
   * Broadcast game over
   */
  broadcastGameOver(
    winnerId: string,
    winnerName: string,
    finalStandings: { playerId: string; name: string; cardsRemaining: number }[],
    reason: 'stack_emptied' | 'last_player_standing',
    rejoinWindowMs: number
  ): void {
    this.broadcastToAll({
      type: 'game_over',
      payload: { winnerId, winnerName, finalStandings, reason, rejoinWindowMs },
    });
  }

  /**
   * Broadcast room expired
   */
  broadcastRoomExpired(reason: string): void {
    this.broadcastToAll({ type: 'room_expired', payload: { reason } });
  }

  /**
   * Broadcast config updated
   */
  broadcastConfigUpdated(): void {
    if (this.state.config) {
      this.broadcastToAll({
        type: 'config_updated',
        payload: { config: this.state.config },
      });
    }
  }

  /**
   * Broadcast host changed
   */
  broadcastHostChanged(newHostId: string): void {
    this.broadcastToAll({ type: 'host_changed', payload: { playerId: newHostId } });
  }

  /**
   * Broadcast player left
   */
  broadcastPlayerLeft(playerId: string, playerName: string): void {
    this.broadcastToAll({
      type: 'player_left',
      payload: { playerId, playerName },
    });
  }

  /**
   * Broadcast player disconnected
   */
  broadcastPlayerDisconnected(playerId: string): void {
    this.broadcastToAll({ type: 'player_disconnected', payload: { playerId } });
  }

  /**
   * Broadcast player reconnected
   */
  broadcastPlayerReconnected(playerId: string): void {
    this.broadcastToAll({ type: 'player_reconnected', payload: { playerId } });
  }

  /**
   * Broadcast room reset
   */
  broadcastRoomReset(): void {
    this.broadcastToAll({ type: 'room_reset', payload: {} });
  }

  /**
   * Broadcast play again acknowledgement
   */
  broadcastPlayAgainAck(playerId: string): void {
    this.broadcastToAll({ type: 'play_again_ack', payload: { playerId } });
  }
}
