import { SymbolItem } from './types';

// We need 57 distinct symbols for a standard order-7 Dobble deck (8 symbols per card)
export const EMOJIS: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', 
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦟', '🦗', '🕷', '🕸', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓'
];

export const SYMBOLS: SymbolItem[] = EMOJIS.map((char, index) => ({
  id: index,
  char,
  name: `Symbol ${index}`
}));

export const CARD_SIZE_LG = 320; // px
export const CARD_SIZE_MD = 200; // px
export const CARD_SIZE_SM = 100; // px

export const PENALTY_DURATION = 3000; // ms

// Bot reaction times in ms (min, max)
export const BOT_SPEEDS = {
  EASY: [5000, 10000],
  MEDIUM: [3000, 7000],
  HARD: [1500, 4000],
};