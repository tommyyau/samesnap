import type * as Party from "partykit/server";
import {
  RoomPhase, PlayerStatus, ServerPlayer, ClientPlayer,
  ClientRoomState, CardData, MultiplayerGameConfig, MatchAttempt,
  CardLayout, GameDuration
} from "../shared/types";
import { ClientMessage, ServerMessage, ERROR_CODES } from "../shared/protocol";
import { generateDeck } from "../shared/gameLogic";
import { getSymbolsForCardSet, DEFAULT_CARD_SET_ID } from "../shared/cardSets";

const PENALTY_DURATION = 3000;
const ARBITRATION_WINDOW_MS = 100;
const RECONNECT_GRACE_PERIOD = 5000;  // 5 seconds - quick reconnect for network glitches
const ROOM_TIMEOUT = 60000;  // 60 seconds to fill the room
const REJOIN_WINDOW_MS = 20000;  // 20 seconds to rejoin after game over
const MAX_MATCH_ATTEMPTS_PER_SECOND = 10;  // Rate limiting

// Input sanitization helper
function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, 50).replace(/[<>]/g, '');
}

export default class SameSnapRoom implements Party.Server {
  private phase: RoomPhase = RoomPhase.WAITING;
  private players: Map<string, ServerPlayer> = new Map();
  private connectionToPlayerId: Map<string, string> = new Map();
  private hostId: string | null = null;
  private fullDeck: CardData[] = [];  // Original deck for card lookups
  private centerCard: CardData | null = null;
  private config: MultiplayerGameConfig | null = null;
  private roundWinnerId: string | null = null;
  private roundMatchedSymbolId: number | null = null;
  private roundNumber: number = 0;  // For arbitration tracking
  private penalties: Map<string, number> = new Map();
  private pendingArbitration: {
    roundNumber: number;
    windowStart: number;
    attempts: MatchAttempt[];
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null = null;
  private disconnectedPlayers: Map<string, { disconnectedAt: number }> = new Map();
  private matchAttemptCounts: Map<string, { count: number; resetTime: number }> = new Map();

  // Room timeout tracking
  private roomExpiresAt: number | null = null;
  private roomTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Countdown timer tracking
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Round-end timer tracking (for next round transition)
  private roundEndTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Rejoin window tracking (after game over)
  private rejoinWindowTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private rejoinWindowEndsAt: number | null = null;
  private playersWantRematch: Set<string> = new Set();
  private lastGameEndReason: 'stack_emptied' | 'last_player_standing' = 'stack_emptied';
  private lastWinnerId: string | null = null;
  private lastWinnerName: string | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Check for reconnection
    const url = new URL(ctx.request.url);
    const reconnectId = url.searchParams.get('reconnectId');

    if (reconnectId && this.disconnectedPlayers.has(reconnectId)) {
      this.handleReconnection(conn, reconnectId);
      return;
    }
    // New connection - wait for join message
  }

