import { CardData, ClientRoomState, MultiplayerGameConfig, ClientPlayer } from './types';

// ============================================
// CLIENT -> SERVER MESSAGES
// ============================================

export type ClientMessage =
  | { type: 'join'; payload: { playerName: string } }
  | { type: 'set_config'; payload: { config: MultiplayerGameConfig } }  // Host sets room config
  | { type: 'start_game'; payload: { config: MultiplayerGameConfig } }
  | { type: 'match_attempt'; payload: { symbolId: number; clientTimestamp: number } }
  | { type: 'leave'; payload: Record<string, never> }
  | { type: 'kick_player'; payload: { playerId: string } }
  | { type: 'ping'; payload: { timestamp: number } };

// ============================================
// SERVER -> CLIENT MESSAGES
// ============================================

export type ServerMessage =
  | { type: 'room_state'; payload: ClientRoomState }
  | { type: 'player_joined'; payload: { player: ClientPlayer } }
  | { type: 'player_left'; payload: { playerId: string; playerName: string } }
  | { type: 'player_disconnected'; payload: { playerId: string } }
  | { type: 'player_reconnected'; payload: { playerId: string } }
  | { type: 'config_updated'; payload: { config: MultiplayerGameConfig } }  // Config changed by host
  | { type: 'countdown'; payload: { seconds: number } }
  | { type: 'round_start'; payload: { centerCard: CardData; yourCard: CardData; roundNumber: number } }
  | { type: 'round_winner'; payload: { winnerId: string; winnerName: string; matchedSymbolId: number } }
  | { type: 'game_over'; payload: { finalScores: { playerId: string; name: string; score: number }[] } }
  | { type: 'match_result'; payload: { success: boolean; reason?: string } }
  | { type: 'penalty'; payload: { until: number; reason: string } }
  | { type: 'room_expired'; payload: { reason: string } }  // Room timed out
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong'; payload: { serverTimestamp: number; clientTimestamp: number } }
  | { type: 'you_are_host'; payload: Record<string, never> };

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  ROOM_FULL: 'ROOM_FULL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  NOT_HOST: 'NOT_HOST',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_MATCH: 'INVALID_MATCH',
  IN_PENALTY: 'IN_PENALTY',
  NAME_TAKEN: 'NAME_TAKEN',
} as const;
