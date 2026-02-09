import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/live/wish
 * Public (no auth). Validates token, inserts a well wish for the couple.
 * Body: { token: string, guest_name: string, message: string }
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; guest_name?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, guest_name, message } = body;

  if (!token || !guest_name?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'token, guest_name, and message are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Validate token → get couple_id
  const { data: link } = await supabase
    .from('live_guest_links')
    .select('couple_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!link) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Link expired' }, { status: 410 });
  }

  // Insert well wish using service role (bypasses RLS)
  const { data, error } = await supabase
    .from('live_well_wishes')
    .insert({
      couple_id: link.couple_id,
      guest_name: guest_name.trim(),
      message: message.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting well wish:', error);
    return NextResponse.json({ error: 'Failed to send well wish' }, { status: 500 });
  }

  return NextResponse.json({ wish: data }, { status: 201 });
}
