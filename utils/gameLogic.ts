import { CardData, SymbolItem } from '../types';
import { SYMBOLS } from '../constants';

// Generate a deck for Dobble (Projective Plane of Order N)
// Number of symbols per card = N + 1
// Total cards = N^2 + N + 1
// Total symbols needed = N^2 + N + 1
// NOTE: N must be prime for this modular arithmetic construction to work.
export const generateDeck = (n: number = 7, symbols: SymbolItem[] = SYMBOLS): CardData[] => {
  const cards: number[][] = [];
  const totalSymbolsNeeded = n * n + n + 1;

  if (symbols.length < totalSymbolsNeeded) {
    console.error(`CRITICAL ERROR: Not enough symbols defined! Need ${totalSymbolsNeeded}, have ${symbols.length}`);
  }

  // 1. Generate the first N+1 cards (The horizon)
  for (let i = 0; i <= n; i++) {
    const card: number[] = [0]; // First symbol is always 0 for this set
    for (let j = 0; j < n; j++) {
      card.push((j + 1) + (i * n));
    }
    cards.push(card);
  }

  // 2. Generate the remaining N^2 cards
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const card: number[] = [i + 1]; // First symbol is from the first set
      for (let k = 0; k < n; k++) {
        const val = n + 1 + n * k + (i * k + j) % n;
        card.push(val);
      }
      cards.push(card);
    }
  }

  // Map indices to actual SymbolItems
  const deck: CardData[] = cards.map((cardIndices, index) => ({
    id: index,
    symbols: cardIndices.map(idx => {
       // Safety fallback if we don't have enough symbols defined
       return symbols[idx % symbols.length];
    })
  }));

  // SAFETY CHECK: Verify the deck satisfies the "Spot It" property
  // Every pair of cards must match on EXACTLY ONE symbol.
  validateDeckIntegrity(deck);

  // Shuffle the deck
  return shuffle(deck);
};

export const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Check if two cards match on a specific symbol ID
export const checkMatch = (cardA: CardData, cardB: CardData, symbolId: number): boolean => {
  const hasInA = cardA.symbols.some(s => s.id === symbolId);
  const hasInB = cardB.symbols.some(s => s.id === symbolId);
  return hasInA && hasInB;
};

// Find the matching symbol between two cards (helper for Bots)
export const findMatch = (cardA: CardData, cardB: CardData): SymbolItem | undefined => {
  for (const symA of cardA.symbols) {
    if (cardB.symbols.some(symB => symB.id === symA.id)) {
      return symA;
    }
  }
  return undefined;
};

// Internal validation helper
const validateDeckIntegrity = (deck: CardData[]) => {
  let errors = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const cardA = deck[i];
      const cardB = deck[j];
      
      // Count common symbols
      const common = cardA.symbols.filter(sa => 
        cardB.symbols.some(sb => sb.id === sa.id)
      );

      if (common.length !== 1) {
        console.error(`Deck Integrity Error: Cards ${i} and ${j} have ${common.length} matches (Expected 1).`, common);
        errors++;
      }
    }
  }
  if (errors === 0) {
    console.log(`Deck Integrity Verified: ${deck.length} cards, all pairs have exactly 1 match.`);
  } else {
    console.error(`Deck Generation FAILED with ${errors} integrity errors.`);
  }
};