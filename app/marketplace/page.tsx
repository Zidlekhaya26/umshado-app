'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';
import ImageLightbox from '@/components/ui/ImageLightbox';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { getServicesCatalog, type Service as CatalogService } from '@/lib/vendorServices';


/* ─── Types ─────────────────────────────────────────────── */
interface MarketplaceVendor {
  vendor_id: string; business_name: string; category: string;
  city: string; country: string; description: string;
  verified?: boolean; created_at: string; updated_at: string;
  featured?: boolean | null; featured_until?: string | null;
  plan?: string | null; plan_until?: string | null;
  logo_url?: string | null; is_published?: boolean;
  min_from_price: number | null; services: string[]; package_count: number;
}
interface VendorActivityScore {
  vendor_id: string; profile_views: number; quotes: number;
  messages: number; saves: number; activity_score: number;
}
interface Vendor {
  id: string; name: string; category: string; location: string;
  fromPrice: number; services: string[]; score: number;
  logoUrl?: string | null; verified?: boolean;
  preferredCurrency?: string | null; isDemo?: boolean;
}
type SortOption = 'recommended' | 'price_low' | 'price_high' | 'newest';

/* ─── Category icon map ──────────────────────────────────── */
const CAT_ICONS: Record<string, string> = {
  'Catering & Food': '🍽️', 'Décor & Styling': '💐',
  'Photography & Video': '📸', 'Music, DJ & Sound': '🎵',
  'Makeup & Hair': '💄', 'Attire & Fashion': '👗',
  'Wedding Venues': '🏛️', 'Transport': '🚗',
  'Honeymoon & Travel': '✈️', 'Support Services': '🛡️',
  'Furniture & Equipment Hire': '🪑',
  'Special Effects & Experiences': '✨',
  'Planning & Coordination': '📋',
};

/* ─── Score helper ──────────────────────────────────────── */
function calculateScore(v: MarketplaceVendor, prefs: { category?: string }, activity?: VendorActivityScore): number {
  let score = 0;
  if (v.featured && v.featured_until && new Date(v.featured_until) > new Date()) score += 100;
  const plan = v.plan ?? 'free';
  if (plan === 'elite') score += 60;
  else if (plan === 'pro') score += 40;
  else if (plan === 'starter') score += 20;
  if (v.verified) score += 30;
  if (v.logo_url) score += 10;
  if (v.description && v.description.length > 80) score += 10;
  if (v.min_from_price && v.min_from_price > 0) score += 5;
  if ((v.services || []).length > 2) score += 5;
  if (prefs.category && v.category === prefs.category) score += 20;
  if (activity) {
    score += Math.min(activity.profile_views * 0.1, 10);
    score += Math.min(activity.quotes * 2, 20);
    score += Math.min(activity.messages * 1, 10);
    score += Math.min(activity.saves * 3, 15);
  }
  return score;
}

/* ─── Skeleton card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <div style={{ background: 'linear-gradient(135deg,#faf7f2,#f0ebe0)', padding: '24px 20px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8e0d4' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 16, width: '60%', background: '#e8e0d4', borderRadius: 8, marginBottom: 8 }} />
          <div style={{ height: 12, width: '40%', background: '#ede6db', borderRadius: 8 }} />
        </div>
      </div>
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 12, width: '50%', background: '#f0ebe0', borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[70, 80, 60].map((w, i) => <div key={i} style={{ height: 24, width: w, background: '#f5f0e8', borderRadius: 20 }} />)}
        </div>
        <div style={{ height: 1, background: '#f0ebe0', margin: '2px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ height: 18, width: 80, background: '#ede6db', borderRadius: 8 }} />
          <div style={{ height: 32, width: 60, background: '#e8e0d4', borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Vendor Card ───────────────────────────────────────── */
