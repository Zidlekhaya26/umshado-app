'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import VendorBottomNav from '@/components/VendorBottomNav';
import VerificationRequestCard from '@/components/VerificationRequestCard';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { CR, CR2, CRX, GD, GD2, MUT, BOR, BG } from '@/lib/tokens';

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

/* ─── Design tokens ─────────────────────────────────────── */
const DARK = 'var(--um-dark)';

/* ─── Sparkline ─────────────────────────────────────────── */
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={'sg_' + dataKey} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          fill={'url(#sg_' + dataKey + ')'} dot={false} />
        <Tooltip contentStyle={{ display: 'none' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ─── Stat card ─────────────────────────────────────────── */
function StatCard({ icon, label, value, color, sparkData, sparkKey, note }: {
  icon: string; label: string; value: number; color: string;
  sparkData: any[]; sparkKey: string; note?: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 18, padding: '16px 16px 10px',
      boxShadow: '0 2px 12px rgba(26,13,18,0.07)',
      border: `1.5px solid ${BOR}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 11,
          background: `${color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          flexShrink: 0,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: 10.5, color: MUT, fontWeight: 700, marginTop: 2, letterSpacing: 0.3 }}>{label}</div>
        </div>
      </div>
      {note ? (
        <div style={{ fontSize: 10, color: '#c0a898', fontStyle: 'italic', paddingBottom: 4 }}>{note}</div>
      ) : (
        <Sparkline data={sparkData} dataKey={sparkKey} color={color} />
      )}
    </div>
  );
}

/* ─── Quote card ──────────────────────────────────────────*/
function QuoteCard({ quote, status, format, onChat }: {
  quote: Quote; status: 'requested' | 'negotiating';
  format: (n: number) => string; onChat: () => void;
}) {
  const isPending = status === 'requested';
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '16px',
      boxShadow: '0 2px 12px rgba(26,13,18,0.07)',
      border: isPending ? `1.5px solid rgba(189,152,63,0.4)` : `1.5px solid ${BOR}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {quote.couple_avatar ? (
          <Image src={quote.couple_avatar} alt={quote.couple_name} width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${BOR}` }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,${CR},${CR2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
            {(quote.couple_name || 'C').split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.couple_name}</div>
          <div style={{ fontSize: 10.5, color: MUT, marginTop: 1, fontWeight: 600 }}>{quote.quote_ref}</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
          background: isPending ? 'rgba(189,152,63,0.12)' : 'rgba(154,33,67,0.08)',
          color: isPending ? GD2 : CR,
          letterSpacing: 0.3,
        }}>
          {isPending ? 'Pending' : 'Negotiating'}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: BG, borderRadius: 10, padding: '8px 11px', border: `1px solid ${BOR}` }}>
          <div style={{ fontSize: 9, color: MUT, fontWeight: 800, marginBottom: 3, letterSpacing: 0.8, textTransform: 'uppercase' }}>Package</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: DARK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{quote.package_name}</div>
        </div>
        <div style={{ background: BG, borderRadius: 10, padding: '8px 11px', border: `1px solid ${BOR}` }}>
          <div style={{ fontSize: 9, color: MUT, fontWeight: 800, marginBottom: 3, letterSpacing: 0.8, textTransform: 'uppercase' }}>Estimate</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: GD2, fontFamily: 'Georgia,serif' }}>{format(Number(quote.base_from_price))}</div>
        </div>
      </div>
      <button onClick={onChat} style={{
        width: '100%', padding: '11px', borderRadius: 11, border: 'none',
        background: isPending
          ? `linear-gradient(135deg,${GD},${GD2})`
          : `linear-gradient(135deg,${CR},${CR2})`,
        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        boxShadow: isPending ? '0 3px 12px rgba(189,152,63,0.3)' : '0 3px 12px rgba(154,33,67,0.25)',
        fontFamily: 'inherit',
      }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        Open Chat
      </button>
    </div>
  );
}

