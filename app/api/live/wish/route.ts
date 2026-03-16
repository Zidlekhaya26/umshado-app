import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createServiceClient } from '@/lib/supabaseServer';

const WishSchema = z.object({
  // accept both naming conventions
  guest_name: z.string().max(200).optional(),
  guestName:  z.string().max(200).optional(),
  message:    z.string().min(1).max(2000),
  // auth paths (at least one required — enforced below)
  coupleId: z.string().uuid().optional(),
  token:    z.string().min(1).max(500).optional(),
}).refine(d => d.guest_name?.trim() || d.guestName?.trim(), { message: 'guest_name is required' })
  .refine(d => d.coupleId || d.token, { message: 'Provide either coupleId or token' });

/**
 * POST /api/live/wish
 * Public (no auth). Accepts either:
 *   { token, guest_name, message }      — live guest link (existing flow)
 *   { coupleId, guestName, message }    — public wedding website (new flow)
 */
export async function POST(req: NextRequest) {
  const { data: body, error: bodyError } = await validateBody(req, WishSchema);
  if (bodyError) return bodyError;

  const supabase = createServiceClient();

  let couple_id: string | null = null;
  const guest_name = (body.guest_name ?? body.guestName ?? '').trim();
  const message    = body.message.trim();

  // Path 1: coupleId direct (public wedding website)
  if (body.coupleId) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', body.coupleId).maybeSingle();
    if (!profile) return NextResponse.json({ error: 'Couple not found' }, { status: 404 });
    couple_id = body.coupleId;
  }
  // Path 2: token-based (live guest link)
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
