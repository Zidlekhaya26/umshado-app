'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import VendorBottomNav from '@/components/VendorBottomNav';
import { CR, CR2, CRX, GD, MUT, BOR, BG } from '@/lib/tokens';

/* ── Types ─────────────────────────────────────────────── */
interface EnrichedQuote {
  id: string;
  quote_ref: string;
  package_name: string;
  pricing_mode: string | null;
  guest_count: number | null;
  hours: number | null;
  base_from_price: number | null;
  notes: string | null;
  status: string;
  vendor_message: string | null;
  vendor_final_price: number | null;
  created_at: string;
  couple_id: string;
  couple_name: string;
  couple_avatar: string | null;
}

type FilterTab = 'all' | 'requested' | 'negotiating' | 'accepted' | 'declined';

/* ── Helpers ────────────────────────────────────────────── */
function fmtDate(ts: string): string {
  return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPrice(n: number | null): string {
  if (!n) return 'TBD';
  return 'R ' + n.toLocaleString('en-ZA');
}
function initials(name: string): string {
  return name.split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function avatarColor(str: string): string {
  const colors = [CR, '#3a7bec', '#8b5cf6', '#e8523a', GD, '#14b8a6', '#6366f1', '#f97316'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'New',
  negotiating: 'Active',
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

/* ── Skeleton ────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${BOR}`, padding: '18px', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', animation: 'pulse 1.4s ease-in-out infinite' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f3f4f6' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '55%', background: '#f3f4f6', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 11, width: '35%', background: '#f3f4f6', borderRadius: 6 }} />
        </div>
        <div style={{ height: 11, width: 60, background: '#f3f4f6', borderRadius: 6 }} />
      </div>
      <div style={{ height: 11, width: '40%', background: '#f3f4f6', borderRadius: 6, marginBottom: 10 }} />
      <div style={{ height: 13, width: '70%', background: '#f3f4f6', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 13, width: '50%', background: '#f3f4f6', borderRadius: 6 }} />
    </div>
  );
}

/* ── Quote Card ──────────────────────────────────────────── */
function QuoteCard({
  quote,
  vendorId,
  onStatusChange,
  onChat,
}: {
  quote: EnrichedQuote;
  vendorId: string;
  onStatusChange: (id: string, status: string) => void;
  onChat: (coupleId: string) => void;
}) {
  const statusColor = STATUS_COLOR[quote.status] ?? MUT;
  const statusBg = STATUS_BG[quote.status] ?? 'rgba(122,80,96,0.1)';
  const acol = avatarColor(quote.couple_id);

  return (
    <div style={{ background: '#fff', borderRadius: 20, border: `1.5px solid ${BOR}`, padding: '18px', boxShadow: '0 2px 12px rgba(26,13,18,0.07)' }}>
      {/* Row 1: avatar + name + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: quote.couple_avatar ? undefined : `linear-gradient(135deg,${acol},${acol}cc)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {quote.couple_avatar
            ? <img src={quote.couple_avatar} alt={quote.couple_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'Georgia,serif' }}>{initials(quote.couple_name)}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.couple_name}</p>
        </div>
        <span style={{ fontSize: 11, color: MUT, flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtDate(quote.created_at)}</span>
      </div>

      {/* Row 2: Quote ref pill */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'rgba(122,80,96,0.07)', color: MUT, border: `1px solid ${BOR}`, fontFamily: 'monospace' }}>{quote.quote_ref}</span>
      </div>

      {/* Row 3: Package + pricing info + price */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>{quote.package_name}</p>
          <p style={{ margin: 0, fontSize: 11.5, color: MUT }}>
            {quote.guest_count ? `${quote.guest_count} guests` : ''}
            {quote.guest_count && quote.hours ? ' · ' : ''}
            {quote.hours ? `${quote.hours}h` : ''}
            {quote.pricing_mode ? (quote.guest_count || quote.hours ? ` · ${quote.pricing_mode}` : quote.pricing_mode) : ''}
          </p>
        </div>
        {quote.base_from_price && (
          <span style={{ fontSize: 15, fontWeight: 800, color: GD, fontFamily: 'Georgia,serif', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtPrice(quote.base_from_price)}</span>
        )}
      </div>

      {/* Row 4: Notes */}
      {quote.notes && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.5, borderLeft: `3px solid ${BOR}`, paddingLeft: 10 }}>
          "{quote.notes.slice(0, 150)}{quote.notes.length > 150 ? '…' : ''}"
        </p>
      )}

      {/* Row 5: Status badge + actions */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: statusBg, color: statusColor, border: `1px solid ${statusColor}30` }}>
          {STATUS_LABEL[quote.status] ?? quote.status}
        </span>

        {quote.status === 'requested' && (
          <>
            <button
              onClick={() => onStatusChange(quote.id, 'accepted')}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'transparent', color: '#16a34a', border: '1.5px solid #16a34a', cursor: 'pointer' }}
            >Accept</button>
            <button
              onClick={() => onStatusChange(quote.id, 'declined')}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'transparent', color: '#9ca3af', border: '1.5px solid #d1d5db', cursor: 'pointer' }}
            >Decline</button>
            <button
              onClick={() => onChat(quote.couple_id)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: CR, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 2px 8px ${CR}35` }}
            >Chat</button>
          </>
        )}

        {quote.status === 'negotiating' && (
          <>
            <button
              onClick={() => onChat(quote.couple_id)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: CR, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 2px 8px ${CR}35` }}
            >Chat</button>
            <button
              onClick={() => onStatusChange(quote.id, 'accepted')}
              style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'transparent', color: '#16a34a', border: '1.5px solid #16a34a', cursor: 'pointer' }}
            >Mark Accepted</button>
          </>
        )}

        {quote.status === 'accepted' && (
          <button
            onClick={() => onChat(quote.couple_id)}
            style={{ fontSize: 11.5, fontWeight: 700, padding: '6px 14px', borderRadius: 20, background: 'transparent', color: CR, border: `1.5px solid ${CR}`, cursor: 'pointer' }}
          >Chat</button>
        )}

        {quote.status === 'declined' && (
          <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>No further action needed</span>
        )}
      </div>
    </div>
  );
}

