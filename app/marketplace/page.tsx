'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useLocation, distanceKm, type UserLocation } from '@/hooks/useLocation';

/* ─── Types ─────────────────────────────────────────────── */
interface MarketplaceVendor {
  vendor_id: string; business_name: string; category: string;
  city: string; country: string; description: string;
  verified?: boolean; created_at: string; updated_at: string;
  featured?: boolean | null; featured_until?: string | null;
  plan?: string | null; plan_until?: string | null;
  logo_url?: string | null; is_published?: boolean;
  min_from_price: number | null; services: string[]; package_count: number;
  vendor_lat?: number | null; vendor_lng?: number | null;
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
  city: string; country: string; countryCode: string;
  lat?: number | null; lng?: number | null;
  distanceKm?: number | null;
}
type SortOption = 'recommended' | 'nearest' | 'price_low' | 'price_high' | 'newest';
type LocationScope = 'nearby' | 'city' | 'country' | 'all';

/* ─── Constants ─────────────────────────────────────────── */
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

const NEARBY_RADIUS_KM = 80;

/* ─── Score ──────────────────────────────────────────────── */
function calculateScore(
  v: MarketplaceVendor,
  prefs: { category?: string },
  activity?: VendorActivityScore,
  userLoc?: UserLocation | null,
): number {
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
  // Proximity boost — vendors in same city/country score higher
  if (userLoc) {
    const vendorCountryCode = (v.country || '').toUpperCase().slice(0,2);
    if (vendorCountryCode && vendorCountryCode === userLoc.countryCode) score += 25;
    const vendorCity = (v.city || '').toLowerCase();
    const userCity   = (userLoc.city || '').toLowerCase();
    if (vendorCity && userCity && vendorCity === userCity) score += 40;
    // Precise lat/lng proximity bonus
    if (v.vendor_lat && v.vendor_lng) {
      const km = distanceKm(userLoc.lat, userLoc.lng, v.vendor_lat, v.vendor_lng);
      if (km < 20)       score += 35;
      else if (km < 50)  score += 20;
      else if (km < 100) score += 10;
    }
  }
  return score;
}

/* ─── Skeleton ───────────────────────────────────────────── */
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
      <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 11, background: '#f0ebe0', borderRadius: 6 }} />
        <div style={{ height: 11, width: '80%', background: '#f0ebe0', borderRadius: 6 }} />
        <div style={{ height: 11, width: '60%', background: '#f0ebe0', borderRadius: 6 }} />
      </div>
    </div>
  );
}

/* ─── Location pill ──────────────────────────────────────── */
function LocationPill({
  location, loading, permission, scope, onDetect, onClear,
}: {
  location: UserLocation | null; loading: boolean;
  permission: string; scope: LocationScope;
  onDetect: () => void; onClear: () => void;
}) {
  if (loading) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'mpSpin .7s linear infinite' }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Detecting…</span>
    </div>
  );
  if (location) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} onClick={onDetect}>
      <span style={{ fontSize: 13 }}>📍</span>
      <span style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location.label || location.city}</span>
      {scope !== 'all' && (
        <span style={{ fontSize: 9.5, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: 'rgba(189,152,63,0.3)', color: '#ffd77a', border: '1px solid rgba(189,152,63,0.4)', letterSpacing: .3 }}>
          {scope === 'nearby' ? 'NEARBY' : scope === 'city' ? 'CITY' : 'COUNTRY'}
        </span>
      )}
    </div>
  );
  return (
    <button onClick={onDetect} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}>
      <span style={{ fontSize: 13 }}>📍</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
        {permission === 'denied' ? 'Location denied' : 'Enable location'}
      </span>
    </button>
  );
}

