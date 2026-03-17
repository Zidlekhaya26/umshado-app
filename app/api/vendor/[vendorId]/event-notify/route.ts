import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

const THROTTLE_SECONDS: Record<string, number> = {
  profile_view: 3600, // notify at most once per hour per viewer
  save_vendor:  300,  // notify at most once per 5 min per viewer
};

export async function POST(req: NextRequest, { params }: { params: { vendorId: string } }) {
  try {
    const { vendorId } = params;
    const { eventType, actorId } = await req.json();

    if (!vendorId || !eventType || !actorId) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Get vendor owner's user_id
    const { data: vendor } = await supabase
      .from('vendors')
      .select('user_id, business_name')
      .eq('id', vendorId)
      .maybeSingle();

    if (!vendor?.user_id || vendor.user_id === actorId) {
      return NextResponse.json({ ok: true, skipped: 'self-view or not found' });
    }

    // Throttle: skip if we already notified recently for this actor+vendor+eventType
    const throttleSecs = THROTTLE_SECONDS[eventType];
    if (throttleSecs) {
      const since = new Date(Date.now() - throttleSecs * 1000).toISOString();
      const { data: recent } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', vendor.user_id)
        .eq('type', eventType)
        .gte('created_at', since)
        .contains('meta', { actor_id: actorId, vendor_id: vendorId })
        .limit(1);

      if (recent && recent.length > 0) {
        return NextResponse.json({ ok: true, skipped: 'throttled' });
      }
    }

    // Build notification content
    const businessName = vendor.business_name || 'your profile';
    const content =
      eventType === 'profile_view'
        ? { title: 'Someone viewed your profile', body: `A couple just visited ${businessName}`, link: `/vendor/insights` }
        : { title: 'A couple saved your business', body: `${businessName} was saved to a couple's favourites`, link: `/vendor/insights` };

    await notifyUsers({
      userIds: [vendor.user_id],
      type: eventType,
      title: content.title,
      body: content.body,
      link: content.link,
      meta: { actor_id: actorId, vendor_id: vendorId },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[event-notify] error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
