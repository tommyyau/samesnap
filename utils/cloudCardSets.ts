import { CardSet, SymbolItem } from '../shared/types';

// Stored format (matches API response)
interface StoredCardSet {
  id: string;
  name: string;
  symbols: string[];
  createdAt: number;
  updatedAt: number;
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

// API base URL - empty for same-origin requests
const API_BASE = '';

/**
 * Fetch all custom card sets for the current user
 */
export async function fetchCardSets(token: string): Promise<CardSet[]> {
  const response = await fetch(`${API_BASE}/api/cardsets`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch card sets: ${response.status}`);
  }

  const data = await response.json();
  return (data.cardSets || []).map(storedToCardSet);
}

/**
 * Create a new custom card set
 */
export async function createCardSet(
  token: string,
  name: string,
  symbols: string[]
): Promise<CardSet> {
  const response = await fetch(`${API_BASE}/api/cardsets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, symbols }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to create card set: ${response.status}`);
  }

  const data = await response.json();
  return storedToCardSet(data.cardSet);
}

/**
 * Update an existing custom card set
 */
export async function updateCardSet(
  token: string,
  id: string,
  name: string,
  symbols: string[]
): Promise<CardSet> {
  const response = await fetch(`${API_BASE}/api/cardsets/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, symbols }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to update card set: ${response.status}`);
  }

  const data = await response.json();
  return storedToCardSet(data.cardSet);
}

/**
 * Delete a custom card set
 */
export async function deleteCardSet(token: string, id: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/cardsets/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to delete card set: ${response.status}`);
  }

  return true;
}
