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

// Insane mode emojis - exactly 57 yellow smiley faces with different expressions
// This is brutally difficult since all symbols are the same color and shape!
export const EMOJIS_INSANE: string[] = [
  // Happy grins (8)
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  // Smiling/winking (8)
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  // Kissing/tongue (8)
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
  // Gesture faces (8)
  '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '🤥',
  // Neutral/unamused (8)
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😌',
  // Tired/unwell (8)
  '😔', '😪', '🤤', '😴', '😷', '🥴', '😵', '🥱',
  // Accessorized + crying (9)
  '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😢', '😭'
];

export const SYMBOLS_INSANE: SymbolItem[] = EMOJIS_INSANE.map((char, index) => ({
  id: index,
  char,
  name: `InsaneSymbol ${index}`
}));

export const BOT_NAMES = ['Holly', 'Sophie', 'Abi', 'Rob', 'Anthony', 'Tommy', 'Olinda', 'Kimberley', 'Alice', 'Chris'];

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