  onClose(conn: Party.Connection) {
    const playerId = this.connectionToPlayerId.get(conn.id);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (!player) return;

    // Always give a short grace period for reconnection
    // This handles React StrictMode's unmount/remount cycle
    const gracePeriod = this.phase === RoomPhase.WAITING ? 2000 : RECONNECT_GRACE_PERIOD;

    player.status = PlayerStatus.DISCONNECTED;
    this.disconnectedPlayers.set(playerId, { disconnectedAt: Date.now() });
    this.connectionToPlayerId.delete(conn.id);
    this.broadcastToAll({ type: 'player_disconnected', payload: { playerId } });

    // During countdown, check if we still have enough connected players
    if (this.phase === RoomPhase.COUNTDOWN) {
      const connectedCount = this.getConnectedPlayerCount();
      // Minimum 2 players for multiplayer
      if (connectedCount < 2) {
        this.cancelCountdown();
      }
    }

    setTimeout(() => {
      if (this.disconnectedPlayers.has(playerId)) {
        this.removePlayer(playerId);
      }
    }, gracePeriod);
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: ClientMessage = JSON.parse(message);

      switch (msg.type) {
        case 'join':
          this.handleJoin(sender, msg.payload.playerName);
          break;
        case 'reconnect':
          this.handleReconnectMessage(sender, msg.payload.playerId);
          break;
        case 'set_config':
          this.handleSetConfig(sender, msg.payload.config);
          break;
        case 'start_game':
          this.handleStartGame(sender, msg.payload.config);
          break;
        case 'match_attempt':
          this.handleMatchAttempt(sender.id, msg.payload.symbolId, msg.payload.clientTimestamp);
          break;
        case 'leave': {
          const playerId = this.getPlayerIdByConnection(sender.id);
          if (playerId) {
            this.removePlayer(playerId);
          }
          break;
        }
        case 'kick_player':
          this.handleKickPlayer(sender.id, msg.payload.playerId);
          break;
        case 'ping': {
          const playerId = this.getPlayerIdByConnection(sender.id);
          if (playerId) {
            this.sendToPlayer(playerId, {
              type: 'pong',
              payload: { serverTimestamp: Date.now(), clientTimestamp: msg.payload.timestamp }
            });
          }
          break;
        }
        case 'play_again':
          this.handlePlayAgain(sender);
          break;
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  private handleJoin(conn: Party.Connection, playerName: string) {
    // Check if this connection is already associated with a player (e.g., from a prior reconnect)
    // This prevents duplicate players when reconnect succeeds but client also sent a fallback join
    const existingPlayerId = this.connectionToPlayerId.get(conn.id);
    if (existingPlayerId && this.players.has(existingPlayerId)) {
      // Already in the room - just send room state to sync them up
      this.sendRoomState(existingPlayerId);
      return;
    }

    // Check if room is full (max 8)
    if (this.players.size >= 8) {
      conn.send(JSON.stringify({
        type: 'error',
        payload: { code: ERROR_CODES.ROOM_FULL, message: 'Room is full' }
      }));
      return;
    }

    // Check if game in progress
    if (this.phase !== RoomPhase.WAITING) {
      // Allow joining during GAME_OVER if rejoin window has expired or no players are left
      // This lets the room code be reused after a game finishes
      const rejoinWindowExpired = this.phase === RoomPhase.GAME_OVER &&
        (!this.rejoinWindowEndsAt || Date.now() > this.rejoinWindowEndsAt);
      const noPlayersLeft = this.players.size === 0;

      if (rejoinWindowExpired || noPlayersLeft) {
        // Reset room state to allow fresh game
        this.resetRoomForNewGame();
      } else {
        conn.send(JSON.stringify({
          type: 'error',
          payload: { code: ERROR_CODES.GAME_IN_PROGRESS, message: 'Game already in progress' }
        }));
        return;
      }
    }

    // Sanitize and check for duplicate names
    const sanitizedName = sanitizePlayerName(playerName);
    const nameTaken = Array.from(this.players.values()).some(p => p.name === sanitizedName);
    const finalName = nameTaken ? `${sanitizedName} ${this.players.size + 1}` : sanitizedName;

    const isHost = this.players.size === 0;
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

    this.players.set(playerId, player);
    this.connectionToPlayerId.set(conn.id, playerId);

    if (isHost) {
      this.hostId = playerId;

      // Initialize default config
      this.config = {
        cardLayout: CardLayout.ORDERLY,
        cardSetId: DEFAULT_CARD_SET_ID,
        gameDuration: GameDuration.SHORT,
      };

      this.sendToPlayer(playerId, { type: 'you_are_host', payload: {} });

      // Start room timeout when first player joins
      // When timer expires, the room closes if the host hasn't started manually
      this.startRoomTimeout();
    } else {
      // Refresh room timeout when additional players join
      // This extends the deadline so late joiners don't cause expiration
      this.refreshRoomTimeout();
    }

    // Broadcast to others (per-connection so isYou stays accurate)
    this.broadcastPlayerJoined(player);

    // Send full state to new player
    this.sendRoomState(playerId);

    // No auto-start on join - host must click Start before the lobby timer expires
  }

  private startRoomTimeout() {
    if (this.roomTimeoutId) {
      clearTimeout(this.roomTimeoutId);
    }

    this.roomExpiresAt = Date.now() + ROOM_TIMEOUT;
    this.roomTimeoutId = setTimeout(() => {
      this.handleRoomExpired();
    }, ROOM_TIMEOUT);
  }

  // Refresh room timeout on player activity (joins, reconnects)
  // Only refreshes if still in WAITING phase
  private refreshRoomTimeout() {
    if (this.phase !== RoomPhase.WAITING) return;

    this.startRoomTimeout();

    // Broadcast updated roomExpiresAt to all players
    this.broadcastRoomState();
  }

  private handleRoomExpired() {
    if (this.phase !== RoomPhase.WAITING) return; // Don't expire if game started

    console.log(`[Room ${this.room.id}] Lobby timer expired before enough players joined`);

    this.broadcastToAll({
      type: 'room_expired',
      payload: { reason: 'Room timed out before the game started. Please create a new room.' }
    });

    // Close all connections to return everyone to the lobby
    for (const conn of this.room.getConnections()) {
      conn.close();
    }
  }

  private handleSetConfig(conn: Party.Connection, config: MultiplayerGameConfig) {
    const player = this.getPlayerByConnection(conn.id);
    if (!player) return;
    if (!player.isHost) {
      this.sendToPlayer(player.id, {
        type: 'error',
        payload: { code: ERROR_CODES.NOT_HOST, message: 'Only host can set config' }
      });
      return;
    }

    if (this.phase !== RoomPhase.WAITING && this.phase !== RoomPhase.GAME_OVER) {
      this.sendToPlayer(player.id, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Cannot change config while game in progress' }
      });
      return;
    }

    // Merge with defaults to ensure backward compatibility
    this.config = {
      cardLayout: config.cardLayout,
      cardSetId: config.cardSetId,
      gameDuration: config.gameDuration ?? this.config?.gameDuration ?? GameDuration.SHORT,
    };

    // Broadcast config to all players so UI stays in sync
    this.broadcastToAll({
      type: 'config_updated',
      payload: { config: this.config }
    });
  }

  private handleStartGame(conn: Party.Connection, config: MultiplayerGameConfig) {
    const player = this.getPlayerByConnection(conn.id);
    if (!player) return;
    if (!player.isHost) {
      this.sendToPlayer(player.id, {
        type: 'error',
        payload: { code: ERROR_CODES.NOT_HOST, message: 'Only host can start' }
      });
      return;
    }

    // Use connected count, not total players (disconnected players in grace period shouldn't count)
    const connectedCount = this.getConnectedPlayerCount();
    if (connectedCount < 2) {
      this.sendToPlayer(player.id, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Need at least 2 players' }
      });
      return;
    }

    // Merge with defaults to ensure backward compatibility
    this.config = {
      cardLayout: config.cardLayout,
      cardSetId: config.cardSetId,
      gameDuration: config.gameDuration ?? this.config?.gameDuration ?? GameDuration.SHORT,
    };
    this.startCountdown();
  }

