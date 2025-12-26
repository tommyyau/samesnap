import { CardData, ClientRoomState, MultiplayerGameConfig, ClientPlayer, SoCloseEntry } from './types';

// ============================================
// CLIENT -> SERVER MESSAGES
// ============================================

export type ClientMessage =
  | { type: 'join'; payload: { playerName: string } }
  | { type: 'reconnect'; payload: { playerId: string } }  // Reconnect with known player ID
  | { type: 'set_config'; payload: { config: MultiplayerGameConfig } }  // Host sets room config
  | { type: 'start_game'; payload: { config: MultiplayerGameConfig } }
  | { type: 'match_attempt'; payload: { symbolId: number; clientTimestamp: number } }
  | { type: 'leave'; payload: Record<string, never> }
  | { type: 'kick_player'; payload: { playerId: string } }
  | { type: 'ping'; payload: { timestamp: number } }
  | { type: 'play_again'; payload: Record<string, never> };  // Request to stay for rematch

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
  | { type: 'round_start'; payload: { centerCard: CardData; yourCard: CardData; yourCardsRemaining: number; allPlayersRemaining: { playerId: string; cardsRemaining: number }[]; roundNumber: number } }
  | { type: 'round_winner'; payload: { winnerId: string; winnerName: string; matchedSymbolId: number; winnerCardsRemaining: number } }
  | { type: 'game_over'; payload: { winnerId: string; winnerName: string; finalStandings: { playerId: string; name: string; cardsRemaining: number }[]; reason?: 'stack_emptied' | 'last_player_standing'; rejoinWindowMs?: number } }
  | { type: 'penalty'; payload: { serverTimestamp: number; durationMs: number; reason: string } }
  | { type: 'room_expired'; payload: { reason: string } }  // Room timed out
  | { type: 'host_changed'; payload: { playerId: string } }
  | { type: 'error'; payload: { code: string; message: string } }
  | { type: 'pong'; payload: { serverTimestamp: number; clientTimestamp: number } }
  | { type: 'you_are_host'; payload: Record<string, never> }
  | { type: 'play_again_ack'; payload: { playerId: string } }  // Acknowledge player wants rematch
  | { type: 'solo_rejoin_boot'; payload: { message: string } }  // Only one player rejoined, booting them
  | { type: 'room_reset'; payload: Record<string, never> }  // Room has been reset for new game
  | { type: 'so_close_reveal'; payload: { entries: SoCloseEntry[] } };  // Show "So Close" leaderboard

// ============================================
// ERROR CODES
// ============================================

export const ERROR_CODES = {
  ROOM_FULL: 'ROOM_FULL',
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  GAME_IN_PROGRESS: 'GAME_IN_PROGRESS',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  NOT_HOST: 'NOT_HOST',
  INVALID_STATE: 'INVALID_STATE',
  INVALID_MATCH: 'INVALID_MATCH',
  IN_PENALTY: 'IN_PENALTY',
  NAME_TAKEN: 'NAME_TAKEN',
} as const;
