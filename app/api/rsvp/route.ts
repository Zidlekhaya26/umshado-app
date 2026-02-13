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

  if (!guestId || !status || !['accepted', 'declined'].includes(status)) {
    return NextResponse.json({ success: false, error: 'Missing or invalid parameters' }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('couple_guests')
      .update({ rsvp_status: status, invited_via: 'whatsapp' })
      .eq('id', guestId)
      .select()
      .single();

    if (error) {
      console.error('RSVP update error', error);
      return NextResponse.json({ success: false, error: 'Failed to update RSVP' }, { status: 500 });
    }

    return NextResponse.json({ success: true, guest: data });
  } catch (err) {
    console.error('RSVP route error', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
