import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * GET /api/live/guest?token=<uuid>
 * Public (no auth required). Validates token, returns couple info + schedule + wishes + moments.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Validate token → get couple_id
  const { data: link, error: linkErr } = await supabase
    .from('live_guest_links')
    .select('couple_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (linkErr || !link) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
  }

  // Check expiry
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
  }

  const coupleId = link.couple_id;

  // Fetch couple basic info
  const { data: couple } = await supabase
    .from('couples')
    .select('partner1_name, partner2_name')
    .eq('id', coupleId)
    .maybeSingle();

  // Fetch schedule, wishes, moments in parallel
  const [scheduleRes, wishesRes, momentsRes] = await Promise.all([
    supabase
      .from('live_events')
      .select('id, title, time, location, sort_order')
      .eq('couple_id', coupleId)
      .order('sort_order'),
    supabase
      .from('live_well_wishes')
      .select('id, guest_name, message, created_at')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false }),
    supabase
      .from('live_moments')
      .select('id, guest_name, caption, media_url, created_at')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    couple: couple
      ? { names: [couple.partner1_name, couple.partner2_name].filter(Boolean).join(' & ') || 'The Happy Couple' }
      : { names: 'The Happy Couple' },
    schedule: scheduleRes.data || [],
    wishes: wishesRes.data || [],
    moments: momentsRes.data || [],
  });
}
