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
  promo_image_url: string | null;
  promo_discount_pct: number | null;
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
    vendorName: v.business_name.trim(),
    headline: `${v.business_name.trim()} — ${category}`,
    body,
    cta: 'View Profile',
    category,
    color: CAT_COLOR[category] ?? '#9A2143',
    emoji: CAT_EMOJI[category] ?? '🌟',
    badge: v.verified ? 'Verified Pro' : 'Pro Vendor',
    imageUrl: v.promo_image_url ?? null,
    discountPct: v.promo_discount_pct ?? null,
  };
}

export async function GET() {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // 1. Active boost campaigns — two queries to avoid FK-join failures
  const { data: boosts, error: boostErr } = await supabase
    .from('vendor_boosts')
    .select('id, vendor_id, ad_headline, ad_body, ad_cta, ad_image_url, discount_pct')
    .eq('status', 'active')
    .gt('ends_at', now)
    .order('created_at');

  if (boostErr) console.error('[ads/active] boosts query:', boostErr.message);

  const boostedVendorIds = new Set<string>();
  let boostAds: ReturnType<typeof autoAd>[] = [];

  if (boosts && boosts.length > 0) {
    const vendorIds = [...new Set(boosts.map(b => b.vendor_id).filter(Boolean))];
    const { data: vendorRows, error: vErr } = await supabase
      .from('vendors')
      .select('id, business_name, category, description, city, verified, subscription_tier, promo_image_url, promo_discount_pct')
      .in('id', vendorIds);

    if (vErr) console.error('[ads/active] vendor lookup:', vErr.message);

    const vendorMap = new Map<string, VendorRow>((vendorRows ?? []).map(v => [v.id, v]));

    boostAds = boosts.map(b => {
      const v = vendorMap.get(b.vendor_id) ?? null;
      if (v?.id) boostedVendorIds.add(v.id);
      const category = v?.category ?? 'Planning & Coordination';
      return {
        id: b.id,
        vendorId: v?.id ?? null,
        vendorName: v?.business_name?.trim() ?? null,
        headline: b.ad_headline ?? v?.business_name?.trim() ?? 'Featured Vendor',
        body: b.ad_body ?? (v ? autoAd(v).body : ''),
        cta: b.ad_cta ?? 'View Profile',
        category,
        color: CAT_COLOR[category] ?? '#9A2143',
        emoji: CAT_EMOJI[category] ?? '🌟',
        badge: v?.verified ? 'Verified Pro' : 'Sponsored',
        imageUrl: b.ad_image_url ?? v?.promo_image_url ?? null,
        discountPct: b.discount_pct ?? v?.promo_discount_pct ?? null,
      };
    });
  }

  // 2. Pro/trial vendors without a paid boost — auto-generate ad
  const { data: proVendors, error: proErr } = await supabase
    .from('vendors')
    .select('id, business_name, category, description, city, verified, subscription_tier, promo_image_url, promo_discount_pct')
    .in('subscription_tier', ['pro', 'trial'])
    .eq('is_published', true)
    .order('business_name');

  if (proErr) console.error('[ads/active] pro vendors:', proErr.message);

  const proAds = (proVendors ?? [])
    .filter((v: VendorRow) => !boostedVendorIds.has(v.id))
    .map((v: VendorRow) => autoAd(v));

  return NextResponse.json({ ads: [...boostAds, ...proAds] });
}
