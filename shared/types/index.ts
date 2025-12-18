// Re-export all types for backwards compatibility
// Existing imports like `from '../shared/types'` will continue to work

// Core types
export type {
  SymbolItem,
  CardData,
  CardSet,
} from './core';

export {
  CardDifficulty,
  CardLayout,
  GameDuration,
} from './core';

// Single-player types
export type { Player, GameConfig } from './singleplayer';
export { Difficulty, GameState } from './singleplayer';

// Multiplayer types
export type {
  ServerPlayer,
  ClientPlayer,
  MatchAttempt,
  MultiplayerGameConfig,
  ClientRoomState,
} from './multiplayer';

export {
  RoomPhase,
  PlayerStatus,
} from './multiplayer';

// Stats types
export type {
  GameMode,
  WinReason,
  ModeStats,
  UserStats,
  GameContext,
  RecordGamePayload,
} from './stats';

export {
  DEFAULT_MODE_STATS,
  DEFAULT_USER_STATS,
} from './stats';
