import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const boostId  = req.nextUrl.searchParams.get('boostId');
    const vendorId = req.nextUrl.searchParams.get('vendorId');
    if (!boostId || !vendorId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify the boost belongs to this vendor
    const { data: boost } = await supabase
      .from('vendor_boosts')
      .select('vendor_id')
      .eq('id', boostId)
      .maybeSingle();

    if (!boost || boost.vendor_id !== vendorId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Fetch all impression + click events for this boost (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from('vendor_events')
      .select('event_type, meta, created_at')
      .eq('vendor_id', vendorId)
      .in('event_type', ['ad_impression', 'ad_click'])
      .gte('created_at', since);

    const boostEvents = (events ?? []).filter((e: any) => e.meta?.boost_id === boostId);
    const impressions = boostEvents.filter((e: any) => e.event_type === 'ad_impression');
    const clicks      = boostEvents.filter((e: any) => e.event_type === 'ad_click');

    // Last 14 days breakdown
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10);
    });

    const dailyImpressions = last14.map(day => ({
      day,
      count: impressions.filter((e: any) => e.created_at.slice(0, 10) === day).length,
    }));
    const dailyClicks = last14.map(day => ({
      day,
      count: clicks.filter((e: any) => e.created_at.slice(0, 10) === day).length,
    }));

    const bySource = ['marketplace', 'community'].map(source => ({
      source,
      impressions: impressions.filter((e: any) => e.meta?.source === source).length,
      clicks:      clicks.filter((e: any) => e.meta?.source === source).length,
    }));

    const ctr = impressions.length > 0
      ? Math.round((clicks.length / impressions.length) * 1000) / 10
      : 0;

    return NextResponse.json({
      impressions:  { total: impressions.length, daily: dailyImpressions },
      clicks:       { total: clicks.length,      daily: dailyClicks },
      ctr,
      bySource,
    });
  } catch (err) {
    console.error('[boost-analytics]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
