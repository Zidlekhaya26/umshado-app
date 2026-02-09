import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/live/moment
 * Public (no auth). Validates token, inserts a moment for the couple.
 * Body: { token: string, guest_name: string, caption?: string, media_url?: string }
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; guest_name?: string; caption?: string; media_url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { token, guest_name, caption, media_url } = body;

  if (!token || !guest_name?.trim()) {
    return NextResponse.json({ error: 'token and guest_name are required' }, { status: 400 });
  }

  if (!caption?.trim() && !media_url?.trim()) {
    return NextResponse.json({ error: 'At least caption or media_url is required' }, { status: 400 });
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

  // Insert moment using service role (bypasses RLS)
  const { data, error } = await supabase
    .from('live_moments')
    .insert({
      couple_id: link.couple_id,
      guest_name: guest_name.trim(),
      caption: caption?.trim() || null,
      media_url: media_url?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting moment:', error);
    return NextResponse.json({ error: 'Failed to add moment' }, { status: 500 });
  }

  return NextResponse.json({ moment: data }, { status: 201 });
}
