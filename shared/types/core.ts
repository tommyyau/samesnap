// ============================================
// CORE TYPES (shared by both client and server)
// ============================================

export interface SymbolItem {
  id: number;
  char: string; // Emoji character (empty string for PNG-only sets)
  name: string; // Human-readable name (used for alt text)
  imageUrl?: string; // Optional PNG path (relative to public folder)
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

// Card Layout (visual arrangement only)
export enum CardLayout {
  ORDERLY = 'ORDERLY', // 1 center + 7 in circle
  CHAOTIC = 'CHAOTIC', // Physics-based random placement
}

// Card Set definition
export interface CardSet {
  id: string; // Unique identifier (e.g., 'children', 'mixed', 'smiley')
  name: string; // Display name (e.g., "Children's")
  description: string; // Short description for UI
  symbols: SymbolItem[]; // The actual symbols array (must have 57 items)
  isBuiltIn: boolean; // true for system sets, false for custom
}

export enum GameDuration {
  SHORT = 10, // 10 cards - quick game
  MEDIUM = 25, // 25 cards - medium game
  LONG = 50, // 50 cards - full game
}
