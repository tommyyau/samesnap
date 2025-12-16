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
    name: 'Smiley Faces',
    description: 'All yellow faces - extremely challenging!',
    symbols: SYMBOLS_INSANE,
    isBuiltIn: true,
  },
];

// Default card set ID
export const DEFAULT_CARD_SET_ID = 'children';

// Check if we're in a browser environment (has localStorage)
const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// Get custom card sets from localStorage (client-side only)
function getCustomCardSetsFromStorage(): CardSet[] {
  if (!isBrowser) return [];

  try {
    const data = localStorage.getItem('samesnap_custom_cardsets');
    if (!data) return [];

    const stored = JSON.parse(data) as Array<{
      id: string;
      name: string;
      symbols: string[];
    }>;

    return stored.map(s => ({
      id: s.id,
      name: s.name,
      description: `Custom set with ${s.symbols.length} symbols`,
      symbols: s.symbols.map((char, index) => ({
        id: index,
        char,
        name: `Symbol ${index + 1}`,
      })),
      isBuiltIn: false,
    }));
  } catch {
    return [];
  }
}

// Helper to get a card set by ID
export function getCardSetById(id: string): CardSet | undefined {
  // First check built-in sets
  const builtIn = BUILT_IN_CARD_SETS.find(set => set.id === id);
  if (builtIn) return builtIn;

  // Check custom sets from localStorage (client-side only)
  const customSets = getCustomCardSetsFromStorage();
  const custom = customSets.find(set => set.id === id);
  if (custom) return custom;

  return undefined;
}

// Get all card sets (built-in + custom)
export function getAllCardSets(): CardSet[] {
  return [...BUILT_IN_CARD_SETS, ...getCustomCardSetsFromStorage()];
}

// Get symbols for a card set (with fallback to default)
export function getSymbolsForCardSet(cardSetId: string): SymbolItem[] {
  const cardSet = getCardSetById(cardSetId);
  return cardSet?.symbols ?? SYMBOLS;
}
