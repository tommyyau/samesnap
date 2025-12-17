// ============================================
// SINGLE-PLAYER TYPES
// ============================================

import { CardData, CardLayout, GameDuration } from './core';

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
  cardStack: CardData[]; // Array of cards, top card at index 0
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
