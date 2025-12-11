import type * as Party from "partykit/server";
import {
  RoomPhase, PlayerStatus, ServerPlayer, ClientPlayer,
  ClientRoomState, CardData, MultiplayerGameConfig, MatchAttempt
} from "../shared/types";
import { ClientMessage, ServerMessage, ERROR_CODES } from "../shared/protocol";
import { generateDeck, SYMBOLS } from "../shared/gameLogic";

const PENALTY_DURATION = 3000;
const ARBITRATION_WINDOW_MS = 100;
const RECONNECT_GRACE_PERIOD = 60000;

export default class SameSnapRoom implements Party.Server {
  private phase: RoomPhase = RoomPhase.WAITING;
  private players: Map<string, ServerPlayer> = new Map();
  private hostId: string | null = null;
  private deck: CardData[] = [];
  private fullDeck: CardData[] = [];
  private centerCard: CardData | null = null;
  private config: MultiplayerGameConfig | null = null;
  private roundNumber: number = 0;
  private roundWinnerId: string | null = null;
  private roundMatchedSymbolId: number | null = null;
  private penalties: Map<string, number> = new Map();
  private pendingArbitration: {
    roundNumber: number;
    windowStart: number;
    attempts: MatchAttempt[];
    timeoutId: ReturnType<typeof setTimeout> | null;
  } | null = null;
  private disconnectedPlayers: Map<string, { player: ServerPlayer; disconnectedAt: number }> = new Map();

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
    const player = this.players.get(conn.id);
    if (!player) return;