/* ─── Loading skeleton ──────────────────────────────────── */
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100svh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes vdShimmer {
          0%   { background-position: -400px 0 }
          100% { background-position: 400px 0 }
        }
        .vd-skel {
          background: linear-gradient(90deg, #f0ebe4 25%, #faf5ee 50%, #f0ebe4 75%);
          background-size: 800px 100%;
          animation: vdShimmer 1.6s infinite linear;
          border-radius: 10px;
        }
        @keyframes vdPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      `}</style>
      <div style={{ background: `linear-gradient(160deg,${CRX} 0%,${CR} 55%,#c03050 100%)`, padding: '22px 20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="vd-skel" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="vd-skel" style={{ width: '55%', height: 16, marginBottom: 8, opacity: .6 }} />
            <div className="vd-skel" style={{ width: '35%', height: 11, opacity: .4 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1,2,3,4].map(i => <div key={i} className="vd-skel" style={{ flex: 1, height: 52, borderRadius: 12, opacity: .3 }} />)}
        </div>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="vd-skel" style={{ height: 90, borderRadius: 18 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[1,2,3,4].map(i => <div key={i} className="vd-skel" style={{ height: 88, borderRadius: 18 }} />)}
        </div>
        <div className="vd-skel" style={{ height: 120, borderRadius: 18 }} />
      </div>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ animation: 'vdPulse 1.8s ease-in-out infinite', opacity: .18 }}>
          <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="48" stroke={CR} strokeWidth="4"/>
            <path d="M25 55 L50 25 L75 55" stroke={CR} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="50" cy="72" r="8" fill={CR}/>
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────── */
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
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const [servicesRes, packagesRes, convRes, quotesAllRes, quotesReqRes, quotesNegRes, notifsRes, statsRes] = await Promise.all([
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

      const statsMap: Record<string, DayStat> = {};
      (statsRes.data || []).forEach((r: any) => { statsMap[r.day] = { day: r.day, profile_views: r.profile_views || 0, saves: r.saves || 0, quotes: r.quotes || 0, messages: r.messages || 0 }; });

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

      const totalViews = normalized.reduce((s, r) => s + r.profile_views, 0);
      const totalSaves = normalized.reduce((s, r) => s + r.saves, 0);

      setMetrics({ profileViews: totalViews, savedByCouples: totalSaves, chatsStarted: convRes.count ?? 0, quotesReceived: quotesAllRes.count ?? 0 });

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

  const handleDeleteAccount = async () => {
    if (!confirm('Permanently delete your vendor account and all data? This cannot be undone.')) return;
    const typed = window.prompt('Type DELETE to confirm:');
    if (typed !== 'DELETE') { alert('Cancelled — you must type DELETE exactly.'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (res.ok) { await supabase.auth.signOut(); router.push('/auth/sign-in'); }
    else { const body = await res.json().catch(() => ({})); alert(body.error || 'Failed to delete account.'); }
  };

  if (loading) return <LoadingScreen />;

  const statCards = [
    { icon: '👁️', label: 'Profile Views', value: metrics.profileViews,   color: GD,        sparkKey: 'profile_views', note: metrics.profileViews   === 0 ? 'No views yet'   : undefined },
    { icon: '❤️', label: 'Saves',         value: metrics.savedByCouples, color: CR,        sparkKey: 'saves',         note: metrics.savedByCouples === 0 ? 'Not saved yet'  : undefined },
    { icon: '💬', label: 'Chats',         value: metrics.chatsStarted,   color: '#4A78A8', sparkKey: 'messages',      note: undefined },
    { icon: '📋', label: 'Quotes',        value: metrics.quotesReceived, color: '#2d7a52', sparkKey: 'quotes',        note: undefined },
  ];

  const quickLinks = [
    { href: '/vendor/profile/edit', icon: '✏️', label: 'Edit Profile' },
    { href: '/vendor/packages',     icon: '📦', label: 'Packages' },
    { href: '/vendor/services',     icon: '🛠️', label: 'Services' },
    { href: '/vendor/media',        icon: '📷', label: 'Media' },
  ];

  return (
    <div style={{ minHeight: '100svh', background: BG, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes vdSpin { to { transform:rotate(360deg) } }
        @keyframes vdFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .vd-section { animation: vdFadeIn .35s ease both }
        button, a { font-family: inherit!important }
        .vd-menu-item:hover { background: #faf5f0!important }
        .vd-quick-link:hover { background: rgba(255,255,255,0.22)!important; border-color: rgba(255,255,255,0.28)!important }
        .vd-share-btn:hover { background: rgba(255,255,255,0.22)!important }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 100 }}>

        {/* ── Header ── */}
        <div style={{
          background: `linear-gradient(160deg,${CRX} 0%,${CR} 55%,#c03050 100%)`,
          padding: '20px 20px 22px', position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.12)' }} />
            <div style={{ position: 'absolute', top: -24, right: -24, width: 108, height: 108, borderRadius: '50%', border: '1.5px solid rgba(189,152,63,0.18)' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(189,152,63,0.05)' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, position: 'relative' }}>
            {vendor?.logo_url ? (
              <button onClick={() => { setLogoSrc(vendor.logo_url!); setLogoAlt(vendor.business_name || ''); setLogoOpen(true); }}
                style={{ width: 50, height: 50, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(189,152,63,0.55)', background: '#fff', padding: 0, cursor: 'zoom-in', flexShrink: 0, position: 'relative' }}>
                <Image src={vendor.logo_url} alt={vendor.business_name || ''} fill style={{ objectFit: 'cover' }} />
              </button>
            ) : (
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20, fontFamily: 'Georgia,serif', flexShrink: 0 }}>
                {(vendor?.business_name || 'V')[0].toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.3 }}>{vendor?.business_name || 'Your Vendor Hub'}</h1>
                {vendor?.is_published && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'rgba(30,180,90,0.2)', color: '#7effa8', border: '1px solid rgba(30,180,90,0.3)', letterSpacing: 0.5 }}>LIVE</span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{vendor?.category ?? 'Your business hub'}</p>
            </div>
            {/* Menu */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowMenu(p => !p)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" stroke="none"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
              </button>
              {showMenu && (
                <div style={{ position: 'absolute', right: 0, top: 44, background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(26,13,18,0.18)', zIndex: 100, minWidth: 195, overflow: 'hidden', border: `1px solid ${BOR}` }}>
                  <Link href="/vendor/billing" className="vd-menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontSize: 13, fontWeight: 600, color: DARK, textDecoration: 'none' }}>
                    <span>💳</span> Billing & Plans
                  </Link>
                  <button onClick={handleShareProfile} className="vd-menu-item" style={{ width: '100%', padding: '13px 16px', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${BOR}`, fontSize: 13, fontWeight: 600, color: DARK, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>🔗</span> Share Profile
                  </button>
                  {vendor?.is_published && (
                    <Link href={'/marketplace/vendor/' + vendor.id} className="vd-menu-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', fontSize: 13, fontWeight: 600, color: DARK, textDecoration: 'none', borderTop: `1px solid ${BOR}` }}>
                      <span>🏪</span> View Public Profile
                    </Link>
                  )}
                  <button onClick={async () => { if (!confirm('Log out?')) return; await supabase.auth.signOut(); router.push('/auth/sign-in'); }} className="vd-menu-item" style={{ width: '100%', padding: '13px 16px', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${BOR}`, fontSize: 13, fontWeight: 600, color: '#c83232', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>🚪</span> Log out
                  </button>
                  <button onClick={handleDeleteAccount} className="vd-menu-item" style={{ width: '100%', padding: '13px 16px', textAlign: 'left', background: 'none', border: 'none', borderTop: `1px solid ${BOR}`, fontSize: 13, fontWeight: 600, color: '#c83232', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>🗑️</span> Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick nav */}
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            {quickLinks.map(l => (
              <Link key={l.href} href={l.href} className="vd-quick-link" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '11px 4px', borderRadius: 13, background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.15)', textDecoration: 'none', textAlign: 'center', transition: 'all .14s' }}>
                <span style={{ fontSize: 18 }}>{l.icon}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4 }}>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Onboarding / status banner ── */}
          <div className="vd-section" style={{ animationDelay: '.05s' }}>
            {!vendor?.is_published && requiresOnboarding && completedSteps < totalSteps ? (
              <div style={{ background: `linear-gradient(135deg,${GD},${GD2})`, borderRadius: 18, padding: '18px 20px', color: '#fff', boxShadow: '0 4px 20px rgba(189,152,63,0.28)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: 'Georgia,serif' }}>Complete your profile</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>{completedSteps} of {totalSteps} steps done</p>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: -1 }}>{pct}%</div>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: '#fff', borderRadius: 3, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {!profileChecks?.businessInfo && <Link href="/vendor/onboarding" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: 0.7 }}>→</span> Add business name, category &amp; description</Link>}
                  {!profileChecks?.services && <Link href="/vendor/services" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: 0.7 }}>→</span> Select at least 1 service</Link>}
                  {!profileChecks?.packages && <Link href="/vendor/packages" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: 0.7 }}>→</span> Create at least 1 package</Link>}
                  {!profileChecks?.portfolio && <Link href="/vendor/media" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: 0.7 }}>→</span> Upload a portfolio image</Link>}
                  {!profileChecks?.contact && <Link href="/vendor/media" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: 0.7 }}>→</span> Add contact details</Link>}
                </div>
              </div>
            ) : vendor?.is_published ? (
              <div style={{ background: 'linear-gradient(135deg,#1e4a30,#2d7a4f)', borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(30,74,48,0.22)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>You&apos;re live on the marketplace</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Couples can discover and contact you</p>
                </div>
                <button onClick={handleShareProfile} className="vd-share-btn" style={{ padding: '9px 16px', borderRadius: 11, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', transition: 'background .14s', fontFamily: 'inherit' }}>Share</button>
              </div>
            ) : (
              <div style={{ background: `linear-gradient(135deg,${CR},${CR2})`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(154,33,67,0.25)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Georgia,serif' }}>Ready to go live?</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>Review and publish your profile</p>
                </div>
                <Link href="/vendor/review" style={{ padding: '9px 16px', borderRadius: 11, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>Review →</Link>
              </div>
            )}
          </div>

          {/* ── Verification ── */}
          <div className="vd-section" style={{ animationDelay: '.1s' }}>
            <VerificationRequestCard vendorVerified={vendor?.verified ?? false} />
          </div>

          {/* ── Upgrade banner (free plan) — gold to distinguish from crimson CTAs ── */}
          {(!vendor?.plan || vendor.plan === 'free') && (
            <div className="vd-section" style={{ animationDelay: '.15s', background: `linear-gradient(135deg,${GD},${GD2})`, borderRadius: 18, padding: '18px 20px', color: '#fff', boxShadow: '0 4px 20px rgba(189,152,63,0.28)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, fontFamily: 'Georgia,serif' }}>Unlock Premium Features</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>Get featured, verified &amp; more visibility</p>
                </div>
                <div style={{ fontSize: 26, flexShrink: 0 }}>✨</div>
              </div>
              <Link href="/vendor/billing" style={{ display: 'inline-block', padding: '9px 18px', borderRadius: 11, background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 12.5, fontWeight: 800, textDecoration: 'none' }}>View Plans →</Link>
            </div>
          )}

          {/* ── Bookings shortcut ── */}
          <div className="vd-section" style={{ animationDelay: '.18s' }}>
            <Link href="/vendor/bookings" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 18, background: '#fff', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', border: `1.5px solid ${BOR}`, textDecoration: 'none' }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: `rgba(154,33,67,0.07)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Bookings &amp; Availability</p>
                <p style={{ margin: 0, fontSize: 11.5, color: MUT }}>Manage confirmed bookings and block dates</p>
              </div>
              <svg width="14" height="14" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* ── Stats ── */}
          <div className="vd-section" style={{ animationDelay: '.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Last 7 days</h2>
              <Link href="/vendor/insights" style={{ fontSize: 12.5, fontWeight: 700, color: GD, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                Full insights
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
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
            <div className="vd-section" style={{ animationDelay: '.25s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Quote Requests</h2>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: 'rgba(189,152,63,0.12)', color: GD2, letterSpacing: 0.3 }}>{quoteRequests.length} new</span>
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
            <div className="vd-section" style={{ animationDelay: '.28s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Negotiations</h2>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: `rgba(154,33,67,0.09)`, color: CR, letterSpacing: 0.3 }}>{negotiations.length} active</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {negotiations.map(q => (
                  <QuoteCard key={q.id} quote={q} status="negotiating" format={format} onChat={async () => { const id = await getConvForQuote(q.id, q.couple_id); if (id) router.push('/messages/thread/' + id); }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Recent activity ── */}
          <div className="vd-section" style={{ animationDelay: '.3s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Recent Activity</h2>
              {recentNotifications.length > 0 && <Link href="/notifications" style={{ fontSize: 12.5, fontWeight: 700, color: GD, textDecoration: 'none' }}>View all</Link>}
            </div>
            {recentNotifications.length > 0 ? (
              <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', border: `1.5px solid ${BOR}` }}>
                {recentNotifications.map((n, i) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderBottom: i < recentNotifications.length - 1 ? `1px solid ${BOR}` : 'none' }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `rgba(189,152,63,0.12)`, border: `1px solid rgba(189,152,63,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🔔</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: DARK }}>{n.title}</p>
                      {n.body && <p style={{ margin: '0 0 3px', fontSize: 11.5, color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                      <p style={{ margin: 0, fontSize: 10.5, color: '#b0a090', fontWeight: 500 }}>{new Date(n.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 18, padding: '34px 20px', textAlign: 'center', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', border: `1.5px solid ${BOR}` }}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.25 }}>🔔</div>
                <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: DARK }}>No activity yet</p>
                <p style={{ margin: 0, fontSize: 11.5, color: MUT }}>When couples view, save or contact you, it&apos;ll show here.</p>
              </div>
            )}
          </div>

          {/* ── Account ── */}
          <div className="vd-section" style={{ animationDelay: '.35s' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: DARK, fontFamily: 'Georgia,serif' }}>Your Account</h2>
            <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(26,13,18,0.07)', border: `1.5px solid ${BOR}` }}>
              {[
                { href: '/vendor/billing',              icon: '💳', label: 'Billing & Plans',      sub: 'Manage your subscription' },
                { href: '/vendor/billing#featured',     icon: '⭐', label: 'Feature Your Listing', sub: 'Boost visibility & stand out' },
                { href: '/vendor/billing#verification', icon: '✓',  label: 'Get Verified',         sub: 'Build trust with the badge' },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="vd-menu-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', borderBottom: `1px solid ${BOR}`, transition: 'background .12s' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: `rgba(154,33,67,0.07)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: DARK }}>{item.label}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: MUT }}>{item.sub}</p>
                  </div>
                  <svg width="14" height="14" fill="none" stroke={MUT} strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </Link>
              ))}
              <button onClick={handleDeleteAccount} className="vd-menu-item" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(200,50,50,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🗑️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#c83232' }}>Delete Account</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#a05050' }}>Permanently removes your account and all data</p>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>

      <VendorBottomNav />
      <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />
    </div>
  );
}