/* ── Empty State ─────────────────────────────────────────── */
function EmptyState({ filter }: { filter: FilterTab }) {
  const messages: Record<FilterTab, { title: string; sub: string }> = {
    all: { title: 'No enquiries yet', sub: 'When couples request quotes, they will appear here.' },
    requested: { title: 'No new enquiries', sub: 'New quote requests from couples will show here.' },
    negotiating: { title: 'No active negotiations', sub: 'Quotes in discussion will appear here.' },
    accepted: { title: 'No accepted quotes', sub: 'Quotes you have accepted will appear here.' },
    declined: { title: 'No declined quotes', sub: 'Quotes you have declined will appear here.' },
  };
  const { title, sub } = messages[filter];
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: `rgba(154,33,67,0.07)`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="28" height="28" fill="none" stroke={CR} strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, color: MUT, lineHeight: 1.5 }}>{sub}</p>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────── */
export default function VendorEnquiriesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<EnrichedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  /* Load data */
  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) { router.push('/login'); return; }

      const { data: vendorRow } = await supabase
        .from('vendors').select('id').eq('user_id', user.id).maybeSingle();
      if (!vendorRow?.id) { setLoading(false); return; }
      setVendorId(vendorRow.id);

      const { data: rawQuotes } = await supabase
        .from('quotes')
        .select('id, quote_ref, package_name, pricing_mode, guest_count, hours, base_from_price, notes, status, vendor_message, vendor_final_price, created_at, couple_id')
        .eq('vendor_id', vendorRow.id)
        .order('created_at', { ascending: false });

      if (!rawQuotes) { setLoading(false); return; }

      /* Enrich quotes with couple info via service-client API (bypasses RLS) */
      const coupleIds = [...new Set(rawQuotes.map(q => q.couple_id))];
      const { data: { session: enqSession } } = await supabase.auth.getSession();
      const enqToken = enqSession?.access_token || '';
      const namesRes = await fetch('/api/vendor/couple-names', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${enqToken}` }, body: JSON.stringify({ coupleIds }) });
      const namesJson = namesRes.ok ? await namesRes.json() : { couples: [], profiles: [] };
      const cMap = new Map<string, { partner_name: string | null; avatar_url: string | null }>((namesJson.couples || []).map((c: any) => [c.id, c]));
      const pMap = new Map<string, { full_name: string | null }>((namesJson.profiles || []).map((p: any) => [p.id, p]));
      const enriched: EnrichedQuote[] = rawQuotes.map(q => {
        const full_name = pMap.get(q.couple_id)?.full_name ?? '';
        const partner_name = cMap.get(q.couple_id)?.partner_name ?? '';
        const couple_name = full_name && partner_name ? `${full_name} & ${partner_name}` : full_name || partner_name || 'Couple';
        return { ...q, couple_name, couple_avatar: cMap.get(q.couple_id)?.avatar_url ?? null } as EnrichedQuote;
      });

      setQuotes(enriched);
      setLoading(false);
    })();
  }, []);

  /* Status update */
  const updateStatus = useCallback(async (quoteId: string, newStatus: string) => {
    await supabase.from('quotes').update({ status: newStatus }).eq('id', quoteId);
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
  }, []);

  /* Open / create conversation */
  const openChat = useCallback(async (coupleId: string) => {
    if (!vendorId) return;
    const { data: existing } = await supabase.from('conversations').select('id')
      .eq('couple_id', coupleId).eq('vendor_id', vendorId).maybeSingle();
    if (existing?.id) { router.push('/messages/thread/' + existing.id); return; }
    const { data: newConv, error } = await supabase.from('conversations')
      .insert({ couple_id: coupleId, vendor_id: vendorId }).select('id').single();
    if (error?.code === '23505') {
      const { data: retry } = await supabase.from('conversations').select('id')
        .eq('couple_id', coupleId).eq('vendor_id', vendorId).maybeSingle();
      if (retry?.id) router.push('/messages/thread/' + retry.id);
    } else if (newConv?.id) {
      router.push('/messages/thread/' + newConv.id);
    }
  }, [vendorId, router]);

  /* Filtered quotes */
  const filtered = activeFilter === 'all'
    ? quotes
    : quotes.filter(q => q.status === activeFilter);

  const tabs: { label: string; value: FilterTab; count?: number }[] = [
    { label: 'All', value: 'all', count: quotes.length },
    { label: 'New', value: 'requested', count: quotes.filter(q => q.status === 'requested').length },
    { label: 'Active', value: 'negotiating', count: quotes.filter(q => q.status === 'negotiating').length },
    { label: 'Accepted', value: 'accepted', count: quotes.filter(q => q.status === 'accepted').length },
    { label: 'Declined', value: 'declined', count: quotes.filter(q => q.status === 'declined').length },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: BG, fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        ::-webkit-scrollbar { display:none }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(160deg, #4d0f21 0%, #9A2143 52%, #c03050 100%)', paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(189,152,63,0.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 40, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(189,152,63,0.06)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 16px' }}>
          <Link href="/vendor/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', marginBottom: 12 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Dashboard
          </Link>
          <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'Georgia,serif', lineHeight: 1.15 }}>Enquiries</h1>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>Quote requests from couples</p>

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
                vendorId={vendorId!}
                onStatusChange={updateStatus}
                onChat={openChat}
              />
            ))}
          </div>
        )}
      </div>

      <VendorBottomNav />
    </div>
  );
}
