import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { UserStats, RecordGamePayload } from '../shared/types';
import { DEFAULT_USER_STATS } from '../shared/types';
import { fetchStats, recordGame } from '../utils/cloudStats';

interface UseUserStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  recordGameResult: (payload: RecordGamePayload) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * React hook for managing user game statistics
 * Uses Vercel KV via API routes for logged-in users
 * Returns null stats for non-logged-in users
 */
export function useUserStats(): UseUserStatsReturn {
  const { isSignedIn, getToken } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats from API
  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        setStats(null);
        setIsLoading(false);
        return;
      }

      const fetchedStats = await fetchStats(token);
      setStats(fetchedStats);
    } catch (err) {
      // In dev mode without Vercel, API routes won't work - fail silently
      console.error('Failed to fetch stats:', err);
      // Don't set error - just show default stats (better UX)
      setStats(DEFAULT_USER_STATS);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, getToken]);

  // Load on mount and when auth state changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Record a game result (fire-and-forget pattern - don't block game flow)
  const recordGameResult = useCallback(async (payload: RecordGamePayload): Promise<void> => {
    if (!isSignedIn) {
      // Silently skip for non-logged-in users
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        return;
      }

      const updatedStats = await recordGame(token, payload);
      setStats(updatedStats);
      setError(null);
    } catch (err) {
      // Log but don't throw - recording stats shouldn't disrupt game flow
      console.error('Failed to record game result:', err);
      // Don't set error state for fire-and-forget operations
    }
  }, [isSignedIn, getToken]);

  return {
    stats,
    isLoading,
    error,
    recordGameResult,
    refresh,
  };
}
