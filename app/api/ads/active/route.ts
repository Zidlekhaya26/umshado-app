import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

const CAT_COLOR: Record<string, string> = {
  'Photography & Video':           '#3a7bec',
  'Planning & Coordination':       '#14b8a6',
  'Wedding Venues':                '#10b981',
  'Makeup & Hair':                 '#ec4899',
  'Catering & Food':               '#e8523a',
  'Music, DJ & Sound':             '#f59e0b',
  'Décor & Styling':               '#c45ec4',
  'Attire & Fashion':              '#8b5cf6',
  'Support Services':              '#6366f1',
  'Honeymoon & Travel':            '#06b6d4',
};

const CAT_EMOJI: Record<string, string> = {
  'Photography & Video':           '📸',
  'Planning & Coordination':       '📋',
  'Wedding Venues':                '🏛️',
  'Makeup & Hair':                 '💄',
  'Catering & Food':               '🍽️',
  'Music, DJ & Sound':             '🎵',
  'Décor & Styling':               '💐',
  'Attire & Fashion':              '👗',
  'Support Services':              '🛡️',
  'Honeymoon & Travel':            '✈️',
};

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('vendor_boosts')
      .select(`
        id, ad_headline, ad_body, ad_cta,
        vendor:vendor_id ( id, business_name, category, verified )
      `)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .order('created_at');

    if (!data || data.length === 0) {
      return NextResponse.json({ ads: [] });
    }

    const ads = data.map(b => {
      const v = b.vendor as unknown as { id: string; business_name: string; category: string; verified: boolean } | null;
      const category = v?.category ?? 'Planning & Coordination';
      return {
        id: b.id,
        vendorId: v?.id ?? null,
        headline: b.ad_headline ?? v?.business_name ?? 'Featured Vendor',
        body: b.ad_body ?? '',
        cta: b.ad_cta ?? 'View Profile',
        category,
        color: CAT_COLOR[category] ?? '#9A2143',
        emoji: CAT_EMOJI[category] ?? '🌟',
        badge: v?.verified ? 'Verified Pro' : 'Sponsored',
      };
    });

    return NextResponse.json({ ads });
  } catch {
    return NextResponse.json({ ads: [] });
  }
}