function VendorCard({ vendor, isVendor, format, onLogoClick }: {
  vendor: Vendor; isVendor: boolean;
  format: (n: number) => string;
  onLogoClick: (src: string, alt: string) => void;
}) {
  const router = useRouter();
  const isFeatured = vendor.score > 240;
  const isRecommended = vendor.score > 120;

  return (
    <Link href={'/marketplace/vendor/' + vendor.id} style={{ textDecoration: 'none' }}>
      <div
        style={{
          background: '#fff', borderRadius: 20, overflow: 'hidden',
          boxShadow: isFeatured ? '0 8px 32px rgba(184,151,62,0.18), 0 2px 8px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.07)',
          border: isFeatured ? '1.5px solid rgba(184,151,62,0.5)' : '1.5px solid rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s, transform 0.15s',
          position: 'relative', display: 'flex', flexDirection: 'column', height: '100%',
        }}
      >
        {/* Featured ribbon */}
        {isFeatured && (
          <div style={{
            position: 'absolute', top: 14, right: 0, zIndex: 2,
            background: 'linear-gradient(135deg,#b8973e,#e8c84a)',
            color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            padding: '4px 12px 4px 10px', borderRadius: '4px 0 0 4px',
            boxShadow: '0 2px 8px rgba(184,151,62,0.4)', fontFamily: 'Georgia,serif',
          }}>FEATURED</div>
        )}

        {/* Logo bar */}
        <div style={{ background: 'linear-gradient(135deg,#faf7f2 0%,#f0ebe0 100%)', padding: '22px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {vendor.logoUrl ? (
            <button type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onLogoClick(vendor.logoUrl!, vendor.name); }}
              style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(184,151,62,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in', padding: 0, flexShrink: 0 }}
            >
              <img src={vendor.logoUrl} alt={vendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#b8973e,#d4aa5a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, fontFamily: 'Georgia,serif', flexShrink: 0 }}>
              {vendor.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18100a', fontFamily: 'Georgia,serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor.name}</h3>
              {vendor.verified && <VerifiedBadge verified />}
              {vendor.isDemo && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: '#f1f1f1', color: '#888', border: '1px solid #ddd', fontWeight: 600 }}>TEST</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <span style={{ fontSize: 13 }}>{CAT_ICONS[vendor.category] ?? '🏢'}</span>
              <span style={{ fontSize: 12, color: '#8a6e4a', fontWeight: 500 }}>{vendor.category}</span>
            </div>
          </div>
          {isRecommended && !isFeatured && (
            <div style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: '3px 8px', borderRadius: 20, background: 'rgba(184,151,62,0.12)', color: '#8a6010', border: '1px solid rgba(184,151,62,0.3)' }}>✦ TOP</div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '12px 20px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8973e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: 12, color: '#7a6050' }}>{vendor.location}</span>
          </div>

          {vendor.services.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {vendor.services.slice(0, 3).map((s, i) => (
                <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(184,151,62,0.08)', color: '#7a5c30', border: '1px solid rgba(184,151,62,0.2)', fontWeight: 500 }}>{s}</span>
              ))}
              {vendor.services.length > 3 && (
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: '#f5f5f5', color: '#888', border: '1px solid #eee' }}>+{vendor.services.length - 3}</span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: 'auto' }}>
            <div>
              {vendor.fromPrice > 0 ? (
                <>
                  <div style={{ fontSize: 10, color: '#9a7c58', marginBottom: 1, fontWeight: 500 }}>From</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#b8973e', fontFamily: 'Georgia,serif' }}>{format(vendor.fromPrice)}</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: '#9a7c58', fontStyle: 'italic' }}>Contact for pricing</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!isVendor && (
                <button type="button"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); router.push('/messages/new?vendorId=' + vendor.id); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(184,151,62,0.4)', background: 'rgba(184,151,62,0.06)', color: '#8a6010', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Chat
                </button>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '7px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                View
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function Marketplace() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [displayedCount, setDisplayedCount] = useState(12);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { user, role } = useAuthRole();
  const isVendor = role === 'vendor';
  const { format } = useCurrency();
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string | undefined>(undefined);
  const categories = Array.from(LOCKED_CATEGORIES);

  const handleLogoClick = useCallback((src: string, alt: string) => { setLogoSrc(src); setLogoAlt(alt); setLogoOpen(true); }, []);

  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { applyFiltersAndSort(); setDisplayedCount(12); }, [searchQuery, categoryFilter, serviceFilter, sortBy, allVendors]);
  useEffect(() => { setServiceFilter([]); }, [categoryFilter]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && vendors.length > displayedCount && !isFetchingMore) {
        setIsFetchingMore(true);
        setDisplayedCount(p => Math.min(p + 12, vendors.length));
        setTimeout(() => setIsFetchingMore(false), 300);
      }
    }, { threshold: 0.1 });
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [vendors.length, displayedCount, isFetchingMore]);

  const displayedServices = categoryFilter
    ? catalogServices.filter(s => s.category === categoryFilter).map(s => s.name)
    : allServices;

  const activeCount = () => {
    let c = 0;
    if (searchQuery.trim()) c++;
    if (categoryFilter) c++;
    c += serviceFilter.length;
    if (sortBy !== 'recommended') c++;
    return c;
  };

  const clearAll = () => { setSearchQuery(''); setCategoryFilter(''); setServiceFilter([]); setSortBy('recommended'); };
  const toggleService = (s: string) => setServiceFilter(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const loadData = async () => {
    setLoading(true);
    try {
      const catalog = await getServicesCatalog();
      setCatalogServices(catalog);
      const { data, error } = await supabase.from('marketplace_vendors').select('*');
      if (error) { console.error(error); return; }
      let actData = [];
      try {
        const result = await supabase.rpc('get_vendor_activity_7d');
        if (result.data) actData = result.data;
      } catch (err) {
        console.warn('marketplace: failed to load vendor activity counts', err);
      }
      const actMap = new Map<string, VendorActivityScore>();
      (actData || []).forEach((r: VendorActivityScore) => actMap.set(r.vendor_id, r));
      const mapped: Vendor[] = (data || []).map((v: MarketplaceVendor) => ({
        id: v.vendor_id, name: v.business_name || 'Unnamed Vendor', category: v.category || 'Other',
        location: [v.city, v.country].filter(Boolean).join(', ') || 'Location not set',
        fromPrice: v.min_from_price || 0, services: v.services || [],
        score: calculateScore(v, {}, actMap.get(v.vendor_id)),
        logoUrl: v.logo_url, verified: v.verified,
        isDemo: !!(v.plan === 'demo' || /\b(test|demo|sample|seed)\b/i.test(v.business_name || '')),
      }));
      setAllServices(Array.from(new Set(mapped.flatMap(v => v.services))).sort());
      setAllVendors(mapped);
    } finally { setLoading(false); }
  };

  const applyFiltersAndSort = () => {
    let f = [...allVendors];
    const q = searchQuery.toLowerCase().trim();
    if (q) f = f.filter(v => v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q) || v.location.toLowerCase().includes(q) || v.services.some(s => s.toLowerCase().includes(q)));
    if (categoryFilter) f = f.filter(v => v.category === categoryFilter);
    if (serviceFilter.length) f = f.filter(v => serviceFilter.every(s => v.services.includes(s)));
    switch (sortBy) {
      case 'recommended': f.sort((a, b) => b.score - a.score); break;
      case 'price_low': f.sort((a, b) => { if (!a.fromPrice) return 1; if (!b.fromPrice) return -1; return a.fromPrice - b.fromPrice; }); break;
      case 'price_high': f.sort((a, b) => b.fromPrice - a.fromPrice); break;
      case 'newest': f.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    setVendors(f);
  };

  return (
    <div style={{ minHeight: '100svh', background: '#faf7f2' }}>
      <style>{`
        input[placeholder*="Search vendors"]::placeholder {
          color: rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100svh', paddingBottom: 90 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(135deg,#b8973e 0%,#8a6010 100%)', padding: '20px 20px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(184,151,62,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 20, right: 50, width: 80, height: 80, borderRadius: '50%', background: 'rgba(184,151,62,0.05)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, position: 'relative' }}>
            <UmshadoIcon size={26} />
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>Marketplace</h1>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Find trusted wedding vendors</p>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" fill="none" stroke="rgba(184,151,62,0.7)" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vendors, categories, services…"
              style={{ width: '100%', height: 44, paddingLeft: 42, paddingRight: 16, borderRadius: 14, border: '1.5px solid rgba(184,151,62,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Sort + Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
              style={{ flex: 1, height: 38, borderRadius: 10, border: '1.5px solid rgba(184,151,62,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 13, padding: '0 12px', outline: 'none', cursor: 'pointer' }}>
              <option value="recommended" style={{ color: '#18100a', background: '#fff' }}>⭐ Recommended</option>
              <option value="price_low" style={{ color: '#18100a', background: '#fff' }}>↑ Price: Low to High</option>
              <option value="price_high" style={{ color: '#18100a', background: '#fff' }}>↓ Price: High to Low</option>
              <option value="newest" style={{ color: '#18100a', background: '#fff' }}>✦ Newest</option>
            </select>
            <button onClick={() => setFilterOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 38, borderRadius: 10, border: '1.5px solid rgba(184,151,62,0.35)', background: activeCount() > 0 ? 'rgba(184,151,62,0.18)' : 'rgba(255,255,255,0.06)', color: activeCount() > 0 ? '#e8c84a' : 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M7 12h10M11 18h2" /></svg>
              Filters
              {activeCount() > 0 && <span style={{ background: '#b8973e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{activeCount()}</span>}
            </button>
          </div>

          {/* Category pills */}
          <div style={{ margin: '0 -20px', paddingBottom: 16, overflowX: 'auto', display: 'flex', gap: 8, padding: '0 16px 16px', scrollbarWidth: 'none' }}>
            {['', ...categories].map(cat => (
              <button key={cat || '__all'} onClick={() => setCategoryFilter(cat)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: categoryFilter === cat ? 'linear-gradient(135deg,#b8973e,#8a6010)' : 'rgba(255,255,255,0.1)', color: categoryFilter === cat ? '#fff' : 'rgba(255,255,255,0.75)', boxShadow: categoryFilter === cat ? '0 2px 8px rgba(184,151,62,0.4)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {cat ? <><span>{CAT_ICONS[cat] ?? '🏢'}</span><span>{cat.split(' ')[0]}</span></> : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Active service chips ── */}
        {serviceFilter.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {serviceFilter.map(s => (
              <button key={s} onClick={() => toggleService(s)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(184,151,62,0.12)', color: '#8a6010', border: '1px solid rgba(184,151,62,0.3)', cursor: 'pointer' }}>
                {s} <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span>
              </button>
            ))}
            <button onClick={() => setServiceFilter([])}
              style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f5f5f5', color: '#888', border: '1px solid #e5e5e5', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {/* ── Count bar ── */}
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!loading && <span style={{ fontSize: 12, color: '#9a7c58', fontWeight: 500 }}>{vendors.length} vendor{vendors.length !== 1 ? 's' : ''} found</span>}
          {activeCount() > 0 && <button onClick={clearAll} style={{ fontSize: 12, color: '#b8973e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all filters</button>}
        </div>

        {/* ── Grid ── */}
        <div style={{ padding: '4px 16px 20px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : vendors.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🔍</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#18100a', margin: '0 0 6px', fontFamily: 'Georgia,serif' }}>No vendors found</p>
              <p style={{ fontSize: 13, color: '#9a7c58', margin: '0 0 20px' }}>Try adjusting your search or filters</p>
              <button onClick={clearAll} style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>Clear filters</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {vendors.slice(0, displayedCount).map(v => (
                <VendorCard key={v.id} vendor={v} isVendor={isVendor} format={format} onLogoClick={handleLogoClick} />
              ))}
            </div>
          )}
          <div ref={loadMoreRef} style={{ height: 40 }} />
          {isFetchingMore && (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', marginTop: 14 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Filter sheet ── */}
      {filterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <button style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} onClick={() => setFilterOpen(false)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e0d8cc' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#18100a', fontFamily: 'Georgia,serif' }}>Filter vendors</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9a7c58' }}>Refine by service type</p>
              </div>
              <button onClick={() => setFilterOpen(false)} style={{ padding: '6px 14px', borderRadius: 10, border: '1.5px solid #e0d8cc', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#7a5c30' }}>Done</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>
              {displayedServices.length > 0 ? (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#18100a' }}>
                    Services{categoryFilter ? ' · ' + categoryFilter : ''}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {displayedServices.map(s => {
                      const active = serviceFilter.includes(s);
                      return (
                        <button key={s} onClick={() => toggleService(s)}
                          style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'linear-gradient(135deg,#b8973e,#8a6010)' : '#faf7f2', color: active ? '#fff' : '#7a5c30', boxShadow: active ? '0 2px 8px rgba(184,151,62,0.3)' : '0 1px 3px rgba(0,0,0,0.07)', transition: 'all 0.15s' }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ color: '#9a7c58', fontSize: 13 }}>Select a category above to see available services.</p>
              )}
            </div>
            <div style={{ padding: '12px 20px 24px', display: 'flex', gap: 10, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button onClick={() => setServiceFilter([])} style={{ flex: 1, height: 44, borderRadius: 12, border: '1.5px solid #e0d8cc', background: '#fff', fontSize: 13, fontWeight: 600, color: '#7a5c30', cursor: 'pointer' }}>Clear</button>
              <button onClick={() => setFilterOpen(false)} style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(184,151,62,0.35)' }}>
                Apply{serviceFilter.length > 0 ? ' (' + serviceFilter.length + ')' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
      <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />
    </div>
  );
}
