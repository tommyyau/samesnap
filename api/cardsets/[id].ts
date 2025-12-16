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

// Helper for JSON responses (compatible with older TS)
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Helper to get userId from Clerk JWT
async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    return payload.sub;
  } catch {
    return null;
  }
}

// Extract ID from URL path
function getIdFromUrl(url: string): string | null {
  const match = url.match(/\/api\/cardsets\/([^/?]+)/);
  return match ? match[1] : null;
}

// PUT /api/cardsets/[id] - Update card set
async function handlePut(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const cardSetId = getIdFromUrl(request.url);
  if (!cardSetId) {
    return jsonResponse({ error: 'Card set ID required' }, 400);
  }

  try {
    const body = await request.json();
    const { name, symbols } = body;

    // Validate
    if (!name?.trim()) {
      return jsonResponse({ error: 'Name is required' }, 400);
    }
    if (!Array.isArray(symbols) || symbols.length !== 57) {
      return jsonResponse({ error: 'Must have exactly 57 symbols' }, 400);
    }
    const uniqueSymbols = new Set(symbols);
    if (uniqueSymbols.size !== 57) {
      return jsonResponse({ error: 'Symbols must be unique' }, 400);
    }

    // Get existing sets
    const existingSets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];

    // Find and update
    const index = existingSets.findIndex(s => s.id === cardSetId);
    if (index === -1) {
      return jsonResponse({ error: 'Card set not found' }, 404);
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

    return jsonResponse({ cardSet: updatedSet });
  } catch (error) {
    console.error('Failed to update card set:', error);
    return jsonResponse({ error: 'Failed to update card set' }, 500);
  }
}

// DELETE /api/cardsets/[id] - Delete card set
async function handleDelete(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const cardSetId = getIdFromUrl(request.url);
  if (!cardSetId) {
    return jsonResponse({ error: 'Card set ID required' }, 400);
  }

  try {
    // Get existing sets
    const existingSets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];

    // Find and remove
    const index = existingSets.findIndex(s => s.id === cardSetId);
    if (index === -1) {
      return jsonResponse({ error: 'Card set not found' }, 404);
    }

    existingSets.splice(index, 1);

    // Save
    await kv.set(`cardsets:${userId}`, existingSets);

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Failed to delete card set:', error);
    return jsonResponse({ error: 'Failed to delete card set' }, 500);
  }
}

// Main handler
export default async function handler(request: Request): Promise<Response> {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  let response: Response;

  switch (request.method) {
    case 'PUT':
      response = await handlePut(request);
      break;
    case 'DELETE':
      response = await handleDelete(request);
      break;
    default:
      response = jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Add CORS headers to response
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Note: Using Node.js runtime because @clerk/backend requires crypto modules not available in Edge
