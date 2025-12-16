import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { verifyToken } from '@clerk/backend';

// Types
interface StoredCardSet {
  id: string;
  name: string;
  symbols: string[];
  createdAt: number;
  updatedAt: number;
}

const MAX_CARD_SETS = 10;

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
    const payload = await verifyToken(token, {
      secretKey,
    });
    console.log('Token verified, userId:', payload.sub);
    return payload.sub;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Generate unique ID
function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// GET /api/cardsets - List user's card sets
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];
    return res.status(200).json({ cardSets: sets });
  } catch (error) {
    console.error('Failed to fetch card sets:', error);
    return res.status(500).json({ error: 'Failed to fetch card sets' });
  }
}

// POST /api/cardsets - Create new card set
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { name, symbols } = req.body;

    // Validate
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!Array.isArray(symbols) || symbols.length !== 57) {
      return res.status(400).json({ error: 'Must have exactly 57 symbols' });
    }
    const uniqueSymbols = new Set(symbols);
    if (uniqueSymbols.size !== 57) {
      return res.status(400).json({ error: 'Symbols must be unique' });
    }

    // Get existing sets
    const existingSets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];

    // Check limit
    if (existingSets.length >= MAX_CARD_SETS) {
      return res.status(400).json({ error: `Maximum ${MAX_CARD_SETS} card sets allowed` });
    }

    // Create new set
    const newSet: StoredCardSet = {
      id: generateId(),
      name: name.trim(),
      symbols,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Save
    await kv.set(`cardsets:${userId}`, [...existingSets, newSet]);

    return res.status(201).json({ cardSet: newSet });
  } catch (error) {
    console.error('Failed to create card set:', error);
    return res.status(500).json({ error: 'Failed to create card set' });
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
