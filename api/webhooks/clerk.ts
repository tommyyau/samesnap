import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';
import { Webhook } from 'svix';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    [key: string]: unknown;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Verify webhook signature using Svix
  const svix_id = req.headers['svix-id'] as string;
  const svix_timestamp = req.headers['svix-timestamp'] as string;
  const svix_signature = req.headers['svix-signature'] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(JSON.stringify(req.body), {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Webhook verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle user deletion
  if (event.type === 'user.deleted') {
    const userId = event.data.id;

    try {
      await kv.del(`stats:${userId}`);
      await kv.del(`cardsets:${userId}`);

      console.log(`Deleted data for user: ${userId}`);
    } catch (err) {
      console.error(`Failed to delete data for user ${userId}:`, err);
      return res.status(500).json({ error: 'Failed to delete user data' });
    }
  }

  return res.status(200).json({ received: true });
}
