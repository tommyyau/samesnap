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
async function handleGet(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const sets = await kv.get<StoredCardSet[]>(`cardsets:${userId}`) || [];
    return jsonResponse({ cardSets: sets });
  } catch (error) {
    console.error('Failed to fetch card sets:', error);
    return jsonResponse({ error: 'Failed to fetch card sets' }, 500);
  }
}

// POST /api/cardsets - Create new card set
async function handlePost(request: Request): Promise<Response> {
  const userId = await getUserId(request);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
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

    // Check limit
    if (existingSets.length >= MAX_CARD_SETS) {
      return jsonResponse({ error: `Maximum ${MAX_CARD_SETS} card sets allowed` }, 400);
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

    return jsonResponse({ cardSet: newSet }, 201);
  } catch (error) {
    console.error('Failed to create card set:', error);
    return jsonResponse({ error: 'Failed to create card set' }, 500);
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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  let response: Response;

  switch (request.method) {
    case 'GET':
      response = await handleGet(request);
      break;
    case 'POST':
      response = await handlePost(request);
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
