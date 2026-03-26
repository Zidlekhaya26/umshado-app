'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import BottomNav from '@/components/BottomNav';
import { CR, CR2, CRX, GD, MUT, BOR, BG } from '@/lib/tokens';

/* ── Types ─────────────────────────────────────────────── */
interface EnrichedQuote {
  id: string;
  quote_ref: string;
  package_name: string;
  base_from_price: number | null;
  vendor_final_price: number | null;
  guest_count: number | null;
  hours: number | null;
  notes: string | null;
  status: string;
  vendor_message: string | null;
  created_at: string;
  vendor_id: string;
  vendor_name: string;
  vendor_category: string;
  vendor_logo: string | null;
}

type FilterTab = 'all' | 'requested' | 'negotiating' | 'accepted';

/* ── Category config ─────────────────────────────────────── */
const CAT_CONFIG: Record<string, { icon: string; color: string }> = {
  'Catering & Food':               { icon: '🍽️', color: '#e8523a' },
  'Décor & Styling':               { icon: '💐', color: '#c45ec4' },
  'Photography & Video':           { icon: '📸', color: '#3a7bec' },
  'Music, DJ & Sound':             { icon: '🎵', color: '#f59e0b' },
  'Makeup & Hair':                 { icon: '💄', color: '#ec4899' },
  'Attire & Fashion':              { icon: '👗', color: '#8b5cf6' },
  'Wedding Venues':                { icon: '🏛️', color: '#10b981' },
  'Transport':                     { icon: '🚗', color: '#3b82f6' },
  'Honeymoon & Travel':            { icon: '✈️', color: '#06b6d4' },
  'Support Services':              { icon: '🛡️', color: '#6366f1' },
  'Furniture & Equipment Hire':    { icon: '🪑', color: '#84cc16' },
  'Special Effects & Experiences': { icon: '✨', color: '#f97316' },
  'Planning & Coordination':       { icon: '📋', color: '#14b8a6' },
};

/* ── Helpers ─────────────────────────────────────────────── */
function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPrice(n: number | null): string {
  if (!n) return 'TBD';
  return 'R ' + n.toLocaleString('en-ZA');
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Pending',
  negotiating: 'In Discussion',
  accepted: 'Accepted',
  declined: 'Declined',
};
const STATUS_COLOR: Record<string, string> = {
  requested: '#f59e0b',
  negotiating: '#3a7bec',
  accepted: '#16a34a',
  declined: '#9ca3af',
};
const STATUS_BG: Record<string, string> = {
  requested: 'rgba(245,158,11,0.1)',
  negotiating: 'rgba(58,123,236,0.1)',
  accepted: 'rgba(22,163,74,0.1)',
  declined: 'rgba(156,163,175,0.1)',
};

