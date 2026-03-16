import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createServiceClient } from '@/lib/supabaseServer';

const MomentSchema = z.object({
  token:      z.string().min(1).max(500),
  guest_name: z.string().min(1).max(200).transform(s => s.trim()),
  caption:    z.string().max(2000).optional().nullable().transform(s => s?.trim() || null),
  media_url:  z.string().url().max(2000).optional().nullable(),
}).refine(d => d.caption || d.media_url, { message: 'At least caption or media_url is required' });

/**
 * POST /api/live/moment
 * Public (no auth). Validates token, inserts a moment for the couple.
 * Body: { token: string, guest_name: string, caption?: string, media_url?: string }
 */
export async function POST(req: NextRequest) {
  const { data: body, error: bodyError } = await validateBody(req, MomentSchema);
  if (bodyError) return bodyError;
  const { token, guest_name, caption, media_url } = body;

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
      guest_name,
      caption: caption || null,
      media_url: media_url || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error inserting moment:', error);
    return NextResponse.json({ error: 'Failed to add moment' }, { status: 500 });
  }

  return NextResponse.json({ moment: data }, { status: 201 });
}
