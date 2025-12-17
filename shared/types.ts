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

// DEPRECATED: Use CardLayout + CardSet instead
// Kept temporarily for backwards compatibility during migration
export enum CardDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  INSANE = 'INSANE',
}

// New: Card Layout (visual arrangement only)
export enum CardLayout {
  ORDERLY = 'ORDERLY',   // 1 center + 7 in circle
  CHAOTIC = 'CHAOTIC',   // Physics-based random placement
}

// New: Card Set definition
export interface CardSet {
  id: string;            // Unique identifier (e.g., 'children', 'mixed', 'smiley')
  name: string;          // Display name (e.g., "Children's")
  description: string;   // Short description for UI
  symbols: SymbolItem[]; // The actual symbols array (must have 57 items)
  isBuiltIn: boolean;    // true for system sets, false for custom
}

export enum GameDuration {
  SHORT = 10,   // 10 cards - quick game
  MEDIUM = 25,  // 25 cards - medium game
  LONG = 50,    // 50 cards - full game
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
  connectionId: string;
  name: string;
  status: PlayerStatus;
  cardStack: number[];  // Array of card IDs, top card at index 0
  isHost: boolean;
  joinedAt: number;
  lastSeen: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  status: PlayerStatus;
  cardsRemaining: number;  // Cards left in player's stack (0 = winner)
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
  cardLayout: CardLayout;
  cardSetId: string;
  gameDuration: GameDuration;
  /** Custom symbols (57 emoji chars) - sent when using a custom card set */
  customSymbols?: string[];
  /** Custom set name - for display purposes */
  customSetName?: string;
}

export interface ClientRoomState {
  roomCode: string;
  phase: RoomPhase;
  players: ClientPlayer[];
  config: MultiplayerGameConfig | null;
  centerCard: CardData | null;
  yourCard: CardData | null;
  roundWinnerId: string | null;
  roundWinnerName: string | null;
  roundMatchedSymbolId: number | null;
  countdown?: number;
  penaltyUntil?: number;      // Client-side computed: when penalty ends (local clock)
  penaltyRemainingMs?: number; // Server-sent: remaining penalty duration in ms (clock-skew safe)
  roomExpiresAt?: number;     // DEPRECATED: Timestamp when room expires (use roomExpiresInMs)
  roomExpiresInMs?: number;   // Duration until room expires in ms (clock-skew safe)
  gameEndReason?: 'stack_emptied' | 'last_player_standing';  // Why the game ended
  rejoinWindowEndsAt?: number; // Timestamp when rejoin window ends (10s after game_over)
  playersWantRematch?: string[]; // IDs of players who clicked "Play Again"
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
  VICTORY_CELEBRATION = 'VICTORY_CELEBRATION',
  GAME_OVER = 'GAME_OVER',
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  cardStack: CardData[];  // Array of cards, top card at index 0
}

export interface GameConfig {
  playerName: string;
  botCount: number;
  difficulty: Difficulty;
  cardLayout: CardLayout;
  cardSetId: string;
  gameDuration: GameDuration;
  /** Custom symbols (57 emoji chars) - sent when using a custom card set */
  customSymbols?: string[];
  /** Custom set name - for display purposes */
  customSetName?: string;
}

// ============================================
// USER STATS TYPES
// ============================================

export type GameMode = 'singleplayer' | 'multiplayer';
export type WinReason = 'stack_emptied' | 'last_player_standing';

/** Stats for a single game mode (single-player or multiplayer) */
export interface ModeStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestStreak: number;
  fastestWinMs: number | null;  // null if never won
}

/** User stats stored in Vercel KV at key stats:{userId} */
export interface UserStats {
  singlePlayer: ModeStats;
  multiplayer: ModeStats;
  lastActivityAt: number;   // Unix timestamp (ms)
  createdAt: number;        // Unix timestamp (ms)
  updatedAt: number;        // Unix timestamp (ms)
}

/** Game context recorded with each game result */
export interface GameContext {
  botDifficulty?: Difficulty;  // Single-player only
  cardLayout: CardLayout;
  cardSetId: string;
  cardSetName: string;
  playerCount: number;
}

/** Payload sent to POST /api/stats to record a game result */
export interface RecordGamePayload {
  mode: GameMode;
  isWin: boolean;
  winReason?: WinReason;
  gameDurationMs: number;
  context: GameContext;
}

/** Default stats for new users */
export const DEFAULT_MODE_STATS: ModeStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  longestStreak: 0,
  fastestWinMs: null,
};

export const DEFAULT_USER_STATS: UserStats = {
  singlePlayer: { ...DEFAULT_MODE_STATS },
  multiplayer: { ...DEFAULT_MODE_STATS },
  lastActivityAt: 0,
  createdAt: 0,
  updatedAt: 0,
};