  private startCountdown() {
    this.phase = RoomPhase.COUNTDOWN;
    let count = 5;  // 5-4-3-2-1 countdown

    // Cancel room timeout since game is starting
    if (this.roomTimeoutId) {
      clearTimeout(this.roomTimeoutId);
      this.roomTimeoutId = null;
    }
    this.roomExpiresAt = null;

    const tick = () => {
      // Guard: abort if we're no longer in countdown phase
      if (this.phase !== RoomPhase.COUNTDOWN) {
        this.countdownTimeoutId = null;
        return;
      }

      this.broadcastToAll({ type: 'countdown', payload: { seconds: count } });
      if (count > 0) {
        count--;
        this.countdownTimeoutId = setTimeout(tick, 1000);
      } else {
        this.countdownTimeoutId = null;
        // Guard: only start if we still have at least 2 connected players
        const connectedCount = this.getConnectedPlayerCount();
        if (connectedCount >= 2) {
          this.startGame();
        } else {
          // Not enough players, return to waiting
          this.phase = RoomPhase.WAITING;
          this.broadcastToAll({ type: 'countdown', payload: { seconds: -1 } }); // Signal countdown cancelled
          // Re-arm room timeout since we're back to waiting
          this.startRoomTimeout();
          // Broadcast fresh room_state so clients have updated phase and roomExpiresAt
          this.broadcastRoomState();
        }
      }
    };
    tick();
  }

  private cancelCountdown() {
    if (this.countdownTimeoutId) {
      clearTimeout(this.countdownTimeoutId);
      this.countdownTimeoutId = null;
    }
    if (this.phase === RoomPhase.COUNTDOWN) {
      this.phase = RoomPhase.WAITING;
      // Re-arm room timeout since we're back to waiting
      this.startRoomTimeout();
      // Notify clients that countdown was cancelled
      this.broadcastToAll({ type: 'countdown', payload: { seconds: -1 } });
      // Broadcast fresh room_state so clients have updated phase and roomExpiresAt
      this.broadcastRoomState();
    }
  }