/* ─── Vendor card ────────────────────────────────────────── */
function VendorCard({ vendor, isVendor, format, onLogoClick, userLoc }: {
  vendor: Vendor; isVendor: boolean;
  format: (n: number) => string;
  onLogoClick: (src: string, alt: string) => void;
  userLoc: UserLocation | null;
}) {
  const router = useRouter();
  const isFeatured = vendor.score > 240;
  const isRecommended = vendor.score > 120;

  const distLabel = useMemo(() => {
    if (!userLoc || vendor.distanceKm == null) return null;
    if (vendor.distanceKm < 1) return '< 1 km away';
    if (vendor.distanceKm < 10) return `${Math.round(vendor.distanceKm)} km away`;
    return `~${Math.round(vendor.distanceKm / 10) * 10} km away`;
  }, [userLoc, vendor.distanceKm]);

  return (
    <Link href={'/v/' + vendor.id} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff', borderRadius: 20, overflow: 'hidden',
        boxShadow: isFeatured ? '0 8px 32px rgba(184,151,62,0.18), 0 2px 8px rgba(0,0,0,0.06)' : '0 2px 12px rgba(0,0,0,0.07)',
        border: isFeatured ? '1.5px solid rgba(184,151,62,0.5)' : '1.5px solid rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s, transform 0.15s',
        position: 'relative', display: 'flex', flexDirection: 'column', height: '100%',
      }}>
        {isFeatured && (
          <div style={{ position: 'absolute', top: 14, right: 0, zIndex: 2, background: 'linear-gradient(135deg,#b8973e,#e8c84a)', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: '4px 12px 4px 10px', borderRadius: '4px 0 0 4px', boxShadow: '0 2px 8px rgba(184,151,62,0.4)', fontFamily: 'Georgia,serif' }}>FEATURED</div>
        )}

        {/* Logo bar */}
        <div style={{ background: 'linear-gradient(135deg,#faf7f2 0%,#f0ebe0 100%)', padding: '22px 20px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {vendor.logoUrl ? (
            <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onLogoClick(vendor.logoUrl!, vendor.name); }} style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(184,151,62,0.3)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in', padding: 0, flexShrink: 0 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b8973e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontSize: 12, color: '#7a6050' }}>{vendor.location}</span>
            </div>
            {distLabel && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#8a6010', background: 'rgba(184,151,62,0.1)', padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(184,151,62,0.25)', flexShrink: 0 }}>
                {distLabel}
              </span>
            )}
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
                <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); router.push('/messages/new?vendorId=' + vendor.id); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(184,151,62,0.4)', background: 'rgba(184,151,62,0.06)', color: '#8a6010', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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

