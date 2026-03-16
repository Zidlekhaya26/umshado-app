import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createServiceClient } from '@/lib/supabaseServer';

const SubscribeSchema = z.object({
  endpoint:  z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth:   z.string().min(1).max(500),
  }),
  userAgent: z.string().max(500).optional(),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

/**
 * POST /api/push/subscribe
 * Saves a Web Push subscription for the authenticated user.
 *
 * Body: { endpoint, keys: { p256dh, auth }, userAgent? }
 *
 * DELETE /api/push/subscribe
 * Removes the subscription for the given endpoint.
 *
 * Body: { endpoint }
 */

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: bodyError } = await validateBody(req, SubscribeSchema);
  if (bodyError) return bodyError;
  const { endpoint, keys, userAgent } = body;

  const supabase = createServiceClient();

  // Upsert — same endpoint = same device/browser, update keys if rotated
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent || req.headers.get('user-agent') || null,
    }, { onConflict: 'endpoint' });

  if (error) {
    console.error('[push/subscribe] upsert error:', error);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: body, error: bodyError } = await validateBody(req, UnsubscribeSchema);
  if (bodyError) return bodyError;
  const { endpoint } = body;

  const supabase = createServiceClient();
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);

  return NextResponse.json({ success: true });
}