  private startGame() {
    // Get symbols for the selected card set
    const cardSetId = this.config?.cardSetId ?? DEFAULT_CARD_SET_ID;
    const symbols = getSymbolsForCardSet(cardSetId);
    const generatedDeck = generateDeck(7, symbols);

    // Truncate deck based on game duration setting
    const gameDuration = this.config?.gameDuration ?? GameDuration.SHORT;
    const deckSize = Math.min(gameDuration, generatedDeck.length);
    this.fullDeck = generatedDeck.slice(0, deckSize);
    this.roundNumber = 0;
    this.penalties.clear();

    // Shuffle the deck
    const shuffledDeck = [...this.fullDeck];
    for (let i = shuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
    }

    // Card distribution: 1 to center, rest divided equally, extras discarded
    const playerCount = this.players.size;
    const cardsForPlayers = shuffledDeck.length - 1;  // -1 for center card
    const cardsPerPlayer = Math.floor(cardsForPlayers / playerCount);

    // Set center card first (pop from end)
    this.centerCard = shuffledDeck.pop() || null;

    // Deal stacks to players
    let cardIndex = 0;
    this.players.forEach(player => {
      player.cardStack = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        player.cardStack.push(shuffledDeck[cardIndex].id);
        cardIndex++;
      }
    });
    // Remaining cards (extras) are discarded - not used

    this.phase = RoomPhase.PLAYING;
    this.roundNumber = 1;

