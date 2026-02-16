import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

/**
 * POST /api/rsvp
 * body: { guestId: string, status: 'accepted' | 'declined' }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const guestId = body?.guestId;
  const status = body?.status;
  const token = body?.token;

  if (!guestId || !token || !status || !['accepted', 'declined'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid parameters' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    // validate token
    const { data: guest, error: gErr } = await supabase
      .from('couple_guests')
      .select('id, rsvp_token')
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

    return NextResponse.json({ success: true, guest: data });
  } catch (err) {
    console.error('RSVP route error', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
