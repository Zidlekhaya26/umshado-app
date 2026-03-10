import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/live/wish
 * Public (no auth). Accepts either:
 *   { token, guest_name, message }      — live guest link (existing flow)
 *   { coupleId, guestName, message }    — public wedding website (new flow)
 */
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let couple_id: string | null = null;
  const guest_name = (body.guest_name ?? body.guestName ?? '').trim();
  const message    = (body.message ?? '').trim();

  if (!guest_name || !message) {
    return NextResponse.json({ error: 'guest_name and message are required' }, { status: 400 });
  }

  // Path 1: coupleId direct (public wedding website)
  if (body.coupleId && uuidRegex.test(body.coupleId)) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', body.coupleId).maybeSingle();
    if (!profile) return NextResponse.json({ error: 'Couple not found' }, { status: 404 });
    couple_id = body.coupleId;
  }
  // Path 2: token-based (live guest link — existing flow unchanged)
  else if (body.token) {
    const { data: link } = await supabase
      .from('live_guest_links')
      .select('couple_id, expires_at')
      .eq('token', body.token)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link expired' }, { status: 410 });
    }
    couple_id = link.couple_id;
  }
  else {
    return NextResponse.json({ error: 'Provide either coupleId or token' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('live_well_wishes')
    .insert({ couple_id, guest_name, message })
    .select()
    .single();

  if (error) {
    console.error('Error inserting well wish:', error);
    return NextResponse.json({ error: 'Failed to send well wish' }, { status: 500 });
  }

  return NextResponse.json({ wish: data }, { status: 201 });
}
