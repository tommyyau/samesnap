// ============================================
// SHARED TYPES (used by both client and server)
// ============================================

// Re-export existing types
export interface SymbolItem {
  id: number;
  char: string;
  name: string;
}

export interface CardData {
  id: number;
  symbols: SymbolItem[];
}

export enum CardDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
}

// ============================================
// MULTIPLAYER TYPES
// ============================================

export enum RoomPhase {
  WAITING = 'waiting',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  ROUND_END = 'round_end',
  GAME_OVER = 'game_over',
}

export enum PlayerStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  LEFT = 'left',
}

export interface ServerPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  score: number;
  handCardId: number | null;
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  score: number;
  hasCard: boolean;
  isHost: boolean;
  isYou: boolean;
}

export interface MatchAttempt {
  playerId: string;
  symbolId: number;
  clientTimestamp: number;
  serverTimestamp: number;
  isValid: boolean;
}

export interface MultiplayerGameConfig {
  cardDifficulty: CardDifficulty;
  maxPlayers: number;
}

export interface ClientRoomState {
  roomCode: string;
  phase: RoomPhase;
  players: ClientPlayer[];
  config: MultiplayerGameConfig | null;
  deckRemaining: number;
  centerCard: CardData | null;
  yourCard: CardData | null;
  roundWinnerId: string | null;
  roundWinnerName: string | null;
  roundMatchedSymbolId: number | null;
  roundNumber: number;
  countdown?: number;
  penaltyUntil?: number;
}

// Single-player types (keep existing)
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum GameState {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  ROUND_ANIMATION = 'ROUND_ANIMATION',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  hand: CardData | null;
  collectedCards: number;
}

export interface GameConfig {
  playerName: string;
  botCount: number;
  difficulty: Difficulty;
  cardDifficulty: CardDifficulty;
}
