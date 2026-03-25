'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';

interface SavedVendor {
  id: string;
  created_at: string;
  vendor: {
    id: string;
    business_name: string;
    category: string;
    location: string | null;
    rating: number | null;
    review_count: number | null;
    verified: boolean;
    cover_url: string | null;
    portfolio_urls: string[] | null;
  };
}

const CAT_COLOR: Record<string, string> = {
  'Photography & Video': '#3a7bec',
  'Planning & Coordination': '#14b8a6',
  'Wedding Venues': '#10b981',
  'Makeup & Hair': '#ec4899',
  'Catering & Food': '#e8523a',
  'Music, DJ & Sound': '#f59e0b',
  'Décor & Styling': '#c45ec4',
  'Attire & Fashion': '#8b5cf6',
  'Support Services': '#6366f1',
  'Honeymoon & Travel': '#06b6d4',
  'Transport': '#3b82f6',
  'Furniture & Equipment Hire': '#84cc16',
  'Special Effects & Experiences': '#f97316',
};

export default function SavedVendorsPage() {
  const [saved, setSaved] = useState<SavedVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('saved_vendors')
        .select('id, created_at, vendor:vendor_id ( id, business_name, category, location, rating, review_count, verified, cover_url, portfolio_urls )')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setSaved((data ?? []) as unknown as SavedVendor[]);
      setLoading(false);
    })();
  }, []);

  const unsave = async (savedId: string, vendorId: string) => {
    setSaved(prev => prev.filter(s => s.id !== savedId));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('saved_vendors').delete().eq('user_id', user.id).eq('vendor_id', vendorId);
    }
  };

  return (
    <div style={{ minHeight: '100svh', background: '#faf8f5', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg,#4d0f21 0%,#9A2143 52%,#c03050 100%)', padding: '24px 20px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 130, height: 130, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.12)', pointerEvents: 'none' }} />
        <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Saved Vendors</h1>
        <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>
          {loading ? 'Loading...' : `${saved.length} vendor${saved.length !== 1 ? 's' : ''} saved`}
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 14px calc(90px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Empty state */}
        {!loading && saved.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(154,33,67,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" fill="none" stroke="#9A2143" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>No saved vendors yet</p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Tap the heart on any vendor profile to save them here</p>
            <Link href="/marketplace" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#4d0f21,#9A2143)', color: '#fff', fontSize: 13.5, fontWeight: 700, textDecoration: 'none' }}>
              Browse Vendors
            </Link>
          </div>
        )}

        {/* Vendor cards */}
        {saved.map(s => {
          const v = s.vendor;
          const color = CAT_COLOR[v.category] ?? '#9A2143';
          const thumb = v.cover_url || (v.portfolio_urls?.[0]) || null;

          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 18, border: '1px solid #f1efec', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', overflow: 'hidden', display: 'flex' }}>
              {/* Thumbnail */}
              <div style={{ width: 90, flexShrink: 0, background: `${color}18`, position: 'relative', overflow: 'hidden' }}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={v.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: color }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, padding: '14px 14px 12px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.business_name}</p>
                      {v.verified && (
                        <svg width="14" height="14" fill="#2563eb" viewBox="0 0 24 24">
                          <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${color}15`, color, border: `1px solid ${color}25` }}>
                      {v.category}
                    </span>
                  </div>
                  {/* Unsave button */}
                  <button onClick={() => unsave(s.id, v.id)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9A2143' }}>
                    <svg width="18" height="18" fill="#9A2143" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {v.location && (
                      <span style={{ fontSize: 11.5, color: '#6b7280' }}>{v.location}</span>
                    )}
                    {v.rating && (
                      <span style={{ fontSize: 11.5, color: '#f59e0b', fontWeight: 700 }}>
                        {v.rating.toFixed(1)} ({v.review_count ?? 0})
                      </span>
                    )}
                  </div>
                  <Link href={`/marketplace/vendor/${v.id}`} style={{ fontSize: 12, fontWeight: 700, color: '#9A2143', textDecoration: 'none' }}>
                    View →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
