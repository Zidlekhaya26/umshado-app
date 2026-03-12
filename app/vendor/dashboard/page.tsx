'use client';

import { useState, useEffect } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import VendorBottomNav from '@/components/VendorBottomNav';
import VerificationRequestCard from '@/components/VerificationRequestCard';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

/* ─── Types ─────────────────────────────────────────────── */
interface VendorProfile {
  id: string; business_name: string | null; category: string | null;
  location: string | null; description: string | null; logo_url: string | null;
  is_published: boolean; contact: { whatsapp?: string; phone?: string } | null;
  portfolio_urls?: string[]; plan?: string | null; verified?: boolean;
}
interface Quote {
  id: string; quote_ref: string; package_name: string; guest_count: number;
  hours: number; base_from_price: number; status: string; created_at: string;
  couple_id: string; couple_name: string; couple_avatar?: string | null;
}
interface Metrics {
  profileViews: number; savedByCouples: number;
  chatsStarted: number; quotesReceived: number;
}
interface DayStat { day: string; profile_views: number; quotes: number; messages: number; saves: number; }

/* ─── Design tokens ──────────────────────────────────────── */
const GOLD    = '#b8973e';
const DARK    = '#18100a';
const BG      = '#faf7f2';

/* ─── Mini sparkline chart ───────────────────────────────── */
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={'sg_' + dataKey} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          fill={'url(#sg_' + dataKey + ')'} dot={false} />
        <Tooltip contentStyle={{ display: 'none' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Stat card with sparkline ───────────────────────────── */
function StatCard({ icon, label, value, color, sparkData, sparkKey, note }: {
  icon: string; label: string; value: number; color: string;
  sparkData: any[]; sparkKey: string; note?: string;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 18, padding: '16px 16px 8px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 10, color: '#9a7c58', fontWeight: 600, marginTop: 1 }}>{label}</div>
        </div>
      </div>
      {note ? (
        <div style={{ fontSize: 10, color: '#b0a090', fontStyle: 'italic', paddingBottom: 8 }}>{note}</div>
      ) : (
        <Sparkline data={sparkData} dataKey={sparkKey} color={color} />
      )}
    </div>
  );
}

/* ─── Quote card ─────────────────────────────────────────── */
function QuoteCard({ quote, status, format, onChat }: {
  quote: Quote; status: 'requested' | 'negotiating';
  format: (n: number) => string; onChat: () => void;
}) {
  const isPending = status === 'requested';
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: isPending ? '1.5px solid rgba(184,151,62,0.4)' : '1.5px solid rgba(26,106,168,0.3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {quote.couple_avatar ? (
          <img src={quote.couple_avatar} alt={quote.couple_name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#9A2143,#731832)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            {(quote.couple_name || 'C').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.couple_name}</div>
          <div style={{ fontSize: 10, color: '#9a7c58', marginTop: 1 }}>{quote.quote_ref}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: isPending ? 'rgba(184,151,62,0.12)' : 'rgba(26,106,168,0.1)', color: isPending ? '#8a6010' : '#1a6aa8' }}>
          {isPending ? 'Pending' : 'Negotiating'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <div style={{ background: '#faf7f2', borderRadius: 8, padding: '6px 10px' }}>
          <div style={{ fontSize: 9, color: '#9a7c58', fontWeight: 600, marginBottom: 2 }}>PACKAGE</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.package_name}</div>
        </div>
        <div style={{ background: '#faf7f2', borderRadius: 8, padding: '6px 10px' }}>
          <div style={{ fontSize: 9, color: '#9a7c58', fontWeight: 600, marginBottom: 2 }}>ESTIMATE</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{format(Number(quote.base_from_price))}</div>
        </div>
      </div>
      <button onClick={onChat} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: isPending ? 'linear-gradient(135deg,#b8973e,#8a6010)' : 'linear-gradient(135deg,#1a6aa8,#0d4a7a)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        Open Chat
      </button>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function VendorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({ profileViews: 0, savedByCouples: 0, chatsStarted: 0, quotesReceived: 0 });
  const [weeklyStats, setWeeklyStats] = useState<DayStat[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<Quote[]>([]);
  const [negotiations, setNegotiations] = useState<Quote[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; title: string; body: string; created_at: string; link: string | null }[]>([]);
  const [servicesCount, setServicesCount] = useState(0);
  const [packagesCount, setPackagesCount] = useState(0);
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const { format } = useCurrency();

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const cols = 'id, business_name, category, location, description, logo_url, is_published, onboarding_completed, contact, portfolio_urls, plan, verified';
      const { data: v1 } = await supabase.from('vendors').select(cols).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: v2 } = !v1 ? await supabase.from('vendors').select(cols).eq('id', user.id).maybeSingle() : { data: null };
      const v = (v1 || v2) as VendorProfile | null;
      if (!v) { setLoading(false); return; }
      setVendor(v);

      try {
        const status = await getVendorSetupStatus(supabase, v.id);
        setNeedsOnboarding(Boolean(status.needsOnboarding));
      } catch {}

      const vendorId = v.id;

      // Build last 7 days array
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const [
        servicesRes, packagesRes, convRes, quotesAllRes,
        quotesReqRes, quotesNegRes, notifsRes,
        statsRes,
      ] = await Promise.all([
        supabase.from('vendor_services').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('vendor_packages').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('quotes').select('id,quote_ref,package_name,guest_count,hours,base_from_price,status,created_at,couple_id').eq('vendor_id', vendorId).eq('status', 'requested').order('created_at', { ascending: false }).limit(5),
        supabase.from('quotes').select('id,quote_ref,package_name,guest_count,hours,base_from_price,status,created_at,couple_id').eq('vendor_id', vendorId).eq('status', 'negotiating').order('created_at', { ascending: false }).limit(5),
        supabase.from('notifications').select('id,title,body,created_at,link').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('vendor_stats_daily').select('day,profile_views,saves,quotes,messages').eq('vendor_id', vendorId).gte('day', last7[0]),
      ]);

      setServicesCount(servicesRes.count ?? 0);
      setPackagesCount(packagesRes.count ?? 0);

      // Build weekly stats map
      const statsMap: Record<string, DayStat> = {};
      (statsRes.data || []).forEach((r: any) => { statsMap[r.day] = { day: r.day, profile_views: r.profile_views || 0, saves: r.saves || 0, quotes: r.quotes || 0, messages: r.messages || 0 }; });

      // Fallback: read from vendor_events if stats table empty
      if (!statsRes.data || statsRes.data.length === 0) {
        const { data: events } = await supabase.from('vendor_events').select('event_type,created_at').eq('vendor_id', vendorId).gte('created_at', new Date(last7[0]).toISOString());
        (events || []).forEach((ev: any) => {
          const dk = ev.created_at.slice(0, 10);
          if (!statsMap[dk]) statsMap[dk] = { day: dk, profile_views: 0, saves: 0, quotes: 0, messages: 0 };
          if (ev.event_type === 'profile_view') statsMap[dk].profile_views++;
          if (ev.event_type === 'save_vendor') statsMap[dk].saves++;
          if (ev.event_type === 'quote_requested') statsMap[dk].quotes++;
          if (ev.event_type === 'message_started') statsMap[dk].messages++;
        });
      }

      const normalized = last7.map(day => statsMap[day] || { day, profile_views: 0, saves: 0, quotes: 0, messages: 0 });
      setWeeklyStats(normalized);

      // Real totals from weekly data
      const totalViews = normalized.reduce((s, r) => s + r.profile_views, 0);
      const totalSaves = normalized.reduce((s, r) => s + r.saves, 0);

      setMetrics({
        profileViews: totalViews,
        savedByCouples: totalSaves,
        chatsStarted: convRes.count ?? 0,
        quotesReceived: quotesAllRes.count ?? 0,
      });

      const addNames = async (rows: any[]): Promise<Quote[]> =>
        Promise.all((rows || []).map(async (q: any) => {
          const { data: c } = await supabase.from('couples').select('partner_name,avatar_url').eq('id', q.couple_id).maybeSingle();
          if (c?.partner_name || c?.avatar_url) return { ...q, couple_name: c.partner_name || 'Couple', couple_avatar: c.avatar_url || null };
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', q.couple_id).maybeSingle();
          return { ...q, couple_name: p?.full_name || 'Couple', couple_avatar: null };
        }));

      const [reqWithNames, negWithNames] = await Promise.all([addNames(quotesReqRes.data || []), addNames(quotesNegRes.data || [])]);
      setQuoteRequests(reqWithNames);
      setNegotiations(negWithNames);
      setRecentNotifications((notifsRes.data as any[]) || []);
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setLoading(false); }
  };

  const getConvForQuote = async (quoteId: string, coupleId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: existing } = await supabase.from('conversations').select('id').eq('couple_id', coupleId).eq('vendor_id', vendor?.id || user.id).maybeSingle();
      if (existing?.id) return existing.id;
      const { data: newConv, error } = await supabase.from('conversations').insert({ couple_id: coupleId, vendor_id: vendor?.id || user.id }).select('id').single();
      if (error?.code === '23505') {
        const { data: retry } = await supabase.from('conversations').select('id').eq('couple_id', coupleId).eq('vendor_id', vendor?.id || user.id).maybeSingle();
        return retry?.id ?? null;
      }
      return newConv?.id ?? null;
    } catch { return null; }
  };

  const profileChecks = vendor ? {
    businessInfo: !!vendor.business_name && !!vendor.category && !!vendor.location && !!vendor.description,
    services: servicesCount > 0, packages: packagesCount > 0,
    portfolio: Array.isArray(vendor.portfolio_urls) && vendor.portfolio_urls.length > 0,
    contact: !!(vendor.contact?.whatsapp || vendor.contact?.phone),
  } : null;
  const completedSteps = profileChecks ? Object.values(profileChecks).filter(Boolean).length : 0;
  const totalSteps = 5;
  const pct = Math.round((completedSteps / totalSteps) * 100);
  const requiresOnboarding = needsOnboarding !== null ? Boolean(needsOnboarding) : ((vendor as any)?.onboarding_completed === false);

  const handleShareProfile = async () => {
    if (!vendor?.id) return;
    const url = window.location.origin + '/marketplace/vendor/' + vendor.id;
    if (navigator.share) { try { await navigator.share({ title: 'uMshado Vendor Profile', url }); } catch {} }
    else { try { await navigator.clipboard.writeText(url); alert('Link copied!'); } catch {} }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100svh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(184,151,62,0.2)', borderTopColor: GOLD, animation: 'spin 0.8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  const statCards = [
    { icon: '👁️', label: 'Profile Views', value: metrics.profileViews, color: '#b8973e', sparkKey: 'profile_views', note: metrics.profileViews === 0 ? 'No views tracked yet' : undefined },
    { icon: '❤️', label: 'Saves',          value: metrics.savedByCouples, color: '#8b3a8b', sparkKey: 'saves',         note: metrics.savedByCouples === 0 ? 'Not yet saved' : undefined },
    { icon: '💬', label: 'Chats',          value: metrics.chatsStarted,   color: '#1a6aa8', sparkKey: 'messages',      note: undefined },
    { icon: '📋', label: 'Quotes',         value: metrics.quotesReceived,  color: '#2d7a4f', sparkKey: 'quotes',        note: undefined },
  ];

  const quickLinks = [
    { href: '/vendor/profile/edit', icon: '✏️', label: 'Edit Profile' },
    { href: '/vendor/packages',     icon: '📦', label: 'Packages' },
    { href: '/vendor/services',     icon: '🛠️', label: 'Services' },
    { href: '/vendor/media',        icon: '📷', label: 'Media' },
  ];

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(160deg,#4d0f21 0%,#9A2143 55%,#b8315a 100%)', padding: '20px 20px 24px', position: 'relative' }}>
          {/* Decorative circles clipped separately so the dropdown menu isn't cut off */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(189,152,63,0.12)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            {/* Logo */}
            {vendor?.logo_url ? (
              <button onClick={() => { setLogoSrc(vendor.logo_url!); setLogoAlt(vendor.business_name || ''); setLogoOpen(true); }}
                style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(184,151,62,0.4)', background: '#fff', padding: 0, cursor: 'zoom-in', flexShrink: 0 }}>
                <img src={vendor.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#9A2143,#731832)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, fontFamily: 'Georgia,serif', flexShrink: 0 }}>
                {(vendor?.business_name || 'V')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor?.business_name || 'Your Vendor Hub'}</h1>
                {vendor?.is_published && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(45,122,79,0.3)', color: '#7fffa0', border: '1px solid rgba(45,122,79,0.4)' }}>● LIVE</span>}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{vendor?.category ?? 'Your business hub'}</p>
            </div>
            {/* Menu */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowMenu(p => !p)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2}><circle cx="12" cy="5" r="1.5" fill="rgba(255,255,255,0.7)" /><circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.7)" /><circle cx="12" cy="19" r="1.5" fill="rgba(255,255,255,0.7)" /></svg>
              </button>
              {showMenu && (
                <div style={{ position: 'absolute', right: 0, top: 42, background: '#fff', borderRadius: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
                  <Link href="/vendor/billing" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 13, color: DARK, textDecoration: 'none' }}>💳 Billing & Plans</Link>
                  <button onClick={handleShareProfile} style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: 13, color: DARK, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f0ebe0' }}>📤 Share Profile</button>
                  {vendor?.is_published && (
                    <Link href={'/marketplace/vendor/' + vendor.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', fontSize: 13, color: DARK, textDecoration: 'none', borderTop: '1px solid #f0ebe0' }}>👁️ View Public Profile</Link>
                  )}
                  <button onClick={async () => { if (!confirm('Log out?')) return; await supabase.auth.signOut(); router.push('/auth/sign-in'); }}
                    style={{ width: '100%', padding: '12px 16px', textAlign: 'left', background: 'none', border: 'none', fontSize: 13, color: '#c83232', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f0ebe0' }}>🚪 Log out</button>
                </div>
              )}
            </div>
          </div>

          {/* Quick nav links */}
          <div style={{ display: 'flex', gap: 8 }}>
            {quickLinks.map(l => (
              <Link key={l.href} href={l.href} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)', textDecoration: 'none', textAlign: 'center' }}>
                <span style={{ fontSize: 18 }}>{l.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Onboarding / status banner ── */}
          {!vendor?.is_published && requiresOnboarding && completedSteps < totalSteps ? (
            <div style={{ background: 'linear-gradient(135deg,#b8973e,#8a6010)', borderRadius: 18, padding: '16px 18px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif' }}>Complete your profile</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{completedSteps} of {totalSteps} steps done</p>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)', fontFamily: 'Georgia,serif' }}>{pct}%</div>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 12 }}>
                <div style={{ height: '100%', width: pct + '%', background: '#fff', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {!profileChecks?.businessInfo && <Link href="/vendor/onboarding" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecoration: 'underline' }}>→ Add business name, category & description</Link>}
                {!profileChecks?.services && <Link href="/vendor/services" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecoration: 'underline' }}>→ Select at least 1 service</Link>}
                {!profileChecks?.packages && <Link href="/vendor/packages" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecoration: 'underline' }}>→ Create at least 1 package</Link>}
                {!profileChecks?.portfolio && <Link href="/vendor/media" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecoration: 'underline' }}>→ Upload a portfolio image</Link>}
                {!profileChecks?.contact && <Link href="/vendor/media" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textDecoration: 'underline' }}>→ Add contact details</Link>}
              </div>
            </div>
          ) : vendor?.is_published ? (
            <div style={{ background: 'linear-gradient(135deg,#1a4a2e,#2d7a4f)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>You're live on the marketplace ●</p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Couples can discover and contact you</p>
              </div>
              <button onClick={handleShareProfile} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Share</button>
            </div>
          ) : (
            <div style={{ background: 'linear-gradient(135deg,#2d3a8a,#4a5acf)', borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>Ready to go live?</p>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Review and publish your profile</p>
              </div>
              <Link href="/vendor/review" style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Review →</Link>
            </div>
          )}

          {/* ── Verification Request Card ── */}
          <VerificationRequestCard vendorVerified={vendor?.verified ?? false} />

          {/* ── Upgrade Banner (if on free plan) ── */}
          {(!vendor?.plan || vendor.plan === 'free') && (
            <div style={{ background: 'linear-gradient(135deg,#9A2143,#731832)', borderRadius: 18, padding: '16px 18px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, fontFamily: 'Georgia,serif' }}>Unlock Premium Features</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Get featured, verified & more visibility</p>
                </div>
                <div style={{ fontSize: 24 }}>✨</div>
              </div>
              <Link href="/vendor/billing" style={{ display: 'inline-block', marginTop: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>View Plans →</Link>
            </div>
          )}

          {/* ── Performance stats with sparklines ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Last 7 days</h2>
              <Link href="/vendor/insights" style={{ fontSize: 12, fontWeight: 600, color: GOLD, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full insights
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {statCards.map(s => (
                <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} sparkData={weeklyStats} sparkKey={s.sparkKey} note={s.note} />
              ))}
            </div>
          </div>

          {/* ── Quote requests ── */}
          {quoteRequests.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Quote Requests</h2>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(184,151,62,0.12)', color: '#8a6010' }}>{quoteRequests.length} new</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {quoteRequests.map(q => (
                  <QuoteCard key={q.id} quote={q} status="requested" format={format} onChat={async () => { const id = await getConvForQuote(q.id, q.couple_id); if (id) router.push('/messages/thread/' + id); }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Negotiations ── */}
          {negotiations.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Negotiations</h2>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(26,106,168,0.1)', color: '#1a6aa8' }}>{negotiations.length} active</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {negotiations.map(q => (
                  <QuoteCard key={q.id} quote={q} status="negotiating" format={format} onChat={async () => { const id = await getConvForQuote(q.id, q.couple_id); if (id) router.push('/messages/thread/' + id); }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Recent activity ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Recent Activity</h2>
              {recentNotifications.length > 0 && <Link href="/notifications" style={{ fontSize: 12, fontWeight: 600, color: GOLD, textDecoration: 'none' }}>View all</Link>}
            </div>
            {recentNotifications.length > 0 ? (
              <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
                {recentNotifications.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: i < recentNotifications.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(184,151,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: DARK }}>{n.title}</p>
                      {n.body && <p style={{ margin: '0 0 3px', fontSize: 11, color: '#7a6050', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                      <p style={{ margin: 0, fontSize: 10, color: '#b0a090' }}>{new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 18, padding: '32px 20px', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔔</div>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: DARK }}>No activity yet</p>
                <p style={{ margin: 0, fontSize: 11, color: '#9a7c58' }}>When couples view, save or contact you, it'll show here.</p>
              </div>
            )}  
          </div>

          {/* ── Your Account Section ── */}
          <div>
            <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: DARK, fontFamily: 'Georgia,serif' }}>Your Account</h2>
            <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.05)' }}>
              <Link href="/vendor/billing" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(154,33,67,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>💳</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DARK }}>Billing & Plans</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6050' }}>Manage your subscription</p>
                </div>
                <svg width="14" height="14" fill="none" stroke="#9a7c58" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
              <Link href="/vendor/billing#featured" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(184,151,62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>⭐</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DARK }}>Feature Your Listing</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6050' }}>Boost visibility & stand out</p>
                </div>
                <svg width="14" height="14" fill="none" stroke="#9a7c58" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
              <Link href="/vendor/billing#verification" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(26,106,168,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✓</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: DARK }}>Get Verified</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7a6050' }}>Build trust with the blue badge</p>
                </div>
                <svg width="14" height="14" fill="none" stroke="#9a7c58" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>

        </div>
      </div>

      <VendorBottomNav />
      <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />
    </div>
  );
}