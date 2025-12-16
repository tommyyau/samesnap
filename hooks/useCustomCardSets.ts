import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { CardSet } from '../shared/types';
import {
  fetchCardSets,
  createCardSet,
  updateCardSet,
  deleteCardSet,
} from '../utils/cloudCardSets';

const MAX_CARD_SETS = 10;

interface UseCustomCardSetsReturn {
  customSets: CardSet[];
  isLoading: boolean;
  error: string | null;
  canCreate: boolean;
  createSet: (name: string, symbols: string[]) => Promise<CardSet | null>;
  updateSet: (id: string, name: string, symbols: string[]) => Promise<CardSet | null>;
  deleteSet: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * React hook for managing custom card sets
 * Uses Vercel KV via API routes for logged-in users
 * Returns empty array for non-logged-in users
 */
export function useCustomCardSets(): UseCustomCardSetsReturn {
  const { isSignedIn, getToken } = useAuth();
  const [customSets, setCustomSets] = useState<CardSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Can create if signed in and under limit
  const canCreate = isSignedIn === true && customSets.length < MAX_CARD_SETS;

  // Fetch card sets from API
  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCustomSets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setCustomSets([]);
        setIsLoading(false);
        return;
      }

      const sets = await fetchCardSets(token);
      setCustomSets(sets);
    } catch (err) {
      console.error('Failed to fetch card sets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load card sets');
      setCustomSets([]);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  // Load on mount and when auth state changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Create a new set
  const createSet = useCallback(async (name: string, symbols: string[]): Promise<CardSet | null> => {
    if (!isSignedIn) {
      setError('You must be signed in to create card sets');
      return null;
    }

    if (customSets.length >= MAX_CARD_SETS) {
      setError(`Maximum ${MAX_CARD_SETS} card sets allowed`);
      return null;
    }

    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication error');
        return null;
      }

      const newSet = await createCardSet(token, name, symbols);
      setCustomSets(prev => [...prev, newSet]);
      setError(null);
      return newSet;
    } catch (err) {
      console.error('Failed to create card set:', err);
      setError(err instanceof Error ? err.message : 'Failed to create card set');
      return null;
    }
  }, [isSignedIn, getToken, customSets.length]);

  // Update an existing set
  const updateSet = useCallback(async (id: string, name: string, symbols: string[]): Promise<CardSet | null> => {
    if (!isSignedIn) {
      setError('You must be signed in to update card sets');
      return null;
    }

    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication error');
        return null;
      }

      const updated = await updateCardSet(token, id, name, symbols);
      setCustomSets(prev => prev.map(s => (s.id === id ? updated : s)));
      setError(null);
      return updated;
    } catch (err) {
      console.error('Failed to update card set:', err);
      setError(err instanceof Error ? err.message : 'Failed to update card set');
      return null;
    }
  }, [isSignedIn, getToken]);

  // Delete a set
  const deleteSet = useCallback(async (id: string): Promise<boolean> => {
    if (!isSignedIn) {
      setError('You must be signed in to delete card sets');
      return false;
    }

    try {
      const token = await getToken();
      if (!token) {
        setError('Authentication error');
        return false;
      }

      await deleteCardSet(token, id);
      setCustomSets(prev => prev.filter(s => s.id !== id));
      setError(null);
      return true;
    } catch (err) {
      console.error('Failed to delete card set:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete card set');
      return false;
    }
  }, [isSignedIn, getToken]);

  return {
    customSets,
    isLoading,
    error,
    canCreate,
    createSet,
    updateSet,
    deleteSet,
    refresh,
  };
}