    if (this.phase === RoomPhase.WAITING) {
      this.removePlayer(conn.id);
    } else {
      // During game - mark disconnected
      player.status = PlayerStatus.DISCONNECTED;
      this.disconnectedPlayers.set(conn.id, { player, disconnectedAt: Date.now() });
      this.broadcastToAll({ type: 'player_disconnected', payload: { playerId: conn.id } });

      setTimeout(() => {
        if (this.disconnectedPlayers.has(conn.id)) {
          this.removePlayer(conn.id);
        }
      }, RECONNECT_GRACE_PERIOD);
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: ClientMessage = JSON.parse(message);

      switch (msg.type) {
        case 'join':
          this.handleJoin(sender, msg.payload.playerName);
          break;
        case 'start_game':
          this.handleStartGame(sender, msg.payload.config);
          break;
        case 'match_attempt':
          this.handleMatchAttempt(sender.id, msg.payload.symbolId, msg.payload.clientTimestamp);
          break;
        case 'leave':
          this.removePlayer(sender.id);
          break;
        case 'kick_player':
          this.handleKickPlayer(sender.id, msg.payload.playerId);
          break;
        case 'ping':
          this.sendToPlayer(sender.id, {
            type: 'pong',
            payload: { serverTimestamp: Date.now(), clientTimestamp: msg.payload.timestamp }
          });
          break;
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  }

  private handleJoin(conn: Party.Connection, playerName: string) {
    // Check if room is full (max 8)
    if (this.players.size >= 8) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.ROOM_FULL, message: 'Room is full' }
      });
      return;
    }

    // Check if game in progress
    if (this.phase !== RoomPhase.WAITING) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.GAME_IN_PROGRESS, message: 'Game already in progress' }
      });
      return;
    }

    // Check for duplicate names
    const nameTaken = Array.from(this.players.values()).some(p => p.name === playerName);
    const finalName = nameTaken ? `${playerName} ${this.players.size + 1}` : playerName;

    const isHost = this.players.size === 0;
    const player: ServerPlayer = {
      id: conn.id,
      name: finalName,
      status: PlayerStatus.CONNECTED,
      score: 0,
      handCardId: null,
      isHost,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    };

    this.players.set(conn.id, player);
    if (isHost) {
      this.hostId = conn.id;
      this.sendToPlayer(conn.id, { type: 'you_are_host', payload: {} });
    }

    // Broadcast to others
    this.broadcastToAll({
      type: 'player_joined',
      payload: { player: this.toClientPlayer(player, conn.id) }
    });

    // Send full state to new player
    this.sendRoomState(conn.id);
  }

  private handleStartGame(conn: Party.Connection, config: MultiplayerGameConfig) {
    const player = this.players.get(conn.id);
    if (!player?.isHost) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.NOT_HOST, message: 'Only host can start' }
      });
      return;
    }

    if (this.players.size < 2) {
      this.sendToPlayer(conn.id, {
        type: 'error',
        payload: { code: ERROR_CODES.INVALID_STATE, message: 'Need at least 2 players' }
      });
      return;
    }

    this.config = config;
    this.startCountdown();
  }

  private startCountdown() {
    this.phase = RoomPhase.COUNTDOWN;
    let count = 3;

    const tick = () => {
      this.broadcastToAll({ type: 'countdown', payload: { seconds: count } });
      if (count > 0) {
        count--;
        setTimeout(tick, 1000);
      } else {
        this.startGame();
      }
    };
    tick();
  }

  private startGame() {
    this.fullDeck = generateDeck();
    this.deck = [...this.fullDeck];
    this.roundNumber = 0;
    this.penalties.clear();

    // Deal cards to players
    this.players.forEach(player => {
      const card = this.deck.pop();
      if (card) player.handCardId = card.id;
      player.score = 0;
    });

    // Set center card
    this.centerCard = this.deck.pop() || null;
    this.phase = RoomPhase.PLAYING;
    this.roundNumber = 1;

    // Send round_start to each player with their personal card
    this.players.forEach((player, playerId) => {
      const yourCard = this.getCardById(player.handCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: { centerCard: this.centerCard, yourCard, roundNumber: this.roundNumber }
        });
      }
    });
  }

  private handleMatchAttempt(playerId: string, symbolId: number, clientTimestamp: number) {
    const serverTimestamp = Date.now();

    if (this.phase !== RoomPhase.PLAYING) return;

    const player = this.players.get(playerId);
    if (!player || player.handCardId === null) return;

    // Check penalty
    const penaltyUntil = this.penalties.get(playerId);
    if (penaltyUntil && serverTimestamp < penaltyUntil) {
      this.sendToPlayer(playerId, {
        type: 'error',
        payload: { code: ERROR_CODES.IN_PENALTY, message: 'Wait for penalty' }
      });
      return;
    }

    // Validate match
    const playerCard = this.getCardById(player.handCardId);
    if (!playerCard || !this.centerCard) return;

    const inPlayerHand = playerCard.symbols.some(s => s.id === symbolId);
    const inCenter = this.centerCard.symbols.some(s => s.id === symbolId);
    const isValid = inPlayerHand && inCenter;

    if (!isValid) {
      const until = serverTimestamp + PENALTY_DURATION;
      this.penalties.set(playerId, until);
      this.sendToPlayer(playerId, {
        type: 'penalty',
        payload: { until, reason: 'Wrong symbol' }
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

    // Sort: server timestamp, then client timestamp, then random
    attempts.sort((a, b) => {
      const serverDiff = a.serverTimestamp - b.serverTimestamp;
      if (serverDiff !== 0) return serverDiff;
      const clientDiff = a.clientTimestamp - b.clientTimestamp;
      if (clientDiff !== 0) return clientDiff;
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
    winner.score += 1;

    // Broadcast winner
    this.broadcastToAll({
      type: 'round_winner',
      payload: { winnerId, winnerName: winner.name, matchedSymbolId: symbolId }
    });

    // After 2 seconds, next round
    setTimeout(() => this.nextRound(winnerId), 2000);
  }

  private nextRound(lastWinnerId: string) {
    const winner = this.players.get(lastWinnerId);
    if (!winner || !this.centerCard) return;

    // Winner's hand becomes the old center card
    const oldCenterId = this.centerCard.id;

    // Draw new center
    if (this.deck.length === 0) {
      this.endGame();
      return;
    }

    winner.handCardId = oldCenterId;
    this.centerCard = this.deck.pop() || null;
    this.roundNumber++;
    this.phase = RoomPhase.PLAYING;
    this.roundWinnerId = null;
    this.roundMatchedSymbolId = null;

    // Send new round to each player
    this.players.forEach((player, playerId) => {
      const yourCard = this.getCardById(player.handCardId);
      if (yourCard && this.centerCard) {
        this.sendToPlayer(playerId, {
          type: 'round_start',
          payload: { centerCard: this.centerCard, yourCard, roundNumber: this.roundNumber }
        });
      }
    });
  }

  private endGame() {
    this.phase = RoomPhase.GAME_OVER;
    const finalScores = Array.from(this.players.values())
      .map(p => ({ playerId: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    this.broadcastToAll({ type: 'game_over', payload: { finalScores } });
  }

  private handleKickPlayer(hostId: string, targetId: string) {
    const host = this.players.get(hostId);
    if (!host?.isHost) return;
    this.removePlayer(targetId);
  }

  private removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.disconnectedPlayers.delete(playerId);

    this.broadcastToAll({
      type: 'player_left',
      payload: { playerId, playerName: player.name }
    });

    // Reassign host if needed
    if (player.isHost && this.players.size > 0) {
      const newHost = Array.from(this.players.values())[0];
      newHost.isHost = true;
      this.hostId = newHost.id;
      this.sendToPlayer(newHost.id, { type: 'you_are_host', payload: {} });
    }

    // Check if game should end
    if (this.phase !== RoomPhase.WAITING && this.players.size < 2) {
      this.endGame();
    }
  }

  private handleReconnection(conn: Party.Connection, oldId: string) {
    const data = this.disconnectedPlayers.get(oldId);
    if (!data) return;

    this.disconnectedPlayers.delete(oldId);
    const player = { ...data.player, id: conn.id, status: PlayerStatus.CONNECTED };
    this.players.delete(oldId);
    this.players.set(conn.id, player);

    if (player.isHost) this.hostId = conn.id;

    this.broadcastToAll({ type: 'player_reconnected', payload: { playerId: conn.id } });
    this.sendRoomState(conn.id);
  }

  private getCardById(cardId: number | null): CardData | null {
    if (cardId === null) return null;
    return this.fullDeck.find(c => c.id === cardId) || null;
  }

  private toClientPlayer(player: ServerPlayer, forPlayerId: string): ClientPlayer {
    return {
      id: player.id,
      name: player.name,
      status: player.status,
      score: player.score,
      hasCard: player.handCardId !== null,
      isHost: player.isHost,
      isYou: player.id === forPlayerId,
    };
  }

  private sendRoomState(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    const state: ClientRoomState = {
      roomCode: this.room.id,
      phase: this.phase,
      players: Array.from(this.players.values()).map(p => this.toClientPlayer(p, playerId)),
      config: this.config,
      deckRemaining: this.deck.length,
      centerCard: this.centerCard,
      yourCard: this.getCardById(player.handCardId),
      roundWinnerId: this.roundWinnerId,
      roundWinnerName: this.roundWinnerId ? this.players.get(this.roundWinnerId)?.name || null : null,
      roundMatchedSymbolId: this.roundMatchedSymbolId,
      roundNumber: this.roundNumber,
      penaltyUntil: this.penalties.get(playerId),
    };

    this.sendToPlayer(playerId, { type: 'room_state', payload: state });
  }

  private sendToPlayer(playerId: string, message: ServerMessage) {
    const conn = this.room.getConnection(playerId);
    if (conn) conn.send(JSON.stringify(message));
  }

  private broadcastToAll(message: ServerMessage) {
    this.room.broadcast(JSON.stringify(message));
  }
}
