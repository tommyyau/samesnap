import { CardSet, SymbolItem } from '../shared/types';

const STORAGE_KEY = 'samesnap_custom_cardsets';

// Stored format (minimal, just emoji chars)
interface StoredCardSet {
  id: string;
  name: string;
  symbols: string[]; // Just emoji characters
  createdAt: number;
  updatedAt: number;
}

// Generate a simple unique ID
function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert stored format to full CardSet
function storedToCardSet(stored: StoredCardSet): CardSet {
  const symbols: SymbolItem[] = stored.symbols.map((char, index) => ({
    id: index,
    char,
    name: `Symbol ${index + 1}`,
  }));

  return {
    id: stored.id,
    name: stored.name,
    description: `Custom set with ${stored.symbols.length} symbols`,
    symbols,
    isBuiltIn: false,
  };
}

// Convert CardSet to stored format
function cardSetToStored(cardSet: CardSet): StoredCardSet {
  return {
    id: cardSet.id,
    name: cardSet.name,
    symbols: cardSet.symbols.map(s => s.char),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Get all stored card sets (raw format)
function getStoredCardSets(): StoredCardSet[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as StoredCardSet[];
  } catch {
    console.error('Failed to parse custom card sets from localStorage');
    return [];
  }
}

// Save all stored card sets
function saveStoredCardSets(sets: StoredCardSet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch (e) {
    console.error('Failed to save custom card sets to localStorage', e);
  }
}

// ============================================
// Public API
// ============================================

/**
 * Get all custom card sets as full CardSet objects
 */
export function getCustomCardSets(): CardSet[] {
  return getStoredCardSets().map(storedToCardSet);
}

/**
 * Get a custom card set by ID
 */
export function getCustomCardSetById(id: string): CardSet | undefined {
  const stored = getStoredCardSets().find(s => s.id === id);
  return stored ? storedToCardSet(stored) : undefined;
}

/**
 * Create a new custom card set
 * @param name Display name for the set
 * @param symbols Array of exactly 57 emoji characters
 * @returns The created CardSet, or null if validation fails
 */
export function createCustomCardSet(name: string, symbols: string[]): CardSet | null {
  // Validate
  if (!name.trim()) {
    console.error('Card set name is required');
    return null;
  }
  if (symbols.length !== 57) {
    console.error(`Card set must have exactly 57 symbols, got ${symbols.length}`);
    return null;
  }
  const uniqueSymbols = new Set(symbols);
  if (uniqueSymbols.size !== 57) {
    console.error('Card set has duplicate symbols');
    return null;
  }

  const stored: StoredCardSet = {
    id: generateId(),
    name: name.trim(),
    symbols,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const allSets = getStoredCardSets();
  allSets.push(stored);
  saveStoredCardSets(allSets);

  return storedToCardSet(stored);
}

/**
 * Update an existing custom card set
 * @returns The updated CardSet, or null if not found or validation fails
 */
export function updateCustomCardSet(id: string, name: string, symbols: string[]): CardSet | null {
  // Validate
  if (!name.trim()) {
    console.error('Card set name is required');
    return null;
  }
  if (symbols.length !== 57) {
    console.error(`Card set must have exactly 57 symbols, got ${symbols.length}`);
    return null;
  }
  const uniqueSymbols = new Set(symbols);
  if (uniqueSymbols.size !== 57) {
    console.error('Card set has duplicate symbols');
    return null;
  }

  const allSets = getStoredCardSets();
  const index = allSets.findIndex(s => s.id === id);
  if (index === -1) {
    console.error(`Card set with id ${id} not found`);
    return null;
  }

  allSets[index] = {
    ...allSets[index],
    name: name.trim(),
    symbols,
    updatedAt: Date.now(),
  };

  saveStoredCardSets(allSets);
  return storedToCardSet(allSets[index]);
}

/**
 * Delete a custom card set
 * @returns true if deleted, false if not found
 */
export function deleteCustomCardSet(id: string): boolean {
  const allSets = getStoredCardSets();
  const index = allSets.findIndex(s => s.id === id);
  if (index === -1) return false;

  allSets.splice(index, 1);
  saveStoredCardSets(allSets);
  return true;
}

/**
 * Check if a card set ID is a custom set
 */
export function isCustomCardSet(id: string): boolean {
  return id.startsWith('custom_');
}
