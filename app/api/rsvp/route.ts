import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { validateBody } from '@/lib/apiValidate';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';

const RsvpSchema = z.object({
  guestId: z.string().uuid('guestId must be a valid UUID'),
  token: z.string().min(1),
  status: z.enum(['accepted', 'declined']),
});

/**
 * POST /api/rsvp
 * body: { guestId: string, token: string, status: 'accepted' | 'declined' }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 8 RSVP submissions per IP per 10 minutes
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = await checkRateLimit(`rsvp:${ip}`, 8, 10 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { data, error: bodyError } = await validateBody(req, RsvpSchema);
  if (bodyError) return bodyError;
  const { guestId, token, status } = data;

  try {
    const supabase = createServiceClient();

    // validate token
    const { data: guest, error: gErr } = await supabase
      .from('couple_guests')
      .select('id, rsvp_token, full_name, couple_id')
      .eq('id', guestId)
      .maybeSingle();

    if (gErr || !guest) return NextResponse.json({ success: false, error: 'Guest not found' }, { status: 404 });
    if (guest.rsvp_token !== token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('couple_guests')
      .update({ rsvp_status: status })
      .eq('id', guestId)
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, error: 'Failed to update RSVP' }, { status: 500 });

    // Notify the couple — non-blocking
    try {
      const verb = status === 'accepted' ? 'accepted' : 'declined';
      const emoji = status === 'accepted' ? '\uD83C\uDF89' : '\uD83D\uDE14';
      await supabase.from('notifications').insert({
        user_id: guest.couple_id,
        type: 'rsvp_response',
        title: emoji + ' ' + guest.full_name + ' ' + verb + ' their invite',
        body: guest.full_name + ' has ' + verb + ' their invitation to your wedding.',
        link: '/couple/planner?tab=guests',
        meta: { guest_id: guestId, rsvp_status: status },
        created_at: new Date().toISOString(),
      });
    } catch (notifyErr) {
      console.error('Failed to notify couple of RSVP:', notifyErr);
    }

    return NextResponse.json({ success: true, guest: data });
  } catch (err) {
    console.error('RSVP route error', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
