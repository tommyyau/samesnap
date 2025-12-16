// Re-export all types from shared/types.ts for backwards compatibility
export {
  type SymbolItem,
  type CardData,
  GameState,
  Difficulty,
  CardDifficulty,  // DEPRECATED: Use CardLayout + CardSet instead
  CardLayout,
  type CardSet,
  GameDuration,
  type Player,
  type GameConfig,
  // Multiplayer types
  RoomPhase,
  PlayerStatus,
  type ServerPlayer,
  type ClientPlayer,
  type MatchAttempt,
  type MultiplayerGameConfig,
  type ClientRoomState,
} from './shared/types';