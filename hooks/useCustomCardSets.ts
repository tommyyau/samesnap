import { useState, useCallback, useEffect } from 'react';
import { CardSet } from '../shared/types';
import {
  getCustomCardSets,
  createCustomCardSet,
  updateCustomCardSet,
  deleteCustomCardSet,
} from '../utils/customCardSets';

interface UseCustomCardSetsReturn {
  customSets: CardSet[];
  isLoading: boolean;
  createSet: (name: string, symbols: string[]) => CardSet | null;
  updateSet: (id: string, name: string, symbols: string[]) => CardSet | null;
  deleteSet: (id: string) => boolean;
  refresh: () => void;
}

/**
 * React hook for managing custom card sets
 * Provides CRUD operations and automatic state updates
 */
export function useCustomCardSets(): UseCustomCardSetsReturn {
  const [customSets, setCustomSets] = useState<CardSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load custom sets on mount
  useEffect(() => {
    setCustomSets(getCustomCardSets());
    setIsLoading(false);
  }, []);

  // Refresh from localStorage
  const refresh = useCallback(() => {
    setCustomSets(getCustomCardSets());
  }, []);

  // Create a new set
  const createSet = useCallback((name: string, symbols: string[]): CardSet | null => {
    const newSet = createCustomCardSet(name, symbols);
    if (newSet) {
      setCustomSets(prev => [...prev, newSet]);
    }
    return newSet;
  }, []);

  // Update an existing set
  const updateSet = useCallback((id: string, name: string, symbols: string[]): CardSet | null => {
    const updated = updateCustomCardSet(id, name, symbols);
    if (updated) {
      setCustomSets(prev => prev.map(s => (s.id === id ? updated : s)));
    }
    return updated;
  }, []);

  // Delete a set
  const deleteSet = useCallback((id: string): boolean => {
    const success = deleteCustomCardSet(id);
    if (success) {
      setCustomSets(prev => prev.filter(s => s.id !== id));
    }
    return success;
  }, []);

  return {
    customSets,
    isLoading,
    createSet,
    updateSet,
    deleteSet,
    refresh,
  };
}
