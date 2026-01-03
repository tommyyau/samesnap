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

// Helper to get userId from Clerk JWT
async function getUserId(req: VercelRequest): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    // Allow localhost, production, custom domain, and all Vercel preview deployments
    const authorizedParties = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://samesnap.vercel.app',
      'https://samesnap.tommyyau.com',
    ];

    // Add the request origin if it's a Vercel preview deployment
    let origin = req.headers.origin;
    if (!origin && req.headers.referer) {
      try {
        origin = new URL(String(req.headers.referer)).origin;
      } catch {
        // Invalid URL, ignore
      }
    }
    if (origin && origin.includes('.vercel.app') && !authorizedParties.includes(origin)) {
      authorizedParties.push(origin);
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      authorizedParties,
    });
    return payload.sub;
  } catch {
    return null;
  }
}

// PUT /api/cardsets/[id] - Update card set
async function handlePut(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cardSetId = req.query.id as string;
  if (!cardSetId) {
    return res.status(400).json({ error: 'Card set ID required' });
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

    // Find and update
    const index = existingSets.findIndex(s => s.id === cardSetId);
    if (index === -1) {
      return res.status(404).json({ error: 'Card set not found' });
    }

    const updatedSet: StoredCardSet = {
      ...existingSets[index],
      name: name.trim(),
      symbols,
      updatedAt: Date.now(),
    };

    existingSets[index] = updatedSet;

    // Save
    await kv.set(`cardsets:${userId}`, existingSets);

    return res.status(200).json({ cardSet: updatedSet });
  } catch (error) {
    console.error('Failed to update card set:', error);
    return res.status(500).json({ error: 'Failed to update card set' });
  }
}

// DELETE /api/cardsets/[id] - Delete card set
async function handleDelete(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cardSetId = req.query.id as string;
  if (!cardSetId) {
    return res.status(400).json({ error: 'Card set ID required' });
  }

  try {
    // Get existing sets
    const existingSets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];

    // Find and remove
    const index = existingSets.findIndex(s => s.id === cardSetId);
    if (index === -1) {
      return res.status(404).json({ error: 'Card set not found' });
    }

    existingSets.splice(index, 1);

    // Save
    await kv.set(`cardsets:${userId}`, existingSets);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to delete card set:', error);
    return res.status(500).json({ error: 'Failed to delete card set' });
  }
}

// Main handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  switch (req.method) {
    case 'PUT':
      return handlePut(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}
