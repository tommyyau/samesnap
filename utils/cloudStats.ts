import type { UserStats, RecordGamePayload } from '../shared/types';
import { DEFAULT_USER_STATS } from '../shared/types';

// API base URL - empty for same-origin requests
const API_BASE = '';

/**
 * Fetch user stats from the API
 */
export async function fetchStats(token: string): Promise<UserStats> {
  const response = await fetch(`${API_BASE}/api/stats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to fetch stats: ${response.status}`);
  }

  const data = await response.json();
  return data.stats || DEFAULT_USER_STATS;
}

/**
 * Record a game result
 */
export async function recordGame(
  token: string,
  payload: RecordGamePayload
): Promise<UserStats> {
  const response = await fetch(`${API_BASE}/api/stats`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to record game: ${response.status}`);
  }

  const data = await response.json();
  return data.stats;
}
