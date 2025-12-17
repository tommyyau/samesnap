import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import type { UserStats, RecordGamePayload } from '../shared/types';
import { DEFAULT_USER_STATS } from '../shared/types';
import { fetchStats, recordGame } from '../utils/cloudStats';

/** Result of recording a game, used to trigger UI feedback */
export interface RecordGameResult {
  recorded: boolean;        // true if stats were actually saved
  isPersonalBest: boolean;  // true if this was a new fastest win
}

// Session storage key for sign-in prompt
const SIGN_IN_PROMPT_KEY = 'samesnap-signin-prompt-shown';

/** Check if sign-in prompt has been shown this session */
export function hasShownSignInPrompt(): boolean {
  try {
    return sessionStorage.getItem(SIGN_IN_PROMPT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Mark sign-in prompt as shown for this session */
export function markSignInPromptShown(): void {
  try {
    sessionStorage.setItem(SIGN_IN_PROMPT_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

interface UseUserStatsReturn {
  stats: UserStats | null;
  isLoading: boolean;
  error: string | null;
  recordGameResult: (payload: RecordGamePayload) => Promise<RecordGameResult>;
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
  const recordGameResult = useCallback(async (payload: RecordGamePayload): Promise<RecordGameResult> => {
    if (!isSignedIn) {
      // Silently skip for non-logged-in users
      return { recorded: false, isPersonalBest: false };
    }

    try {
      const token = await getToken();
      if (!token) {
        return { recorded: false, isPersonalBest: false };
      }

      // Capture old fastestWinMs before recording to detect personal best
      const modeKey = payload.mode === 'singleplayer' ? 'singlePlayer' : 'multiplayer';
      const oldFastestWinMs = stats?.[modeKey]?.fastestWinMs ?? null;

      const updatedStats = await recordGame(token, payload);
      setStats(updatedStats);
      setError(null);

      // Determine if this was a personal best (only for wins)
      const isPersonalBest = payload.isWin && (
        oldFastestWinMs === null || payload.gameDurationMs < oldFastestWinMs
      );

      return { recorded: true, isPersonalBest };
    } catch (err) {
      // Log but don't throw - recording stats shouldn't disrupt game flow
      console.error('Failed to record game result:', err);
      // Don't set error state for fire-and-forget operations
      return { recorded: false, isPersonalBest: false };
    }
  }, [isSignedIn, getToken, stats]);

  return {
    stats,
    isLoading,
    error,
    recordGameResult,
    refresh,
  };
}
