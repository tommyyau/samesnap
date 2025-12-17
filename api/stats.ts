import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { verifyToken } from '@clerk/backend';

// Types (inlined for serverless compatibility - can't import from outside api folder)
interface ModeStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestStreak: number;
  fastestWinMs: number | null;
}

interface UserStats {
  singlePlayer: ModeStats;
  multiplayer: ModeStats;
  lastActivityAt: number;
  createdAt: number;
  updatedAt: number;
}

interface RecordGamePayload {
  mode: 'singleplayer' | 'multiplayer';
  isWin: boolean;
  winReason?: 'stack_emptied' | 'last_player_standing';
  gameDurationMs: number;
  context: {
    botDifficulty?: string;
    cardLayout: string;
    cardSetId: string;
    cardSetName: string;
    playerCount: number;
  };
}

const DEFAULT_MODE_STATS: ModeStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  longestStreak: 0,
  fastestWinMs: null,
};

const DEFAULT_USER_STATS: UserStats = {
  singlePlayer: { ...DEFAULT_MODE_STATS },
  multiplayer: { ...DEFAULT_MODE_STATS },
  lastActivityAt: 0,
  createdAt: 0,
  updatedAt: 0,
};

// Helper to get userId from Clerk JWT
async function getUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('No Authorization header or not Bearer token');
    return null;
  }

  const token = authHeader.slice(7);
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    console.error('CLERK_SECRET_KEY not set');
    return null;
  }

  try {
    // Allow localhost, production, and all Vercel preview deployments
    const authorizedParties = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://samesnap.vercel.app',
    ];

    // Add the request origin if it's a Vercel preview deployment
    const origin = req.headers.origin || req.headers.referer;
    if (origin && origin.includes('.vercel.app') && !authorizedParties.includes(origin)) {
      const cleanOrigin = String(origin).replace(/\/$/, '');
      authorizedParties.push(cleanOrigin);
    }

    const payload = await verifyToken(token, {
      secretKey,
      authorizedParties,
    });
    return payload.sub;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// GET /api/stats - Fetch user's stats
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stats = await kv.get<UserStats>(`stats:${userId}`);

    if (!stats) {
      // Return default stats for new users (don't create until first game)
      return res.status(200).json({ stats: DEFAULT_USER_STATS });
    }

    return res.status(200).json({ stats });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

// POST /api/stats - Record a game result
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body as RecordGamePayload;

    // Validate payload
    if (!payload.mode || !['singleplayer', 'multiplayer'].includes(payload.mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    if (typeof payload.isWin !== 'boolean') {
      return res.status(400).json({ error: 'isWin is required' });
    }
    if (typeof payload.gameDurationMs !== 'number' || payload.gameDurationMs < 0) {
      return res.status(400).json({ error: 'Invalid gameDurationMs' });
    }

    // Get existing stats or create defaults
    const now = Date.now();
    let stats = await kv.get<UserStats>(`stats:${userId}`);

    if (!stats) {
      stats = {
        ...DEFAULT_USER_STATS,
        singlePlayer: { ...DEFAULT_MODE_STATS },
        multiplayer: { ...DEFAULT_MODE_STATS },
        createdAt: now,
      };
    }

    // Get the mode stats to update
    const modeKey = payload.mode === 'singleplayer' ? 'singlePlayer' : 'multiplayer';
    const modeStats: ModeStats = { ...stats[modeKey] };

    // Update stats
    modeStats.gamesPlayed += 1;

    if (payload.isWin) {
      modeStats.wins += 1;
      modeStats.currentStreak += 1;

      // Update longest streak if current is higher
      if (modeStats.currentStreak > modeStats.longestStreak) {
        modeStats.longestStreak = modeStats.currentStreak;
      }

      // Update fastest win if this is faster (or first win)
      if (modeStats.fastestWinMs === null || payload.gameDurationMs < modeStats.fastestWinMs) {
        modeStats.fastestWinMs = payload.gameDurationMs;
      }
    } else {
      modeStats.losses += 1;
      modeStats.currentStreak = 0;  // Reset streak on loss
    }

    // Update the stats object
    const updatedStats: UserStats = {
      ...stats,
      [modeKey]: modeStats,
      lastActivityAt: now,
      updatedAt: now,
    };

    // Save to KV
    await kv.set(`stats:${userId}`, updatedStats);

    return res.status(200).json({ stats: updatedStats });
  } catch (error) {
    console.error('Failed to record game:', error);
    return res.status(500).json({ error: 'Failed to record game' });
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
