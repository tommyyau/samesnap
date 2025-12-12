import { SymbolItem } from './types';

// We need 57 distinct symbols for a standard order-7 Dobble deck (8 symbols per card)
// We provide >57 to be safe.
export const EMOJIS: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', 
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦟', '🦗', '🕷', '🕸', '🐢', '🐍', '🦎',
  '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓',
  // Extras to ensure pool > 57
  '🍎', '🎱', '🚗', '🚀', '🎨', '🎮', '🏰', '🏝️', '💎', '🌮'
];

export const SYMBOLS: SymbolItem[] = EMOJIS.map((char, index) => ({
  id: index,
  char,
  name: `Symbol ${index}`
}));

// Hard mode emojis - visually similar symbols grouped by theme
export const EMOJIS_HARD: string[] = [
  // Fruits (similar colors, different shapes)
  '🍎', '🍓', '🍒', '🍉', '🍇', '🫐', '🍊', '🍋',
  // Sea creatures (same theme, distinct shapes)
  '🐙', '🦑', '🦐', '🦀', '🐚', '🐠', '🐡', '🦈',
  // Insects & small creatures
  '🐝', '🦋', '🐞', '🐜', '🐌', '🦂', '🕷️', '🪲',
  // Weather & sky
  '☀️', '🌙', '⭐', '☁️', '🌧️', '❄️', '🌪️', '🌈',
  // Musical & entertainment
  '🎸', '🎺', '🎷', '🥁', '🎹', '🎤', '🎧', '🎬',
  // Tools & objects
  '🔨', '🔧', '✂️', '📎', '🔑', '🔒', '💡', '🔔',
  // Food items (varied)
  '🍕', '🌮', '🍔', '🌭', '🍟', '🧁', '🍩',
  // Bonus to reach 57
  '⚡', '💎'
];

export const SYMBOLS_HARD: SymbolItem[] = EMOJIS_HARD.map((char, index) => ({
  id: index,
  char,
  name: `HardSymbol ${index}`
}));

export const BOT_NAMES = ['Holly', 'Sophie', 'Abi', 'Rob', 'Anthony', 'Tommy', 'Olinda', 'Kimberley', 'Alice'];

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