/* ── Skeleton ─────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${BOR}`, padding: '18px', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', animation: 'pulse 1.4s ease-in-out infinite' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '60%', background: '#f3f4f6', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 11, width: '40%', background: '#f3f4f6', borderRadius: 6 }} />
        </div>
        <div style={{ height: 18, width: 65, background: '#f3f4f6', borderRadius: 20 }} />
      </div>
      <div style={{ height: 13, width: '55%', background: '#f3f4f6', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 13, width: '40%', background: '#f3f4f6', borderRadius: 6 }} />
    </div>
  );
}

/* ── Quote Card ───────────────────────────────────────────── */
function QuoteCard({
  quote,
  userId,
  onChat,
}: {
  quote: EnrichedQuote;
  userId: string;
  onChat: (vendorId: string) => void;
}) {
  const catCfg = CAT_CONFIG[quote.vendor_category] ?? { icon: '🏪', color: CR };
  const statusColor = STATUS_COLOR[quote.status] ?? MUT;
  const statusBg = STATUS_BG[quote.status] ?? 'rgba(122,80,96,0.1)';
  const showRevised = quote.vendor_final_price && quote.vendor_final_price !== quote.base_from_price;

  return (
    <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${BOR}`, padding: '18px', boxShadow: '0 2px 12px rgba(26,13,18,0.07)' }}>
      {/* Top row: logo + vendor name + category pill + status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${catCfg.color}14`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1.5px solid ${catCfg.color}25` }}>
          {quote.vendor_logo
            ? <img src={quote.vendor_logo} alt={quote.vendor_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 18 }}>{catCfg.icon}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.vendor_name}</p>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${catCfg.color}12`, color: catCfg.color, border: `1px solid ${catCfg.color}22` }}>
            {quote.vendor_category.split('&')[0].trim()}
          </span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: statusBg, color: statusColor, border: `1px solid ${statusColor}30`, flexShrink: 0 }}>
          {STATUS_LABEL[quote.status] ?? quote.status}
        </span>
      </div>

      {/* Package + price row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>{quote.package_name}</p>
          <p style={{ margin: 0, fontSize: 11, color: MUT }}>
            {quote.guest_count ? `${quote.guest_count} guests` : ''}
            {quote.guest_count && quote.hours ? ' · ' : ''}
            {quote.hours ? `${quote.hours}h` : ''}
          </p>
        </div>
        {quote.base_from_price && (
          <span style={{ fontSize: 15, fontWeight: 800, color: GD, fontFamily: 'Georgia,serif', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtPrice(quote.base_from_price)}</span>
        )}
      </div>

      {/* Date sent */}
      <p style={{ margin: '0 0 8px', fontSize: 11, color: MUT }}>Sent {fmtDate(quote.created_at)}</p>

      {/* Revised quote from vendor */}
      {showRevised && (
        <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 10, background: `rgba(189,152,63,0.07)`, border: `1px solid rgba(189,152,63,0.2)` }}>
          <span style={{ fontSize: 12, color: GD, fontWeight: 700 }}>Revised quote: {fmtPrice(quote.vendor_final_price)}</span>
        </div>
      )}

      {/* Vendor message / reply */}
      {quote.vendor_message && (
        <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(58,123,236,0.05)', border: '1px solid rgba(58,123,236,0.12)' }}>
          <p style={{ margin: '0 0 3px', fontSize: 10.5, fontWeight: 700, color: '#3a7bec', letterSpacing: 0.3 }}>VENDOR REPLIED</p>
          <p style={{ margin: 0, fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{quote.vendor_message}</p>
        </div>
      )}

      {/* Action buttons */}
      {quote.status !== 'declined' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <Link
            href={`/v/${quote.vendor_id}`}
            style={{ flex: 1, textAlign: 'center', padding: '8px 14px', borderRadius: 20, background: 'transparent', color: CR, border: `1.5px solid ${CR}`, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
          >
            View Vendor
          </Link>
          <button
            onClick={() => onChat(quote.vendor_id)}
            style={{ flex: 1, padding: '8px 14px', borderRadius: 20, background: CR, color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: `0 2px 8px ${CR}35` }}
          >
            Chat
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */
function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; sub: string }> = {
    all: { title: 'No enquiries yet', sub: 'Browse vendors and request a quote to get started.' },
    requested: { title: 'No pending quotes', sub: 'Quotes awaiting vendor response will appear here.' },
    negotiating: { title: 'No active discussions', sub: 'Quotes in discussion with vendors will appear here.' },
    accepted: { title: 'No accepted quotes', sub: 'Quotes accepted by vendors will appear here.' },
  };
  const { title, sub } = messages[filter];
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: `rgba(154,33,67,0.07)`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" fill="none" stroke={CR} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>{title}</p>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: MUT, lineHeight: 1.5 }}>{sub}</p>
      {filter === 'all' && (
        <Link href="/marketplace" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 22, background: `linear-gradient(135deg,${CR},${CR2})`, color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none', boxShadow: `0 3px 12px ${CR}35` }}>
          Browse Vendors
        </Link>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function CoupleQuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<EnrichedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: rawQuotes } = await supabase
        .from('quotes')
        .select('id, quote_ref, package_name, base_from_price, vendor_final_price, guest_count, hours, notes, status, vendor_message, created_at, vendor_id')
        .eq('couple_id', user.id)
        .order('created_at', { ascending: false });

      if (!rawQuotes) { setLoading(false); return; }

      const enriched = await Promise.all(rawQuotes.map(async (q) => {
        const { data: vd } = await supabase
          .from('vendors').select('id, business_name, category, logo_url')
          .eq('id', q.vendor_id).maybeSingle();
        return {
          ...q,
          vendor_name: vd?.business_name ?? 'Vendor',
          vendor_category: vd?.category ?? 'Planning & Coordination',
          vendor_logo: vd?.logo_url ?? null,
        } as EnrichedQuote;
      }));

      setQuotes(enriched);
      setLoading(false);
    })();
  }, []);

  /* Open / create conversation */
  const openChat = useCallback(async (vendorId: string) => {
    if (!userId) return;
    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('couple_id', userId).eq('vendor_id', vendorId).maybeSingle();
    if (existing?.id) { router.push('/messages/thread/' + existing.id); return; }
    const { data: newConv, error } = await supabase.from('conversations')
      .insert({ couple_id: userId, vendor_id: vendorId }).select('id').single();
    if (error?.code === '23505') {
      const { data: retry } = await supabase.from('conversations').select('id')
        .eq('couple_id', userId).eq('vendor_id', vendorId).maybeSingle();
      if (retry?.id) router.push('/messages/thread/' + retry.id);
    } else if (newConv?.id) {
      router.push('/messages/thread/' + newConv.id);
    }
  }, [userId, router]);

  const filtered = activeFilter === 'all'
    ? quotes
    : quotes.filter(q => q.status === activeFilter);

  const tabs: { label: string; value: FilterTab; count?: number }[] = [
    { label: 'All', value: 'all', count: quotes.length },
    { label: 'Pending', value: 'requested', count: quotes.filter(q => q.status === 'requested').length },
    { label: 'Active', value: 'negotiating', count: quotes.filter(q => q.status === 'negotiating').length },
    { label: 'Accepted', value: 'accepted', count: quotes.filter(q => q.status === 'accepted').length },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { display:none }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #4d0f21 0%, #9A2143 52%, #c03050 100%)', paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(189,152,63,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 40, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(189,152,63,0.06)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 16px' }}>
          <Link href="/couple/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', marginBottom: 12 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Dashboard
          </Link>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1.15 }}>My Enquiries</h1>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Quotes you have sent to vendors</p>

          {/* Gold shimmer line */}
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${GD}, transparent)`, marginBottom: 16, borderRadius: 1 }} />

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {tabs.map(tab => {
              const isActive = activeFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  style={{
                    flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                    fontSize: 12.5, fontWeight: isActive ? 800 : 600,
                    borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff' }}>{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 100px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(q => (
              <QuoteCard
                key={q.id}
                quote={q}
                userId={userId!}
                onChat={openChat}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
