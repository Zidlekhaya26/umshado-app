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
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    // 1. Active boost campaigns — two explicit queries (no FK join)
    const { data: rawBoosts, error: boostErr } = await supabase
      .from('vendor_boosts')
      .select('id, vendor_id, ad_headline, ad_body, ad_cta, ad_image_url, discount_pct')
      .eq('status', 'active')
      .gt('ends_at', now)
      .order('created_at', { ascending: false }); // newest first

    if (boostErr) console.error('[ads/active] boosts:', boostErr.message);

    // Deduplicate: keep only the most recent boost per vendor
    const seenVendors = new Set<string>();
    const boosts = (rawBoosts ?? []).filter((b: any) => {
      if (!b.vendor_id || seenVendors.has(b.vendor_id)) return false;
      seenVendors.add(b.vendor_id);
      return true;
    });

    const boostedVendorIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boostAds: any[] = [];

    if (boosts.length > 0) {
      const vendorIds = [...new Set(boosts.map((b: any) => b.vendor_id).filter(Boolean))];
      const { data: vendorRows } = await supabase
        .from('vendors')
        .select('id, business_name, category, description, city, verified, subscription_tier, promo_image_url, promo_discount_pct')
        .in('id', vendorIds);

      const vendorMap = new Map<string, VendorRow>(
        (vendorRows ?? []).map((v: VendorRow) => [v.id, v])
      );

      for (const b of boosts as any[]) {
        const v: VendorRow | null = vendorMap.get(b.vendor_id) ?? null;
        if (v?.id) boostedVendorIds.add(v.id);
        const category = v?.category ?? 'Planning & Coordination';
        boostAds.push({
          id: b.id,
          vendorId: v?.id ?? b.vendor_id,
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
        });
      }
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
  } catch (err) {
    console.error('[ads/active] unexpected error:', err);
    return NextResponse.json({ ads: [] });
  }
}
