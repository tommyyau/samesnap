/**
 * StateManager - Centralized state for the multiplayer room
 *
 * Single source of truth for all room state. All services read from
 * and write to this manager, ensuring consistent state access.
 */

import {
  RoomPhase,
  PlayerStatus,
  ServerPlayer,
  CardData,
  MultiplayerGameConfig,
  CardLayout,
  GameDuration,
} from '../../shared/types';
import { DEFAULT_CARD_SET_ID } from '../../shared/cardSets';
import {
  DisconnectedPlayerInfo,
  RateLimitEntry,
  GAME,
} from '../types/internal';

export class StateManager {
  // ============================================
  // ROOM STATE
  // ============================================

  phase: RoomPhase = RoomPhase.WAITING;
  hostId: string | null = null;
  config: MultiplayerGameConfig | null = null;

  /** Timestamp when room expires (lobby timeout) */
  roomExpiresAt: number | null = null;

  // ============================================
  // PLAYER STATE
  // ============================================

  /** All players in the room (including disconnected) */
  players: Map<string, ServerPlayer> = new Map();

  /** Maps connection IDs to player IDs */
  connectionToPlayerId: Map<string, string> = new Map();

  /** Players currently disconnected (within grace period) */
  disconnectedPlayers: Map<string, DisconnectedPlayerInfo> = new Map();

  // ============================================
  // GAME STATE
  // ============================================

  /** Full deck for card lookups (original order preserved) */
  fullDeck: CardData[] = [];

  /** Current center card */
  centerCard: CardData | null = null;

  /** Current round number */
  roundNumber: number = 0;

  /** Winner of the current/last round */
  roundWinnerId: string | null = null;

  /** Symbol that was matched in current/last round */
  roundMatchedSymbolId: number | null = null;

  // ============================================
  // PENALTY & RATE LIMITING
  // ============================================

  /** Player ID -> penalty end timestamp */
  penalties: Map<string, number> = new Map();

  /** Connection ID -> rate limit tracking */
  matchAttemptCounts: Map<string, RateLimitEntry> = new Map();

  // ============================================
  // COUNTDOWN STATE
  // ============================================

  /** Current countdown value (null if not counting down) */
  currentCountdown: number | null = null;

  // ============================================
  // REMATCH STATE
  // ============================================

  /** Players who want to play again */
  playersWantRematch: Set<string> = new Set();

  /** When rejoin window expires after game over */
  rejoinWindowEndsAt: number | null = null;

  /** How the last game ended */
  lastGameEndReason: 'stack_emptied' | 'last_player_standing' = 'stack_emptied';

  /** Last game winner info */
  lastWinnerId: string | null = null;
  lastWinnerName: string | null = null;

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get count of currently connected players
   */
  getConnectedPlayerCount(): number {
    return Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.CONNECTED).length;
  }

  /**
   * Get player ID by connection ID
   */
  getPlayerIdByConnection(connectionId: string): string | null {
    return this.connectionToPlayerId.get(connectionId) || null;
  }

  /**
   * Get player by connection ID
   */
  getPlayerByConnection(connectionId: string): ServerPlayer | null {
    const playerId = this.getPlayerIdByConnection(connectionId);
    if (!playerId) return null;
    return this.players.get(playerId) || null;
  }

  /**
   * Get card by ID from full deck
   */
  getCardById(cardId: number | null): CardData | null {
    if (cardId === null || cardId < 0) return null;
    return this.fullDeck.find(c => c.id === cardId) || null;
  }

  /**
   * Get all players' remaining card counts
   */
  getAllPlayersRemaining(): { playerId: string; cardsRemaining: number }[] {
    return Array.from(this.players.entries()).map(([id, p]) => ({
      playerId: id,
      cardsRemaining: p.cardStack.length,
    }));
  }

  /**
   * Check if a player name is already taken
   */
  isNameTaken(name: string): boolean {
    return Array.from(this.players.values()).some(p => p.name === name);
  }

  /**
   * Check if room is full
   */
  isRoomFull(): boolean {
    return this.players.size >= GAME.MAX_PLAYERS;
  }

  /**
   * Check if we have enough players to start
   */
  hasEnoughPlayers(): boolean {
    return this.getConnectedPlayerCount() >= GAME.MIN_PLAYERS;
  }

  /**
   * Initialize default config (called when first player joins)
   */
  initializeDefaultConfig(): void {
    this.config = {
      cardLayout: CardLayout.ORDERLY,
      cardSetId: DEFAULT_CARD_SET_ID,
      gameDuration: GameDuration.SHORT,
    };
  }

  // ============================================
  // RESET METHODS
  // ============================================

  /**
   * Reset game state for a new game (keeping players)
   */
  resetGameState(): void {
    this.fullDeck = [];
    this.centerCard = null;
    this.roundNumber = 0;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;
    this.penalties.clear();
    this.playersWantRematch.clear();
    this.rejoinWindowEndsAt = null;
    this.currentCountdown = null;

    // Reset player card stacks
    this.players.forEach(player => {
      player.cardStack = [];
    });
  }

  /**
   * Full room reset (for completely new game)
   */
  resetAll(): void {
    this.phase = RoomPhase.WAITING;
    this.hostId = null;
    this.config = null;
    this.roomExpiresAt = null;

    this.players.clear();
    this.connectionToPlayerId.clear();
    this.disconnectedPlayers.clear();

    this.resetGameState();
    this.matchAttemptCounts.clear();

    this.lastGameEndReason = 'stack_emptied';
    this.lastWinnerId = null;
    this.lastWinnerName = null;
  }
}
