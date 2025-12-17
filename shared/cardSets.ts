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
    id: 'christmas',
    name: 'Christmas',
    description: 'Festive holiday themed symbols',
    symbols: SYMBOLS_HARD,
    isBuiltIn: true,
  },
  {
    id: 'smiley',
    name: 'Insanity',
    description: 'All yellow faces - extremely challenging!',
    symbols: SYMBOLS_INSANE,
    isBuiltIn: true,
  },
];

// Default card set ID
export const DEFAULT_CARD_SET_ID = 'children';

// Get only built-in card sets
export function getBuiltInCardSets(): CardSet[] {
  return BUILT_IN_CARD_SETS;
}

// Helper to get a built-in card set by ID
// Note: For custom sets, use the customSymbols from GameConfig instead
export function getCardSetById(id: string): CardSet | undefined {
  return BUILT_IN_CARD_SETS.find(set => set.id === id);
}

// Get symbols for a built-in card set (with fallback to default)
// Note: For custom sets, use the customSymbols from GameConfig instead
export function getSymbolsForCardSet(cardSetId: string): SymbolItem[] {
  const cardSet = getCardSetById(cardSetId);
  return cardSet?.symbols ?? SYMBOLS;
}
