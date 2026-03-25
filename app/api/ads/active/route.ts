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
  'Transport':                     '#3b82f6',
  'Furniture & Equipment Hire':    '#84cc16',
  'Special Effects & Experiences': '#f97316',
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
  'Transport':                     '🚗',
  'Furniture & Equipment Hire':    '🪑',
  'Special Effects & Experiences': '✨',
};

type VendorRow = {
  id: string;
  business_name: string;
  category: string;
  description: string | null;
  city: string | null;
  verified: boolean;
  subscription_tier: string | null;
};

function autoAd(v: VendorRow) {
  const category = v.category ?? 'Planning & Coordination';
  const city = v.city ? ` · ${v.city}` : '';
  const body = v.description
    ? v.description.slice(0, 120).trimEnd() + (v.description.length > 120 ? '…' : '')
    : `Professional ${category.toLowerCase()} services for your special day${city}.`;

  return {
    id: `pro-${v.id}`,
    vendorId: v.id,
    headline: `${v.business_name.trim()} — ${category}`,
    body,
    cta: 'View Profile',
    category,
    color: CAT_COLOR[category] ?? '#9A2143',
    emoji: CAT_EMOJI[category] ?? '🌟',
    badge: v.verified ? 'Verified Pro' : 'Pro Vendor',
  };
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    // 1. Paid boost campaigns (vendor_boosts table — R199/mo)
    const { data: boosts } = await supabase
      .from('vendor_boosts')
      .select('id, ad_headline, ad_body, ad_cta, vendor:vendor_id ( id, business_name, category, description, city, verified, subscription_tier )')
      .eq('status', 'active')
      .gt('ends_at', now)
      .order('created_at');

    const boostedVendorIds = new Set<string>();
    const boostAds = (boosts ?? []).map(b => {
      const v = b.vendor as unknown as VendorRow | null;
      if (v?.id) boostedVendorIds.add(v.id);
      const category = v?.category ?? 'Planning & Coordination';
      return {
        id: b.id,
        vendorId: v?.id ?? null,
        headline: b.ad_headline ?? v?.business_name ?? 'Featured Vendor',
        body: b.ad_body ?? (v ? autoAd(v).body : ''),
        cta: b.ad_cta ?? 'View Profile',
        category,
        color: CAT_COLOR[category] ?? '#9A2143',
        emoji: CAT_EMOJI[category] ?? '🌟',
        badge: v?.verified ? 'Verified Pro' : 'Sponsored',
      };
    });

    // 2. Pro/trial subscribers without a paid boost — auto-generate ad from profile
    const { data: proVendors } = await supabase
      .from('vendors')
      .select('id, business_name, category, description, city, verified, subscription_tier')
      .in('subscription_tier', ['pro', 'trial'])
      .eq('is_published', true)
      .order('business_name');

    const proAds = (proVendors ?? [])
      .filter((v: VendorRow) => !boostedVendorIds.has(v.id))
      .map((v: VendorRow) => autoAd(v));

    const ads = [...boostAds, ...proAds];
    return NextResponse.json({ ads });
  } catch {
    return NextResponse.json({ ads: [] });
  }
}