/* ─── Scope selector bottom sheet ────────────────────────── */
function ScopeSheet({
  scope, setScope, location, onClose, onDetect,
}: {
  scope: LocationScope; setScope: (s: LocationScope) => void;
  location: UserLocation | null; onClose: () => void; onDetect: () => void;
}) {
  const opts: { key: LocationScope; icon: string; label: string; sub: string }[] = [
    { key: 'nearby', icon: '📍', label: 'Nearby', sub: `Within ${NEARBY_RADIUS_KM} km of me` },
    { key: 'city',   icon: '🏙️', label: location?.city || 'My city', sub: 'Vendors in my city' },
    { key: 'country',icon: '🌍', label: location?.country || 'My country', sub: 'All vendors in my country' },
    { key: 'all',    icon: '🌐', label: 'All vendors', sub: 'Browse everyone, everywhere' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,13,18,0.5)', zIndex: 50, animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', zIndex: 60, animation: 'slideUp .25s ease', padding: '0 0 env(safe-area-inset-bottom)', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ width: 40, height: 4, background: 'rgba(154,33,67,0.15)', borderRadius: 2, margin: '12px auto 0' }} />
        <div style={{ padding: '20px 20px 24px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#1a0d12', fontFamily: 'Georgia,serif' }}>📍 Location filter</p>
          <p style={{ margin: '0 0 18px', fontSize: 12, color: '#7a5060' }}>How far should we search for vendors?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opts.map(o => (
              <button key={o.key} onClick={() => { setScope(o.key); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 14, border: scope === o.key ? '2px solid #9A2143' : '1.5px solid #f0ede8', background: scope === o.key ? 'rgba(154,33,67,0.05)' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 22 }}>{o.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: scope === o.key ? '#9A2143' : '#1a0d12' }}>{o.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#7a5060' }}>{o.sub}</p>
                </div>
                {scope === o.key && (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#9A2143', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {!location && (
            <button onClick={() => { onDetect(); onClose(); }} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#9A2143,#731832)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              📍 Enable location access
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function Marketplace() {
  const router = useRouter();
  const { user, role } = useAuthRole();
  const isVendor = role === 'vendor';
  const { format } = useCurrency();
  const { location, loading: locLoading, permission, detect } = useLocation();

  const [searchQuery, setSearchQuery]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [sortBy, setSortBy]             = useState<SortOption>('recommended');
  const [scope, setScope]               = useState<LocationScope>('country'); // default: same country
  const [vendors, setVendors]           = useState<Vendor[]>([]);
  const [allVendors, setAllVendors]     = useState<Vendor[]>([]);
  const [loading, setLoading]           = useState(true);
  const [allServices, setAllServices]   = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [displayedCount, setDisplayedCount] = useState(12);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [scopeOpen, setScopeOpen]       = useState(false);
  const [logoOpen, setLogoOpen]         = useState(false);
  const [logoSrc, setLogoSrc]           = useState<string | null>(null);
  const [logoAlt, setLogoAlt]           = useState<string | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const categories = Array.from(LOCKED_CATEGORIES);

  const handleLogoClick = useCallback((src: string, alt: string) => { setLogoSrc(src); setLogoAlt(alt); setLogoOpen(true); }, []);

  // Auto-detect location on mount
  useEffect(() => { detect(); }, []);

  useEffect(() => { loadData(); }, [user, location]);
  useEffect(() => { applyFiltersAndSort(); setDisplayedCount(12); }, [searchQuery, categoryFilter, serviceFilter, sortBy, scope, allVendors, location]);
  useEffect(() => { setServiceFilter([]); }, [categoryFilter]);

  // Change to 'nearest' sort when scope changes to nearby
  useEffect(() => { if (scope === 'nearby' && sortBy === 'recommended') setSortBy('nearest'); }, [scope]);

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
    if (scope !== 'country') c++;
    return c;
  };

  const clearAll = () => { setSearchQuery(''); setCategoryFilter(''); setServiceFilter([]); setSortBy('recommended'); setScope('country'); };
  const toggleService = (s: string) => setServiceFilter(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const loadData = async () => {
    setLoading(true);
    try {
      const catalog = await getServicesCatalog();
      setCatalogServices(catalog);
      const { data, error } = await supabase.from('marketplace_vendors').select('*');
      if (error) { console.error(error); return; }
      let actData: any[] = [];
      try {
        const result = await supabase.rpc('get_vendor_activity_7d');
        if (result.data) actData = result.data;
      } catch {}
      const actMap = new Map<string, VendorActivityScore>();
      (actData || []).forEach((r: VendorActivityScore) => actMap.set(r.vendor_id, r));

      const mapped: Vendor[] = (data || []).map((v: MarketplaceVendor) => {
        const vLat = v.vendor_lat ?? null;
        const vLng = v.vendor_lng ?? null;
        const dist = (location && vLat && vLng)
          ? distanceKm(location.lat, location.lng, vLat, vLng)
          : null;
        return {
          id: v.vendor_id,
          name: v.business_name || 'Unnamed Vendor',
          category: v.category || 'Other',
          location: [v.city, v.country].filter(Boolean).join(', ') || 'Location not set',
          city: v.city || '',
          country: v.country || '',
          countryCode: (v.country || '').toUpperCase().slice(0, 2),
          fromPrice: v.min_from_price || 0,
          services: v.services || [],
          score: calculateScore(v, {}, actMap.get(v.vendor_id), location),
          logoUrl: v.logo_url,
          verified: v.verified,
          isDemo: !!(v.plan === 'demo' || /\b(test|demo|sample|seed)\b/i.test(v.business_name || '')),
          lat: vLat,
          lng: vLng,
          distanceKm: dist,
        };
      });
      setAllServices(Array.from(new Set(mapped.flatMap(v => v.services))).sort());
      setAllVendors(mapped);
    } finally { setLoading(false); }
  };

  const applyFiltersAndSort = () => {
    let f = [...allVendors];

    // ── Location scope filter ──
    if (location && scope !== 'all') {
      if (scope === 'nearby') {
        f = f.filter(v => v.lat != null && v.lng != null
          ? distanceKm(location.lat, location.lng, v.lat!, v.lng!) <= NEARBY_RADIUS_KM
          : v.city.toLowerCase() === location.city.toLowerCase()
        );
      } else if (scope === 'city') {
        const userCity = location.city.toLowerCase();
        f = f.filter(v => v.city.toLowerCase().includes(userCity) || userCity.includes(v.city.toLowerCase()));
      } else if (scope === 'country') {
        // Match by country code (first 2 chars) or full country name
        const userCC = location.countryCode.toUpperCase();
        const userCountry = location.country.toLowerCase();
        f = f.filter(v => {
          const vCC = v.countryCode.toUpperCase();
          const vCountry = v.country.toLowerCase();
          return vCC === userCC || vCountry === userCountry || vCountry.includes(userCountry) || userCountry.includes(vCountry);
        });
      }
    }

    // ── Text search ──
    const q = searchQuery.toLowerCase().trim();
    if (q) f = f.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.location.toLowerCase().includes(q) ||
      v.services.some(s => s.toLowerCase().includes(q))
    );

    // ── Category ──
    if (categoryFilter) f = f.filter(v => v.category === categoryFilter);
    if (serviceFilter.length) f = f.filter(v => serviceFilter.every(s => v.services.includes(s)));

    // ── Sort ──
    switch (sortBy) {
      case 'recommended': f.sort((a, b) => b.score - a.score); break;
      case 'nearest':
        f.sort((a, b) => {
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
        break;
      case 'price_low':  f.sort((a, b) => { if (!a.fromPrice) return 1; if (!b.fromPrice) return -1; return a.fromPrice - b.fromPrice; }); break;
      case 'price_high': f.sort((a, b) => b.fromPrice - a.fromPrice); break;
      case 'newest':     f.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    setVendors(f);
  };

  /* ─── Location context label ─── */
  const locationLabel = useMemo(() => {
    if (!location) return null;
    if (scope === 'nearby') return `Vendors near ${location.label || location.city}`;
    if (scope === 'city')   return `Vendors in ${location.city}`;
    if (scope === 'country') return `Vendors in ${location.country}`;
    return null;
  }, [location, scope]);

  return (
    <div style={{ minHeight: '100svh', background: '#faf7f2' }}>
      <style>{`
        @keyframes mpSpin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        input,select,button{font-family:inherit!important}
        input::placeholder{color:rgba(255,255,255,0.55)!important}
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100svh', paddingBottom: 90 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(160deg,#5a4633 0%,#7a5d46 60%,#9a7a5a 100%)', padding: '20px 20px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(184,151,62,0.08)', pointerEvents: 'none' }} />

          {/* Top row: title + location pill */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <UmshadoIcon size={26} />
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'Georgia,serif' }}>
                  <span style={{ fontWeight:400, opacity:.7, fontSize:14 }}>umshado </span>marketplace
                </h1>
                <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  {locationLabel || 'Find trusted wedding vendors'}
                </p>
              </div>
            </div>
            <button onClick={() => setScopeOpen(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
              <LocationPill
                location={location} loading={locLoading} permission={permission}
                scope={scope} onDetect={() => detect(true)} onClear={() => setScope('all')}
              />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="15" height="15" fill="none" stroke="rgba(184,151,62,0.7)" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
            </svg>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vendors, services, location…"
              style={{ width: '100%', height: 44, paddingLeft: 42, paddingRight: 16, borderRadius: 14, border: '1.5px solid rgba(184,151,62,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Sort + Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
              style={{ flex: 1, height: 38, borderRadius: 10, border: '1.5px solid rgba(184,151,62,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 13, padding: '0 12px', outline: 'none', cursor: 'pointer' }}>
              <option value="recommended" style={{ color: '#18100a', background: '#fff' }}>⭐ Recommended</option>
              {location && <option value="nearest" style={{ color: '#18100a', background: '#fff' }}>📍 Nearest first</option>}
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
          <div style={{ margin: '0 -20px', overflowX: 'auto', display: 'flex', gap: 8, padding: '0 16px 16px', scrollbarWidth: 'none' }}>
            {['', ...categories].map(cat => (
              <button key={cat || '__all'} onClick={() => setCategoryFilter(cat)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: categoryFilter === cat ? 'linear-gradient(135deg,#b8973e,#8a6010)' : 'rgba(255,255,255,0.1)', color: categoryFilter === cat ? '#fff' : 'rgba(255,255,255,0.75)', boxShadow: categoryFilter === cat ? '0 2px 8px rgba(184,151,62,0.4)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                {cat ? <><span>{CAT_ICONS[cat] ?? '🏢'}</span><span>{cat.split(' ')[0]}</span></> : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Active service chips */}
        {serviceFilter.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            {serviceFilter.map(s => (
              <button key={s} onClick={() => toggleService(s)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(184,151,62,0.12)', color: '#8a6010', border: '1px solid rgba(184,151,62,0.3)', cursor: 'pointer' }}>
                {s} <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span>
              </button>
            ))}
            <button onClick={() => setServiceFilter([])} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f5f5f5', color: '#888', border: '1px solid #e5e5e5', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {/* Location scope banner when filtered */}
        {location && scope !== 'all' && !loading && (
          <div style={{ padding: '8px 16px', background: 'rgba(184,151,62,0.07)', borderBottom: '1px solid rgba(184,151,62,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>📍</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7a5c30' }}>
                {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} {scope === 'nearby' ? `within ${NEARBY_RADIUS_KM} km` : scope === 'city' ? `in ${location.city}` : `in ${location.country}`}
              </span>
            </div>
            <button onClick={() => setScopeOpen(true)} style={{ fontSize: 11, fontWeight: 700, color: '#8a6010', background: 'rgba(184,151,62,0.12)', border: '1px solid rgba(184,151,62,0.25)', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}>
              Change
            </button>
          </div>
        )}

        {/* Count + clear */}
        {scope === 'all' && !loading && (
          <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#9a7c58', fontWeight: 500 }}>{vendors.length} vendor{vendors.length !== 1 ? 's' : ''} found</span>
            {activeCount() > 0 && <button onClick={clearAll} style={{ fontSize: 12, color: '#b8973e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all filters</button>}
          </div>
        )}

        {/* Grid */}
        <div style={{ padding: '8px 16px 20px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : vendors.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>
                {scope !== 'all' ? '📍' : '🔍'}
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#18100a', margin: '0 0 6px', fontFamily: 'Georgia,serif' }}>
                {scope !== 'all' ? `No vendors found ${scope === 'nearby' ? 'nearby' : scope === 'city' ? `in ${location?.city || 'your city'}` : `in ${location?.country || 'your country'}`}` : 'No vendors found'}
              </p>
              <p style={{ fontSize: 13, color: '#9a7c58', margin: '0 0 20px' }}>
                {scope !== 'all' ? 'Try expanding your search area' : 'Try adjusting your search or filters'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {scope !== 'all' && (
                  <button onClick={() => setScope('all')} style={{ padding: '10px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                    Show all vendors
                  </button>
                )}
                <button onClick={clearAll} style={{ padding: '10px 20px', borderRadius: 12, background: '#f5f0e8', color: '#7a5c30', fontWeight: 700, fontSize: 13, border: '1px solid rgba(184,151,62,0.3)', cursor: 'pointer' }}>
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
              {vendors.slice(0, displayedCount).map(v => (
                <VendorCard key={v.id} vendor={v} isVendor={isVendor} format={format} onLogoClick={handleLogoClick} userLoc={location} />
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

      {/* Filter sheet */}
      {filterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <button style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer' }} onClick={() => setFilterOpen(false)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#18100a' }}>Services{categoryFilter ? ' · ' + categoryFilter : ''}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {displayedServices.map(s => {
                      const active = serviceFilter.includes(s);
                      return (
                        <button key={s} onClick={() => toggleService(s)} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'linear-gradient(135deg,#b8973e,#8a6010)' : '#faf7f2', color: active ? '#fff' : '#7a5c30', boxShadow: active ? '0 2px 8px rgba(184,151,62,0.3)' : '0 1px 3px rgba(0,0,0,0.07)', transition: 'all 0.15s' }}>
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
              <button onClick={() => setFilterOpen(false)} style={{ flex: 2, height: 44, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#b8973e,#8a6010)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Apply{serviceFilter.length > 0 ? ' (' + serviceFilter.length + ')' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope sheet */}
      {scopeOpen && (
        <ScopeSheet
          scope={scope} setScope={setScope} location={location}
          onClose={() => setScopeOpen(false)} onDetect={() => detect(true)}
        />
      )}

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
      <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />
    </div>
  );
}
