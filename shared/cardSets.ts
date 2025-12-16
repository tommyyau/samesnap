import { CardSet, SymbolItem } from './types';
import { SYMBOLS, SYMBOLS_HARD, SYMBOLS_INSANE } from '../constants';

// Built-in card sets (non-editable)
export const BUILT_IN_CARD_SETS: CardSet[] = [
  {
    id: 'children',
    name: "Children's",
    description: 'Friendly animals and objects - perfect for young players',
    symbols: SYMBOLS,
    isBuiltIn: true,
  },
  {
    id: 'mixed',
    name: 'Mixed',
    description: 'Themed groups of fruits, creatures, weather, and more',
    symbols: SYMBOLS_HARD,
    isBuiltIn: true,
  },
  {
    id: 'smiley',
    name: 'Smiley Faces',
    description: 'All yellow faces - extremely challenging!',
    symbols: SYMBOLS_INSANE,
    isBuiltIn: true,
  },
];

// Default card set ID
export const DEFAULT_CARD_SET_ID = 'children';

// Helper to get a card set by ID
export function getCardSetById(id: string): CardSet | undefined {
  // First check built-in sets
  const builtIn = BUILT_IN_CARD_SETS.find(set => set.id === id);
  if (builtIn) return builtIn;

  // Future: Check custom sets from localStorage/Supabase here
  return undefined;
}

// Get symbols for a card set (with fallback to default)
export function getSymbolsForCardSet(cardSetId: string): SymbolItem[] {
  const cardSet = getCardSetById(cardSetId);
  return cardSet?.symbols ?? SYMBOLS;
}
