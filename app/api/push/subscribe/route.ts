import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

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

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { endpoint, keys, userAgent } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Missing endpoint or keys' }, { status: 400 });
  }

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

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { endpoint } = body;
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const supabase = createServiceClient();
  await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);

  return NextResponse.json({ success: true });
}
