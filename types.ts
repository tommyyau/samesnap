export interface SymbolItem {
  id: number;
  char: string;
  name: string;
}

export interface CardData {
  id: number;
  symbols: SymbolItem[];
}

export enum GameState {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  ROUND_ANIMATION = 'ROUND_ANIMATION', // New state for the 2s pause
  GAME_OVER = 'GAME_OVER',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum CardDifficulty {
  EASY = 'EASY',     // Orderly, fixed positions
  MEDIUM = 'MEDIUM', // Chaotic, random sizes/positions
  HARD = 'HARD',     // Chaotic layout + tricky similar-looking symbols
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
  cardDifficulty: CardDifficulty; // New config option
}