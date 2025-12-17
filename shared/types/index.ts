// Re-export all types for backwards compatibility
// Existing imports like `from '../shared/types'` will continue to work

// Core types
export {
  SymbolItem,
  CardData,
  CardDifficulty,
  CardLayout,
  CardSet,
  GameDuration,
} from './core';

// Single-player types
export { Difficulty, GameState, Player, GameConfig } from './singleplayer';

// Multiplayer types
export {
  RoomPhase,
  PlayerStatus,
  ServerPlayer,
  ClientPlayer,
  MatchAttempt,
  MultiplayerGameConfig,
  ClientRoomState,
} from './multiplayer';

// Stats types
export {
  GameMode,
  WinReason,
  ModeStats,
  UserStats,
  GameContext,
  RecordGamePayload,
  DEFAULT_MODE_STATS,
  DEFAULT_USER_STATS,
} from './stats';