    // Send round_start to each player with their top card
    this.players.forEach((player, playerId) => {
      const topCardId = player.cardStack[0];
      const yourCard = this.getCardById(topCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: {
            centerCard: this.centerCard,
            yourCard,
            yourCardsRemaining: player.cardStack.length,
            allPlayersRemaining: this.getAllPlayersRemaining(),
            roundNumber: this.roundNumber
          }
        });
      }
    });
  }

  private getAllPlayersRemaining(): { playerId: string; cardsRemaining: number }[] {
    return Array.from(this.players.entries()).map(([id, p]) => ({
      playerId: id,
      cardsRemaining: p.cardStack.length
    }));
  }

  private handleMatchAttempt(connectionId: string, symbolId: number, clientTimestamp: number) {
    const playerId = this.connectionToPlayerId.get(connectionId);
    if (!playerId) return;
    const serverTimestamp = Date.now();

    // Validate symbolId
    if (typeof symbolId !== 'number' || !Number.isInteger(symbolId) || symbolId < 0 || symbolId >= 57) {
      console.error(`Invalid symbolId: ${symbolId} from ${playerId}`);
      return;
    }

    // Rate limiting
    if (!this.checkRateLimit(connectionId)) {
      console.warn(`Rate limited: ${connectionId}`);
      return;
    }

    if (this.phase !== RoomPhase.PLAYING) return;

    const player = this.players.get(playerId);
    if (!player || player.cardStack.length === 0) return;  // No cards = can't play

    // Check penalty
    const penaltyUntil = this.penalties.get(playerId);
    if (penaltyUntil && serverTimestamp < penaltyUntil) {
      this.sendToPlayer(playerId, {
        type: 'error',
        payload: { code: ERROR_CODES.IN_PENALTY, message: 'Wait for penalty' }
      });
      return;
    }

    // Validate match using TOP card of player's stack
    const topCardId = player.cardStack[0];
    const playerCard = this.getCardById(topCardId);
    if (!playerCard || !this.centerCard) return;

    const inPlayerHand = playerCard.symbols.some(s => s.id === symbolId);
    const inCenter = this.centerCard.symbols.some(s => s.id === symbolId);
    const isValid = inPlayerHand && inCenter;

    if (!isValid) {
      const until = serverTimestamp + PENALTY_DURATION;
      this.penalties.set(playerId, until);
      this.sendToPlayer(playerId, {
        type: 'penalty',
        payload: { serverTimestamp, durationMs: PENALTY_DURATION, reason: 'Wrong symbol' }
      });
      return;
    }

    // Valid match - add to arbitration
    const attempt: MatchAttempt = { playerId, symbolId, clientTimestamp, serverTimestamp, isValid: true };

    if (!this.pendingArbitration) {
      this.pendingArbitration = {
        roundNumber: this.roundNumber,
        windowStart: serverTimestamp,
        attempts: [attempt],
        timeoutId: setTimeout(() => this.resolveArbitration(), ARBITRATION_WINDOW_MS)
      };
    } else if (this.pendingArbitration.roundNumber === this.roundNumber) {
      this.pendingArbitration.attempts.push(attempt);
    }
  }

  private resolveArbitration() {
    if (!this.pendingArbitration) return;

    const { attempts } = this.pendingArbitration;
    this.pendingArbitration = null;

    if (attempts.length === 0) return;

    // Sort: server timestamp, then random (no client timestamp tie-breaker to avoid skew)
    attempts.sort((a, b) => {
      const serverDiff = a.serverTimestamp - b.serverTimestamp;
      if (serverDiff !== 0) return serverDiff;
      return Math.random() - 0.5;
    });

    const winner = attempts[0];
    this.processRoundWin(winner.playerId, winner.symbolId);
  }

  private processRoundWin(winnerId: string, symbolId: number) {
    const winner = this.players.get(winnerId);
    if (!winner) return;

    this.phase = RoomPhase.ROUND_END;
    this.roundWinnerId = winnerId;
    this.roundMatchedSymbolId = symbolId;

    // Winner's top card goes to center, remove from their stack
    const oldTopCardId = winner.cardStack.shift();
    if (oldTopCardId !== undefined) {
      this.centerCard = this.getCardById(oldTopCardId);
    }

    // Broadcast winner with updated cards remaining
    this.broadcastToAll({
      type: 'round_winner',
      payload: {
        winnerId,
        winnerName: winner.name,
        matchedSymbolId: symbolId,
        winnerCardsRemaining: winner.cardStack.length
      }
    });

    // Check for game over: winner has no cards left
    if (winner.cardStack.length === 0) {
      this.endGame('stack_emptied', winnerId, winner.name);
      return;
    }

    // After 2 seconds, next round (track timer so it can be cancelled if game ends early)
    this.roundEndTimeoutId = setTimeout(() => {
      this.roundEndTimeoutId = null;
      this.nextRound();
    }, 2000);
  }

  private nextRound() {
    // Guard: don't proceed if game has ended or we're not in ROUND_END phase
    if (this.phase !== RoomPhase.ROUND_END) return;
    if (!this.centerCard) return;

    this.roundNumber++;
    this.phase = RoomPhase.PLAYING;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;

    // Send new round to each player with their current top card
    this.players.forEach((player, playerId) => {
      if (player.cardStack.length === 0) return;  // Player already won (shouldn't happen)

      const topCardId = player.cardStack[0];
      const yourCard = this.getCardById(topCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: {
            centerCard: this.centerCard,
            yourCard,
            yourCardsRemaining: player.cardStack.length,
            allPlayersRemaining: this.getAllPlayersRemaining(),
            roundNumber: this.roundNumber
          }
        });
      }
    });
  }

  private endGame(
    reason: 'stack_emptied' | 'last_player_standing' = 'stack_emptied',
    winnerId?: string,
    winnerName?: string
  ) {
    // Clear any pending round-end timer to prevent nextRound from firing
    if (this.roundEndTimeoutId) {
      clearTimeout(this.roundEndTimeoutId);
      this.roundEndTimeoutId = null;
    }

    // Clear any pending arbitration
    if (this.pendingArbitration?.timeoutId) {
      clearTimeout(this.pendingArbitration.timeoutId);
      this.pendingArbitration = null;
    }

    // Clear all penalties
    this.penalties.clear();

    this.phase = RoomPhase.GAME_OVER;
    this.lastGameEndReason = reason;
    this.playersWantRematch.clear();

    // Final standings sorted by cards remaining (ascending - 0 is best)
    const finalStandings = Array.from(this.players.values())
      .map(p => ({ playerId: p.id, name: p.name, cardsRemaining: p.cardStack.length }))
      .sort((a, b) => a.cardsRemaining - b.cardsRemaining);

    // Determine winner (explicit or from standings)
    const actualWinnerId = winnerId || finalStandings[0]?.playerId;
    const actualWinnerName = winnerName || finalStandings[0]?.name || 'Unknown';
    this.lastWinnerId = actualWinnerId || null;
    this.lastWinnerName = actualWinnerName;

    // Start 10-second rejoin window
    this.rejoinWindowEndsAt = Date.now() + REJOIN_WINDOW_MS;
    this.rejoinWindowTimeoutId = setTimeout(() => {
      this.handleRejoinWindowExpired();
    }, REJOIN_WINDOW_MS);

    this.broadcastToAll({
      type: 'game_over',
      payload: {
        winnerId: actualWinnerId || '',
        winnerName: actualWinnerName,
        finalStandings,
        reason,
        rejoinWindowMs: REJOIN_WINDOW_MS
      }
    });
  }

  private endGameLastPlayerStanding() {
    console.log(`[Room ${this.room.id}] Last player standing triggered, phase=${this.phase}`);

    // Find the sole remaining player
    const survivor = Array.from(this.players.values())[0];
    if (!survivor) {
      console.log(`[Room ${this.room.id}] No survivor found, ending game`);
      this.endGame('last_player_standing');
      return;
    }

    // Survivor wins by default - set their stack to 0 (they "won")
    survivor.cardStack = [];

    console.log(`[Room ${this.room.id}] Survivor: ${survivor.name} (${survivor.id}) wins by last player standing`);

    this.endGame('last_player_standing', survivor.id, survivor.name);
  }

  private handlePlayAgain(conn: Party.Connection) {
    const playerId = this.connectionToPlayerId.get(conn.id);
    if (!playerId) return;
    const player = this.players.get(playerId);
    if (!player) return;

    // Only accept play_again during GAME_OVER phase
    if (this.phase !== RoomPhase.GAME_OVER) {
      this.sendToPlayer(playerId, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Cannot play again - game not in GAME_OVER phase' }
      });
      return;
    }

    // Check if rejoin window is still active
    if (!this.rejoinWindowEndsAt || Date.now() > this.rejoinWindowEndsAt) {
      this.sendToPlayer(playerId, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Rejoin window has expired' }
      });
      return;
    }

    // Add player to rematch set
    this.playersWantRematch.add(playerId);
    console.log(`[Room ${this.room.id}] Player ${player.name} wants rematch. Count: ${this.playersWantRematch.size}`);

    // Acknowledge to all players that this player wants rematch
    this.broadcastToAll({
      type: 'play_again_ack',
      payload: { playerId }
    });

    // If we have 2+ players wanting rematch, immediately proceed to reset
    // (Don't wait for the full 10s window)
    if (this.playersWantRematch.size >= 2) {
      console.log(`[Room ${this.room.id}] 2+ players want rematch, resetting room early`);
      this.handleRejoinWindowExpired();
    }
  }

  private handleRejoinWindowExpired() {
    // Clear the rejoin window timer if it's still running
    if (this.rejoinWindowTimeoutId) {
      clearTimeout(this.rejoinWindowTimeoutId);
      this.rejoinWindowTimeoutId = null;
    }
    this.rejoinWindowEndsAt = null;

    // Count connected players who want rematch
    const rematchPlayers = Array.from(this.playersWantRematch).filter(pid => {
      const player = this.players.get(pid);
      return player && player.status === PlayerStatus.CONNECTED;
    });

    console.log(`[Room ${this.room.id}] Rejoin window expired. Rematch players: ${rematchPlayers.length}`);

    // If no one wants rematch, close the room
    if (rematchPlayers.length === 0) {
      console.log(`[Room ${this.room.id}] No players want rematch, closing room`);
      this.broadcastToAll({
        type: 'room_expired',
        payload: { reason: 'No players rejoined after game over' }
      });
      // Close all connections
      for (const conn of this.room.getConnections()) {
        conn.close();
      }
      return;
    }

    // If only 1 player wants rematch, boot them with a message
    if (rematchPlayers.length === 1) {
      const soloPlayerId = rematchPlayers[0];
      console.log(`[Room ${this.room.id}] Only 1 player (${soloPlayerId}) rejoined, booting them`);

      this.sendToPlayer(soloPlayerId, {
        type: 'solo_rejoin_boot',
        payload: { message: "You're the only one who rejoined. Please create a new room or wait for friends." }
      });

      // Boot the solo player
      const player = this.players.get(soloPlayerId);
      if (player) {
        const conn = this.room.getConnection(player.connectionId);
        if (conn) {
          setTimeout(() => conn.close(), 100); // Small delay to ensure message is sent
        }
      }
      return;
    }

    // 2+ players want rematch - reset the room
    console.log(`[Room ${this.room.id}] ${rematchPlayers.length} players want rematch, resetting room`);
    this.resetRoom(rematchPlayers);
  }

  // Reset room to fresh state for a completely new game (when someone joins an expired room)
  private resetRoomForNewGame() {
    // Clear rejoin timer if running
    if (this.rejoinWindowTimeoutId) {
      clearTimeout(this.rejoinWindowTimeoutId);
      this.rejoinWindowTimeoutId = null;
    }

    // Close all existing connections and clear players
    for (const [playerId, player] of this.players) {
      const conn = this.room.getConnection(player.connectionId);
      if (conn) conn.close();
    }
    this.players.clear();
    this.connectionToPlayerId.clear();
    this.disconnectedPlayers.clear();

    // Reset all game state
    this.phase = RoomPhase.WAITING;
    this.hostId = null;
    this.fullDeck = [];
    this.centerCard = null;
    this.config = null;
    this.roundNumber = 0;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;
    this.penalties.clear();
    this.pendingArbitration = null;
    this.playersWantRematch.clear();
    this.rejoinWindowEndsAt = null;
    this.lastGameEndReason = 'stack_emptied';
    this.lastWinnerId = null;
    this.lastWinnerName = null;

    // Clear room timeout - will be set when first player joins
    if (this.roomTimeoutId) {
      clearTimeout(this.roomTimeoutId);
      this.roomTimeoutId = null;
    }
    this.roomExpiresAt = null;

    console.log(`[Room ${this.room.id}] Room completely reset for new game`);
  }

  private resetRoom(keepPlayerIds: string[]) {
    // Remove players who didn't opt for rematch
    const playersToRemove: string[] = [];
    for (const [playerId] of this.players) {
      if (!keepPlayerIds.includes(playerId)) {
        playersToRemove.push(playerId);
      }
    }
    for (const pid of playersToRemove) {
      const player = this.players.get(pid);
      if (player) {
        const conn = this.room.getConnection(player.connectionId);
        if (conn) conn.close();
        this.players.delete(pid);
        this.connectionToPlayerId.delete(player.connectionId);
      }
    }

    // Reset game state
    this.phase = RoomPhase.WAITING;
    this.fullDeck = [];
    this.centerCard = null;
    this.roundNumber = 0;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;
    this.penalties.clear();
    this.pendingArbitration = null;
    this.disconnectedPlayers.clear();
    this.playersWantRematch.clear();
    this.rejoinWindowEndsAt = null;

    // Reset player state (clear card stacks)
    for (const [playerId, player] of this.players) {
      player.cardStack = [];
    }

    // Ensure we have a host
    if (!this.hostId || !this.players.has(this.hostId)) {
      const firstPlayer = Array.from(this.players.values())[0];
      if (firstPlayer) {
        this.players.forEach(p => { p.isHost = false; });
        firstPlayer.isHost = true;
        this.hostId = firstPlayer.id;
        this.sendToPlayer(firstPlayer.id, { type: 'you_are_host', payload: {} });
      }
    }

    // Re-arm room timeout
    this.startRoomTimeout();

    // Broadcast room_reset and fresh room_state to all remaining players
    this.broadcastToAll({ type: 'room_reset', payload: {} });
    this.broadcastRoomState();

    console.log(`[Room ${this.room.id}] Room reset complete. ${this.players.size} players in waiting room`);
  }

  private handleKickPlayer(hostConnectionId: string, targetPlayerId: string) {
    const host = this.getPlayerByConnection(hostConnectionId);
    if (!host?.isHost) return;
    this.removePlayer(targetPlayerId);
  }

  private removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.disconnectedPlayers.delete(playerId);
    this.connectionToPlayerId.delete(player.connectionId);

    this.broadcastToAll({
      type: 'player_left',
      payload: { playerId, playerName: player.name }
    });

    // Reassign host if needed
    if (player.isHost && this.players.size > 0) {
      const newHost = Array.from(this.players.values())[0];
      this.players.forEach(p => {
        p.isHost = p.id === newHost.id;
      });
      this.hostId = newHost.id;
      this.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
      this.broadcastToAll({
        type: 'host_changed',
        payload: { playerId: newHost.id }
      });
    } else if (this.players.size === 0) {
      this.hostId = null;
    }

    // Remove from playersWantRematch if they were in it
    this.playersWantRematch.delete(playerId);

    // Check if countdown should be cancelled or game should end
    if (this.players.size < 2) {
      if (this.phase === RoomPhase.COUNTDOWN) {
        this.cancelCountdown();
      } else if (this.phase === RoomPhase.PLAYING || this.phase === RoomPhase.ROUND_END) {
        // Last player standing - award remaining deck cards and end game
        this.endGameLastPlayerStanding();
      } else if (this.phase !== RoomPhase.WAITING && this.phase !== RoomPhase.GAME_OVER) {
        this.endGame();
      }
    }
  }

  private handleReconnection(conn: Party.Connection, playerId: string) {
    if (!this.disconnectedPlayers.has(playerId)) return;
    this.disconnectedPlayers.delete(playerId);

    const player = this.players.get(playerId);
    if (!player) return;

    player.connectionId = conn.id;
    player.status = PlayerStatus.CONNECTED;
    player.lastSeen = Date.now();

    this.connectionToPlayerId.set(conn.id, playerId);

    if (player.isHost) this.hostId = playerId;

    this.broadcastToAll({ type: 'player_reconnected', payload: { playerId } });

    // Refresh room timeout when player reconnects during WAITING phase
    // This extends the deadline for active players
    // NOTE: Must be called BEFORE sendRoomState so client gets updated roomExpiresAt
    this.refreshRoomTimeout();

    this.sendRoomState(playerId);
  }

  // Handle reconnect message (alternative to URL-based reconnection)
  // This allows mid-session reconnects when the socket URL can't be changed dynamically
  private handleReconnectMessage(conn: Party.Connection, playerId: string) {
    // Check if this is a valid reconnection attempt
    if (this.disconnectedPlayers.has(playerId)) {
      // Valid reconnection - use the same logic as URL-based reconnection
      this.handleReconnection(conn, playerId);
    } else if (this.players.has(playerId)) {
      // Player exists and is connected - this might be a duplicate connection
      // Just send the room state to sync them up
      const player = this.players.get(playerId);
      if (player) {
        // Update connection mapping
        this.connectionToPlayerId.delete(player.connectionId);
        player.connectionId = conn.id;
        this.connectionToPlayerId.set(conn.id, playerId);
        this.sendRoomState(playerId);
      }
    } else {
      // Unknown player ID - reject with error
      // Note: Don't close connection - client may send fresh join to recover
      conn.send(JSON.stringify({
        type: 'error',
        payload: { code: ERROR_CODES.PLAYER_NOT_FOUND, message: 'Cannot reconnect - player not found or session expired' }
      }));
    }
  }

  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    const entry = this.matchAttemptCounts.get(connectionId);

    if (!entry || now > entry.resetTime) {
      this.matchAttemptCounts.set(connectionId, { count: 1, resetTime: now + 1000 });
      return true;
    }

    if (entry.count >= MAX_MATCH_ATTEMPTS_PER_SECOND) {
      return false; // Rate limited
    }

    entry.count++;
    return true;
  }

  private getCardById(cardId: number | null): CardData | null {
    if (cardId === null || cardId < 0) return null;
    return this.fullDeck.find(c => c.id === cardId) || null;
  }

  private toClientPlayer(player: ServerPlayer, forPlayerId: string): ClientPlayer {
    return {
      id: player.id,
      name: player.name,
      status: player.status,
      cardsRemaining: player.cardStack.length,
      isHost: player.isHost,
      isYou: player.id === forPlayerId,
    };
  }

  private getPenaltyRemainingMs(playerId: string): number | undefined {
    const penaltyUntil = this.penalties.get(playerId);
    if (!penaltyUntil) return undefined;
    const remaining = penaltyUntil - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  private sendRoomState(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    // Get player's top card (if they have one)
    const topCardId = player.cardStack.length > 0 ? player.cardStack[0] : null;

    const state: ClientRoomState = {
      roomCode: this.room.id,
      phase: this.phase,
      players: Array.from(this.players.values()).map(p => this.toClientPlayer(p, playerId)),
      config: this.config,
      centerCard: this.centerCard,
      yourCard: this.getCardById(topCardId),
      roundWinnerId: this.roundWinnerId,
      roundWinnerName: this.roundWinnerId ? this.players.get(this.roundWinnerId)?.name || null : null,
      roundMatchedSymbolId: this.roundMatchedSymbolId,
      penaltyRemainingMs: this.getPenaltyRemainingMs(playerId),
      roomExpiresAt: this.roomExpiresAt || undefined,
      roomExpiresInMs: this.roomExpiresAt ? Math.max(0, this.roomExpiresAt - Date.now()) : undefined,
      gameEndReason: this.phase === RoomPhase.GAME_OVER ? this.lastGameEndReason : undefined,
      rejoinWindowEndsAt: this.rejoinWindowEndsAt || undefined,
      playersWantRematch: this.playersWantRematch.size > 0 ? Array.from(this.playersWantRematch) : undefined,
    };

    this.sendToPlayer(playerId, { type: 'room_state', payload: state });
  }

  private broadcastRoomState() {
    // Send personalized room_state to each connected player
    for (const [playerId, player] of this.players) {
      if (player.status === PlayerStatus.CONNECTED) {
        this.sendRoomState(playerId);
      }
    }
  }

  private getConnectedPlayerCount(): number {
    return Array.from(this.players.values())
      .filter(p => p.status === PlayerStatus.CONNECTED).length;
  }

  private getPlayerIdByConnection(connectionId: string): string | null {
    return this.connectionToPlayerId.get(connectionId) || null;
  }

  private getPlayerByConnection(connectionId: string): ServerPlayer | null {
    const playerId = this.getPlayerIdByConnection(connectionId);
    if (!playerId) return null;
    return this.players.get(playerId) || null;
  }

  private generatePlayerId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
  }

  private sendToPlayer(playerId: string, message: ServerMessage) {
    const player = this.players.get(playerId);
    if (!player) return;
    const conn = this.room.getConnection(player.connectionId);
    if (conn) conn.send(JSON.stringify(message));
  }

  private broadcastToAll(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }

  private broadcastPlayerJoined(player: ServerPlayer) {
    for (const conn of this.room.getConnections()) {
      const targetPlayerId = this.connectionToPlayerId.get(conn.id);
      if (!targetPlayerId) continue;
      conn.send(JSON.stringify({
        type: 'player_joined',
        payload: { player: this.toClientPlayer(player, targetPlayerId) }
      }));
    }
  }
}
