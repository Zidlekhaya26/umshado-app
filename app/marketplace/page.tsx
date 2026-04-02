'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { LOCKED_CATEGORIES } from '@/lib/marketplaceCategories';
import ImageLightbox from '@/components/ui/ImageLightbox';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { formatBudget, type Currency } from '@/lib/currency';
import { getServicesCatalog, type Service as CatalogService } from '@/lib/vendorServices';
import { useLocation, distanceKm, type UserLocation } from '@/hooks/useLocation';
import { trackVendorEvent } from '@/lib/analytics';

/* ─── Sponsored Ad Types & Dummy Data ───────────────────── */
interface SponsoredAd {
  id: string;
  vendorId?: string;
  vendorName?: string | null;
  headline: string;
  body: string;
  cta: string;
  category: string;
  color: string;
  emoji: string;
  imageUrl?: string | null;
  discountPct?: number | null;
}


/* ─── Types ─────────────────────────────────────────────── */
interface MarketplaceVendor {
  vendor_id: string; business_name: string; category: string;
  city: string; country: string; description: string;
  verified?: boolean; created_at: string; updated_at: string;
  featured?: boolean | null; featured_until?: string | null;
  plan?: string | null; plan_until?: string | null;
  logo_url?: string | null; is_published?: boolean;
  min_from_price: number | null; services: string[]; package_count: number;
  rating?: number | null; review_count?: number | null;
  vendor_lat?: number | null; vendor_lng?: number | null;
  country_code?: string | null;
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
  rating: number; reviewCount: number;
  city: string; country: string; countryCode: string;
  lat?: number | null; lng?: number | null;
  distanceKm?: number | null;
}
type SortOption = 'recommended' | 'nearest' | 'price_low' | 'price_high' | 'top_rated';
type LocationScope = 'nearby' | 'city' | 'country' | 'all';

/* ─── Constants ─────────────────────────────────────────── */
const NEARBY_RADIUS_KM = 80;

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

/* ─── Score helper ──────────────────────────────────────── */
function calculateScore(
  v: MarketplaceVendor,
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
  if (v.rating && v.rating > 0) score += Math.min(v.rating * 6, 30);
  if (activity) {
    score += Math.min(activity.profile_views * 0.1, 10);
    score += Math.min(activity.quotes * 2, 20);
    score += Math.min(activity.messages * 1, 10);
    score += Math.min(activity.saves * 3, 15);
  }
  if (userLoc) {
    const vendorCC = (v.country || '').toUpperCase().slice(0, 2);
    if (vendorCC && vendorCC === userLoc.countryCode) score += 25;
    const vendorCity = (v.city || '').toLowerCase();
    const userCity   = (userLoc.city || '').toLowerCase();
    if (vendorCity && userCity && vendorCity === userCity) score += 40;
    if (v.vendor_lat && v.vendor_lng) {
      const km = distanceKm(userLoc.lat, userLoc.lng, v.vendor_lat, v.vendor_lng);
      if (km < 20) score += 35;
      else if (km < 50) score += 20;
      else if (km < 100) score += 10;
    }
  }
  return score;
}

/* ─── Star rating ───────────────────────────────────────── */
function StarRating({ rating, count, size = 12 }: { rating: number; count: number; size?: number }) {
  if (!rating || rating === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <div style={{ display: 'flex', gap: 1 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#f59e0b' : '#e5e7eb'}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <span style={{ fontSize: size - 1, color: '#6b7280', fontWeight: 500 }}>
        {rating.toFixed(1)} {count > 0 && `(${count})`}
      </span>
    </div>
  );
}

/* ─── Skeleton card ─────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid #f1f0ee' }}>
      <div style={{ height: 72, background: 'linear-gradient(135deg, #f8f6f2, #f0ebe0)' }} />
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: '#ede8df', marginTop: -22, border: '2.5px solid #fff', flexShrink: 0 }} />
          <div style={{ flex: 1, marginTop: 6 }}>
            <div style={{ height: 14, width: '60%', background: '#ede8df', borderRadius: 6, marginBottom: 6 }} />
            <div style={{ height: 11, width: '40%', background: '#f2ede6', borderRadius: 6 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {[70, 90, 60].map((w, i) => <div key={i} style={{ height: 22, width: w, background: '#f5f0e8', borderRadius: 20 }} />)}
        </div>
        <div style={{ height: 1, background: '#f0ebe0', marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ height: 16, width: 70, background: '#ede8df', borderRadius: 6 }} />
          <div style={{ height: 34, width: 80, background: '#e8e0d4', borderRadius: 10 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Location pill ──────────────────────────────────────── */
function LocationPill({
  location, loading, permission, scope, onDetect,
}: {
  location: UserLocation | null; loading: boolean;
  permission: string; scope: LocationScope; onDetect: () => void;
}) {
  if (loading) return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
      <div style={{ width: 11, height: 11, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'mpSpin .7s linear infinite' }} />
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Detecting…</span>
    </div>
  );
  if (location) return (
    <div onClick={onDetect} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>
      <span style={{ fontSize: 12 }}>📍</span>
      <span style={{ fontSize: 11.5, color: '#fff', fontWeight: 700, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location.label || location.city}</span>
      {scope !== 'all' && (
        <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20, background: 'rgba(184,151,62,0.3)', color: '#ffd77a', border: '1px solid rgba(184,151,62,0.4)', letterSpacing: .3 }}>
          {scope === 'nearby' ? 'NEARBY' : scope === 'city' ? 'CITY' : 'COUNTRY'}
        </span>
      )}
    </div>
  );
  return (
    <button onClick={onDetect} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer' }}>
      <span style={{ fontSize: 12 }}>📍</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
        {permission === 'denied' ? 'Location denied' : 'Enable location'}
      </span>
    </button>
  );
}

/* ─── Scope sheet ────────────────────────────────────────── */
declare global { interface Window { google: any; __googleMapsPromise?: Promise<void>; __googleMapsReady?: () => void; } }

function loadGoogleMapsForMarketplace(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__googleMapsPromise) return window.__googleMapsPromise;
  window.__googleMapsPromise = new Promise<void>((resolve, reject) => {
    window.__googleMapsReady = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places,geocoding&callback=__googleMapsReady`;
    script.async = true;
    script.onerror = () => { window.__googleMapsPromise = undefined; reject(); };
    document.head.appendChild(script);
  });
  return window.__googleMapsPromise;
}

function ScopeSheet({
  scope, setScope, location, onClose, onDetect, onManualLocation,
}: {
  scope: LocationScope; setScope: (s: LocationScope) => void;
  location: UserLocation | null; onClose: () => void; onDetect: () => void;
  onManualLocation: (loc: UserLocation) => void;
}) {
  const [cityInput, setCityInput] = useState('');
  const [suggestions, setSuggestions] = useState<{ place_id: string; description: string }[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    loadGoogleMapsForMarketplace().then(() => {
      autocompleteRef.current = new window.google.maps.places.AutocompleteService();
    }).catch(() => {});
  }, []);

  const fetchCitySuggestions = (input: string) => {
    if (!input || input.length < 2 || !autocompleteRef.current) { setSuggestions([]); setSuggestOpen(false); return; }
    autocompleteRef.current.getPlacePredictions(
      { input, types: ['(cities)'] },
      (results: any[], status: string) => {
        if (status === 'OK' && results) { setSuggestions(results.slice(0, 5)); setSuggestOpen(true); }
        else { setSuggestions([]); setSuggestOpen(false); }
      }
    );
  };

  const selectCity = async (placeId: string, description: string) => {
    setSuggestOpen(false);
    setCityInput(description);
    setGeocoding(true);
    try {
      await loadGoogleMapsForMarketplace();
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId }, (results: any[], status: string) => {
        setGeocoding(false);
        if (status !== 'OK' || !results?.[0]) return;
        const r = results[0];
        const lat = r.geometry.location.lat();
        const lng = r.geometry.location.lng();
        const parts = description.split(',');
        const city = parts[0]?.trim() || description;
        const country = parts[parts.length - 1]?.trim() || '';
        const loc: UserLocation = { city, country, countryCode: '', lat, lng, label: description };
        onManualLocation(loc);
        setScope('city');
        onClose();
      });
    } catch { setGeocoding(false); }
  };

  const opts: { key: LocationScope; icon: string; label: string; sub: string }[] = [
    { key: 'nearby',  icon: '📍', label: 'Nearby',                          sub: `Within ${NEARBY_RADIUS_KM} km of me` },
    { key: 'city',    icon: '🏙️', label: location?.city || 'My city',       sub: 'Vendors in my city' },
    { key: 'country', icon: '🌍', label: location?.country || 'My country', sub: 'All vendors in my country' },
    { key: 'all',     icon: '🌐', label: 'All vendors',                     sub: 'Browse everyone, everywhere' },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, animation: 'fadeIn .2s ease' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', zIndex: 60, animation: 'slideUp .25s ease', padding: '0 0 env(safe-area-inset-bottom)', maxWidth: 560, margin: '0 auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 36, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '12px auto 0' }} />
        <div style={{ padding: '20px 20px 24px' }}>
          <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif' }}>📍 Location filter</p>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9ca3af' }}>How far should we search for vendors?</p>

          {/* City search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" fill="none" stroke="#8b2040" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <input
                value={cityInput}
                onChange={e => { setCityInput(e.target.value); fetchCitySuggestions(e.target.value); }}
                placeholder="Search a city or area…"
                style={{ width: '100%', height: 44, paddingLeft: 36, paddingRight: 12, borderRadius: 12, border: '1.5px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box', outline: 'none', color: '#111827' }}
              />
              {geocoding && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#9ca3af' }}>…</span>}
            </div>
            {suggestOpen && suggestions.length > 0 && (
              <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 0, margin: '4px 0 0', listStyle: 'none', zIndex: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                {suggestions.map((s, i) => (
                  <li key={s.place_id}
                    onMouseDown={e => { e.preventDefault(); selectCity(s.place_id, s.description); }}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#111827', borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span style={{ fontSize: 14 }}>📍</span> {s.description}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {opts.map(o => (
              <button key={o.key} onClick={() => { setScope(o.key); onClose(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 14, border: scope === o.key ? '2px solid #8b2040' : '1.5px solid #f1f0ee', background: scope === o.key ? 'rgba(139,32,64,0.05)' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 22 }}>{o.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: scope === o.key ? '#8b2040' : '#111827' }}>{o.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>{o.sub}</p>
                </div>
                {scope === o.key && (
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#8b2040', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" fill="none" stroke="#fff" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          {!location && (
            <button onClick={() => { onDetect(); onClose(); }} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 13, border: 'none', background: 'linear-gradient(135deg,#6b1a2e,#8b2040)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              📍 Use my GPS location
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Featured Hero Banner (top slot — first boost ad) ──── */
function FeaturedHeroBanner({ ad }: { ad: SponsoredAd }) {
  const bannerRef = useRef<HTMLAnchorElement>(null);
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!ad.vendorId || impressionFired.current) return;
    const el = bannerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !impressionFired.current) {
        impressionFired.current = true;
        trackVendorEvent(ad.vendorId!, 'ad_impression', { boost_id: ad.id, source: 'marketplace_hero' }).catch(() => {});
        obs.disconnect();
      }
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad.vendorId, ad.id]);

  return (
    <div style={{ padding: '0 16px 14px' }}>
      <p style={{ margin: '0 0 8px', fontSize: 10.5, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, textTransform: 'uppercase' }}>Featured on uMshado</p>
      <Link
        ref={bannerRef}
        href={ad.vendorId ? `/v/${ad.vendorId}` : '/marketplace'}
        style={{ textDecoration: 'none', display: 'block' }}
        onClick={() => { if (ad.vendorId) trackVendorEvent(ad.vendorId, 'ad_click', { boost_id: ad.id, source: 'marketplace_hero' }).catch(() => {}); }}
      >
        <div style={{ borderRadius: 20, overflow: 'hidden', background: ad.imageUrl ? 'transparent' : `linear-gradient(135deg,${ad.color}15,${ad.color}28)`, border: `1.5px solid ${ad.color}33`, boxShadow: `0 6px 28px ${ad.color}22`, position: 'relative', minHeight: 130, display: 'flex', cursor: 'pointer' }}>
          {ad.imageUrl && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <img src={ad.imageUrl} alt={ad.headline} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.65) 50%, transparent)' }} />
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 1, flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
            {ad.vendorName && (
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: ad.imageUrl ? 'rgba(255,255,255,0.75)' : ad.color }}>{ad.vendorName}</p>
            )}
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'Georgia,serif', lineHeight: 1.2, color: ad.imageUrl ? '#fff' : '#111827' }}>{ad.headline}</h2>
            {ad.body && (
              <p style={{ margin: 0, fontSize: 12.5, color: ad.imageUrl ? 'rgba(255,255,255,0.8)' : '#4b5563', lineHeight: 1.4 }}>{ad.body.slice(0, 90)}{ad.body.length > 90 ? '…' : ''}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div style={{ padding: '7px 18px', borderRadius: 24, background: ad.color, color: '#fff', fontSize: 12, fontWeight: 800, letterSpacing: 0.4, boxShadow: `0 3px 12px ${ad.color}44` }}>
                {ad.cta.toUpperCase()}
              </div>
              {ad.discountPct && (
                <div style={{ padding: '7px 14px', borderRadius: 24, background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {ad.discountPct}% OFF
                </div>
              )}
            </div>
          </div>
          {!ad.imageUrl && (
            <div style={{ width: '22%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54 }}>
              {ad.emoji}
            </div>
          )}
          {/* SPONSORED badge */}
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.07)', zIndex: 2 }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>FEATURED</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ─── Sponsored Ad Card ─────────────────────────────────── */
function SponsoredAdCard({ ad }: { ad: SponsoredAd }) {
  const hasImage = Boolean(ad.imageUrl);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const impressionFired = useRef(false);

  useEffect(() => {
    if (!ad.vendorId || impressionFired.current) return;
    const el = linkRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !impressionFired.current) {
        impressionFired.current = true;
        trackVendorEvent(ad.vendorId!, 'ad_impression', { boost_id: ad.id, source: 'marketplace' }).catch(() => {});
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ad.vendorId, ad.id]);

  return (
    <Link ref={linkRef} href={ad.vendorId ? `/v/${ad.vendorId}` : '/marketplace'} style={{ textDecoration: 'none', gridColumn: '1 / -1', display: 'block' }} onClick={() => { if (ad.vendorId) trackVendorEvent(ad.vendorId, 'ad_click', { boost_id: ad.id, source: 'marketplace' }).catch(() => {}); }}>
    <div style={{ borderRadius: 20, overflow: 'hidden', background: `${ad.color}0c`, border: `1.5px solid ${ad.color}22`, boxShadow: `0 4px 20px ${ad.color}12`, position: 'relative', display: 'flex', minHeight: 156, cursor: 'pointer' }}>
      {/* Left content */}
      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 7, justifyContent: 'center', minWidth: 0 }}>
        {/* Category chip */}
        <div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${ad.color}18`, color: ad.color, border: `1px solid ${ad.color}28` }}>
            {ad.category.split('&')[0].trim()}
          </span>
        </div>
        {/* Vendor name */}
        {ad.vendorName && (
          <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: ad.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>{ad.vendorName}</p>
        )}
        {/* Headline */}
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#111827', fontFamily: 'Georgia,serif', lineHeight: 1.25 }}>{ad.headline}</h3>
        {/* CTA */}
        <div style={{ alignSelf: 'flex-start', marginTop: 2, padding: '8px 18px', borderRadius: 24, background: ad.color, color: '#fff', fontSize: 11.5, fontWeight: 800, letterSpacing: 0.4, boxShadow: `0 3px 10px ${ad.color}35` }}>
          {ad.cta.toUpperCase()}
        </div>
      </div>

      {/* Right: image or emoji placeholder */}
      {hasImage ? (
        <div style={{ width: '38%', flexShrink: 0, position: 'relative' }}>
          <img src={ad.imageUrl!} alt={ad.headline} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {ad.discountPct && (
            <div style={{ position: 'absolute', bottom: 12, left: 12, background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20, letterSpacing: 0.3 }}>
              {ad.discountPct}% OFF
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: '28%', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: `${ad.color}10`, borderLeft: `1px solid ${ad.color}18` }}>
          <span style={{ fontSize: 42 }}>{ad.emoji}</span>
          {ad.discountPct && (
            <div style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 11px', borderRadius: 20, letterSpacing: 0.3 }}>
              {ad.discountPct}% OFF
            </div>
          )}
        </div>
      )}

      {/* SPONSORED badge */}
      <div style={{ position: 'absolute', top: 12, right: hasImage ? 'calc(38% + 10px)' : 12, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.07)', backdropFilter: 'blur(4px)', zIndex: 2 }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', letterSpacing: 0.5 }}>SPONSORED</span>
      </div>
    </div>
    </Link>
  );
}

/* ─── Vendor Card ───────────────────────────────────────── */
function VendorCard({ vendor, isVendor, format, onLogoClick, userLoc }: {
  vendor: Vendor; isVendor: boolean;
  format: (n: number) => string;
  onLogoClick: (src: string, alt: string) => void;
  userLoc: UserLocation | null;
}) {
  const router = useRouter();
  const isFeatured = vendor.score > 240;
  const catCfg = CAT_CONFIG[vendor.category] ?? { icon: '🏢', color: '#9ca3af' };

  const distLabel = useMemo(() => {
    if (!userLoc || vendor.distanceKm == null) return null;
    if (vendor.distanceKm < 1) return '< 1 km';
    if (vendor.distanceKm < 10) return `${Math.round(vendor.distanceKm)} km away`;
    return `~${Math.round(vendor.distanceKm / 10) * 10} km away`;
  }, [userLoc, vendor.distanceKm]);

  return (
    <Link href={'/v/' + vendor.id} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        style={{
          background: isFeatured ? '#fff' : `${catCfg.color}09`,
          borderRadius: 20, overflow: 'hidden',
          border: isFeatured ? '1.5px solid rgba(184,151,62,0.4)' : `1px solid ${catCfg.color}22`,
          boxShadow: isFeatured ? '0 6px 24px rgba(184,151,62,0.13)' : '0 2px 10px rgba(0,0,0,0.04)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = isFeatured ? '0 14px 36px rgba(184,151,62,0.18)' : '0 8px 22px rgba(0,0,0,0.09)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = isFeatured ? '0 6px 24px rgba(184,151,62,0.13)' : '0 2px 10px rgba(0,0,0,0.05)';
        }}
      >
        {/* ── Top bar: category + badges ── */}
        <div style={{ padding: '13px 14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: `${catCfg.color}12`, fontSize: 11, fontWeight: 700, color: catCfg.color }}>
            <span style={{ fontSize: 13 }}>{catCfg.icon}</span>
            <span>{vendor.category.split('&')[0].trim()}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {vendor.verified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 20, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#2563eb"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#2563eb', letterSpacing: 0.3 }}>Verified</span>
              </div>
            )}
            {isFeatured && (
              <div style={{ padding: '3px 9px', borderRadius: 20, background: 'linear-gradient(135deg,#b8973e,#e8c84a)', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.8 }}>★ Featured</div>
            )}
          </div>
        </div>

        {/* ── Logo + Name + Location ── */}
        <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
          {vendor.logoUrl ? (
            <button type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onLogoClick(vendor.logoUrl!, vendor.name); }}
              style={{ width: 56, height: 56, borderRadius: 14, overflow: 'hidden', border: '1.5px solid #f1f0ee', background: '#fafafa', flexShrink: 0, cursor: 'zoom-in', padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', position: 'relative' }}>
              <Image src={vendor.logoUrl!} alt={vendor.name} fill style={{ objectFit: 'contain', padding: 6 }} />
            </button>
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: `linear-gradient(135deg,${catCfg.color}cc,${catCfg.color}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: 'Georgia,serif', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              {vendor.name.split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2 }}>{vendor.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth={2.5} strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vendor.location}</span>
              {distLabel && (
                <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#7a5c30', background: 'rgba(184,151,62,0.1)', padding: '1px 6px', borderRadius: 20, border: '1px solid rgba(184,151,62,0.2)' }}>{distLabel}</span>
              )}
            </div>
            {vendor.rating > 0 && (
              <div style={{ marginTop: 4 }}>
                <StarRating rating={vendor.rating} count={vendor.reviewCount} />
              </div>
            )}
          </div>
        </div>

        {/* ── Service tags ── */}
        {vendor.services.length > 0 && (
          <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {vendor.services.slice(0, 3).map((s, i) => (
              <span key={i} style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 20, background: '#f7f6f3', color: '#4b5563', border: '1px solid #edecea', fontWeight: 500 }}>{s}</span>
            ))}
            {vendor.services.length > 3 && (
              <span style={{ fontSize: 10.5, padding: '4px 10px', borderRadius: 20, background: '#f7f6f3', color: '#9ca3af', border: '1px solid #edecea', fontWeight: 500 }}>+{vendor.services.length - 3} more</span>
            )}
          </div>
        )}

        {/* ── Price + CTA ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 14px', borderTop: '1px solid #f5f4f1', marginTop: 'auto' }}>
          <div>
            {vendor.fromPrice > 0 ? (
              <>
                <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, marginBottom: 1 }}>From</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: -0.4 }}>
                  {vendor.preferredCurrency && vendor.preferredCurrency !== 'ZAR'
                    ? formatBudget(vendor.fromPrice, vendor.preferredCurrency as Currency)
                    : format(vendor.fromPrice)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>Contact for pricing</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            {!isVendor && (
              <button type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); router.push('/messages/new?vendorId=' + vendor.id); }}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1.5px solid #ebebeb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 16px', borderRadius: 12, background: 'linear-gradient(135deg,#6b1a2e,#9A2143)', color: '#fff', fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2 }}>
              View
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function Marketplace() {
  const router = useRouter();
  const { user, role } = useAuthRole();
  const isVendor = role === 'vendor';
  const { format } = useCurrency();
  const { location, loading: locLoading, permission, detect } = useLocation();

  const [searchQuery, setSearchQuery]       = useState('');
  const [searchFocused, setSearchFocused]   = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [serviceFilter, setServiceFilter]   = useState<string[]>([]);
  const [sortBy, setSortBy]                 = useState<SortOption>('recommended');
  const [scope, setScope]                   = useState<LocationScope>('all');
  const [vendors, setVendors]               = useState<Vendor[]>([]);
  const [allVendors, setAllVendors]         = useState<Vendor[]>([]);
  const [loading, setLoading]               = useState(true);
  const [allServices, setAllServices]       = useState<string[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [displayedCount, setDisplayedCount] = useState(12);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [verifiedOnly, setVerifiedOnly]     = useState(false);
  const [budgetMax, setBudgetMax]           = useState<number | null>(null);
  const [filterOpen, setFilterOpen]         = useState(false);
  const [scopeOpen, setScopeOpen]           = useState(false);
  const [logoOpen, setLogoOpen]             = useState(false);
  const [logoSrc, setLogoSrc]               = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState<UserLocation | null>(null);

  // Use manualLocation (from Places search) if GPS location not available or overridden
  const effectiveLocation = manualLocation || location;
  const [logoAlt, setLogoAlt]               = useState<string | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [liveAds, setLiveAds] = useState<SponsoredAd[]>([]);
  const categories = Array.from(LOCKED_CATEGORIES);

  const handleLogoClick = useCallback((src: string, alt: string) => {
    setLogoSrc(src); setLogoAlt(alt); setLogoOpen(true);
  }, []);

  useEffect(() => { detect(); }, []);

  useEffect(() => {
    fetch('/api/ads/active').then(r => r.json()).then(j => {
      if (j.ads?.length) setLiveAds(j.ads);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [user, effectiveLocation]);
  useEffect(() => { applyFiltersAndSort(); setDisplayedCount(12); }, [searchQuery, categoryFilter, serviceFilter, sortBy, scope, allVendors, effectiveLocation, verifiedOnly, budgetMax]);
  useEffect(() => { setServiceFilter([]); }, [categoryFilter]);
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
    if (verifiedOnly) c++;
    if (budgetMax) c++;
    return c;
  };

  const clearAll = () => { setSearchQuery(''); setCategoryFilter(''); setServiceFilter([]); setSortBy('recommended'); setScope('country'); setVerifiedOnly(false); setBudgetMax(null); };
  const toggleService = (s: string) => setServiceFilter(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const loadData = async () => {
    setLoading(true);
    try {
      const catalog = await getServicesCatalog();
      setCatalogServices(catalog);
      const { data, error } = await supabase.from('marketplace_vendors').select('*');
      if (error) { console.error(error); return; }
      let actData: VendorActivityScore[] = [];
      try {
        const result = await supabase.rpc('get_vendor_activity_7d');
        if (result.data) actData = result.data;
      } catch (err) { console.error('[Marketplace] Activity scores failed:', err); }
      const actMap = new Map<string, VendorActivityScore>();
      (actData || []).forEach((r: VendorActivityScore) => actMap.set(r.vendor_id, r));

      const mapped: Vendor[] = (data || []).map((v: MarketplaceVendor) => {
        const vLat = v.vendor_lat ?? null;
        const vLng = v.vendor_lng ?? null;
        const dist = (effectiveLocation && vLat && vLng) ? distanceKm(effectiveLocation.lat, effectiveLocation.lng, vLat, vLng) : null;
        return {
          id: v.vendor_id,
          name: v.business_name || 'Unnamed Vendor',
          category: v.category || 'Other',
          location: [v.city, v.country].filter(Boolean).join(', ') || 'Location not set',
          city: v.city || '',
          country: v.country || '',
          countryCode: v.country_code || '',
          fromPrice: v.min_from_price || 0,
          services: v.services || [],
          score: calculateScore(v, actMap.get(v.vendor_id), effectiveLocation),
          logoUrl: v.logo_url,
          verified: v.verified,
          isDemo: !!(v.plan === 'demo' || /\b(test|demo|sample|seed)\b/i.test(v.business_name || '')),
          rating: v.rating || 0,
          reviewCount: v.review_count || 0,
          lat: vLat,
          lng: vLng,
          distanceKm: dist,
        };
      });
      const live = mapped.filter(v => !v.isDemo);
      setAllServices(Array.from(new Set(live.flatMap(v => v.services))).sort());
      setAllVendors(live);
    } finally { setLoading(false); }
  };

  const applyFiltersAndSort = () => {
    let f = [...allVendors];

    if (effectiveLocation && scope !== 'all') {
      if (scope === 'nearby') {
        // Filter to vendors within radius; fall back to same city if no coords
        f = f.filter(v => v.lat != null && v.lng != null
          ? distanceKm(effectiveLocation.lat, effectiveLocation.lng, v.lat!, v.lng!) <= NEARBY_RADIUS_KM
          : v.city.toLowerCase() === effectiveLocation.city.toLowerCase());
      } else if (scope === 'city') {
        const uc = effectiveLocation.city.toLowerCase();
        f = f.filter(v => v.city.toLowerCase().includes(uc) || uc.includes(v.city.toLowerCase()));
      } else if (scope === 'country') {
        // Exact ISO code match first, then exact country name — no substring (prevents cross-country bleed)
        const uCC = effectiveLocation.countryCode.toUpperCase();
        const uCN = effectiveLocation.country.toLowerCase();
        f = f.filter(v => {
          if (v.countryCode && v.countryCode.toUpperCase() === uCC) return true;
          if (v.country.toLowerCase() === uCN) return true;
          return false;
        });
      }
    }

    // When showing all vendors and location is known: sort by nearest (Uber-style)
    // so the most relevant vendors bubble up without hiding anyone
    const effectiveSortBy = (scope === 'all' && effectiveLocation && sortBy === 'recommended') ? 'nearest' : sortBy;

    const q = searchQuery.toLowerCase().trim();
    if (q) f = f.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.location.toLowerCase().includes(q) ||
      v.services.some(s => s.toLowerCase().includes(q))
    );
    if (categoryFilter) f = f.filter(v => v.category === categoryFilter);
    if (serviceFilter.length) f = f.filter(v => serviceFilter.every(s => v.services.includes(s)));
    if (verifiedOnly) f = f.filter(v => v.verified);
    if (budgetMax) f = f.filter(v => v.fromPrice === 0 || v.fromPrice <= budgetMax);

    switch (effectiveSortBy) {
      case 'recommended': f.sort((a, b) => b.score - a.score); break;
      case 'nearest':     f.sort((a, b) => { if (a.distanceKm == null) return 1; if (b.distanceKm == null) return -1; return a.distanceKm - b.distanceKm; }); break;
      case 'price_low':   f.sort((a, b) => { if (!a.fromPrice) return 1; if (!b.fromPrice) return -1; return a.fromPrice - b.fromPrice; }); break;
      case 'price_high':  f.sort((a, b) => b.fromPrice - a.fromPrice); break;
      case 'top_rated':   f.sort((a, b) => b.rating - a.rating); break;
    }
    setVendors(f);
  };

  const featuredCount = vendors.filter(v => v.score > 240).length;

  const locationLabel = useMemo(() => {
    if (!effectiveLocation) return null;
    if (scope === 'nearby')  return `Vendors near ${effectiveLocation.label || effectiveLocation.city}`;
    if (scope === 'city')    return `Vendors in ${effectiveLocation.city}`;
    if (scope === 'country') return `Vendors in ${effectiveLocation.country}`;
    return null;
  }, [effectiveLocation, scope]);

  return (
    <div style={{ minHeight: '100svh', background: '#f8f7f4' }}>
      <style>{`
        .mp-search::placeholder { color: rgba(255,255,255,0.5) !important; }
        .mp-search:focus { background: rgba(255,255,255,0.15) !important; }
        .cat-pill { transition: all 0.15s; }
        .cat-pill:hover { opacity: 0.9; transform: scale(1.02); }
        @keyframes mpSpin   { to { transform: rotate(360deg); } }
        @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp  { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        .vendor-grid > * { animation: fadeUp 0.3s ease both; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100svh', paddingBottom: 90 }}>

        {/* ── Header ── */}
        <div style={{ background: 'linear-gradient(160deg, #4d0f21 0%, #6b1a2e 40%, #8b2040 80%, #a8305a 100%)', position: 'relative', overflow: 'hidden' }}>
          {/* Decorative orbs */}
          <div style={{ position: 'absolute', top: -80, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,180,180,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 20, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,151,62,0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,100,120,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />
          {/* Gold shimmer line */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent 0%, rgba(184,151,62,0.6) 40%, rgba(232,200,74,0.8) 60%, transparent 100%)', pointerEvents: 'none' }} />

          <div style={{ padding: '22px 20px 16px', position: 'relative' }}>
            {/* Title + location pill */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 10 }}>
              <div>
                <h1 style={{ margin: '0 0 3px', fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', lineHeight: 1, letterSpacing: -0.5 }}>uMshado Marketplace</h1>
                <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>Find your vendors</p>
                <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.38)' }}>
                  {loading ? '…' : locationLabel || (effectiveLocation ? `Sorted by distance · ${allVendors.length} vendors` : `${allVendors.length} trusted vendors`)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 }}>
                <button onClick={() => setScopeOpen(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <LocationPill location={effectiveLocation} loading={locLoading} permission={permission} scope={scope} onDetect={() => detect(true)} />
                </button>
                {!loading && featuredCount > 0 && (
                  <div style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(184,151,62,0.18)', border: '1px solid rgba(184,151,62,0.35)', fontSize: 10.5, color: '#e8c84a', fontWeight: 700, letterSpacing: 0.3 }}>
                    ★ {featuredCount} Featured
                  </div>
                )}
              </div>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}
                width="16" height="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="mp-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search vendors, categories, services…"
                style={{
                  width: '100%', height: 48, paddingLeft: 46, paddingRight: 40,
                  borderRadius: 14, boxSizing: 'border-box',
                  border: searchFocused ? '1.5px solid rgba(184,151,62,0.6)' : '1.5px solid rgba(255,255,255,0.1)',
                  background: searchFocused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                  color: '#fff', fontSize: 14, outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s', backdropFilter: 'blur(8px)',
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>

            {/* Sort + Filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortOption)}
                style={{ flex: 1, height: 40, borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, padding: '0 12px', outline: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                <option value="recommended" style={{ color: '#18100a', background: '#fff' }}>⭐ Recommended</option>
                <option value="top_rated"   style={{ color: '#18100a', background: '#fff' }}>⭐ Top Rated</option>
                {effectiveLocation && <option value="nearest" style={{ color: '#18100a', background: '#fff' }}>📍 Nearest first</option>}
                <option value="price_low"   style={{ color: '#18100a', background: '#fff' }}>↑ Price: Low → High</option>
                <option value="price_high"  style={{ color: '#18100a', background: '#fff' }}>↓ Price: High → Low</option>
              </select>
              <button onClick={() => setFilterOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 40, borderRadius: 10, cursor: 'pointer', border: activeCount() > 0 ? '1.5px solid rgba(184,151,62,0.6)' : '1.5px solid rgba(255,255,255,0.1)', background: activeCount() > 0 ? 'rgba(184,151,62,0.18)' : 'rgba(255,255,255,0.08)', color: activeCount() > 0 ? '#e8c84a' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, backdropFilter: 'blur(8px)' }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" d="M3 6h18M7 12h10M11 18h2" /></svg>
                Filters
                {activeCount() > 0 && <span style={{ background: '#b8973e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20 }}>{activeCount()}</span>}
              </button>
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 20px', scrollbarWidth: 'none' }}>
            <button className="cat-pill" onClick={() => setCategoryFilter('')}
              style={{ flexShrink: 0, padding: '8px 18px', borderRadius: 24, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: categoryFilter === '' ? 'none' : '1px solid rgba(255,255,255,0.2)', background: categoryFilter === '' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)', color: categoryFilter === '' ? '#9A2143' : 'rgba(255,255,255,0.75)', boxShadow: categoryFilter === '' ? '0 4px 14px rgba(0,0,0,0.25)' : 'none' }}>
              All
            </button>
            {categories.map(cat => {
              const cfg = CAT_CONFIG[cat] ?? { icon: '🏢', color: '#9ca3af' };
              const active = categoryFilter === cat;
              return (
                <button key={cat} className="cat-pill" onClick={() => setCategoryFilter(cat)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 24, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: active ? 'none' : '1px solid rgba(255,255,255,0.2)', background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.1)', color: active ? cfg.color : 'rgba(255,255,255,0.75)', boxShadow: active ? '0 4px 14px rgba(0,0,0,0.25)' : 'none', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                  <span>{cat.split('&')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active service chips */}
        {serviceFilter.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', scrollbarWidth: 'none', background: '#fff', borderBottom: '1px solid #f1f0ee' }}>
            {serviceFilter.map(s => (
              <button key={s} onClick={() => toggleService(s)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(184,151,62,0.1)', color: 'var(--um-gold-dark)', border: '1px solid rgba(184,151,62,0.25)', cursor: 'pointer' }}>
                {s} <span style={{ fontSize: 10, opacity: 0.6 }}>✕</span>
              </button>
            ))}
            <button onClick={() => setServiceFilter([])} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f5f5f5', color: '#888', border: '1px solid #e5e5e5', cursor: 'pointer' }}>Clear</button>
          </div>
        )}

        {/* Location scope banner */}
        {location && scope !== 'all' && !loading && (
          <div style={{ padding: '8px 16px', background: 'rgba(184,151,62,0.06)', borderBottom: '1px solid rgba(184,151,62,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }}>📍</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7a5c30' }}>
                {vendors.length} vendor{vendors.length !== 1 ? 's' : ''}{scope === 'nearby' ? ` within ${NEARBY_RADIUS_KM} km` : scope === 'city' ? ` in ${location?.city}` : scope === 'country' ? ` in ${location?.country}` : ''}
              </span>
            </div>
            <button onClick={() => setScopeOpen(true)} style={{ fontSize: 11, fontWeight: 700, color: 'var(--um-gold-dark)', background: 'rgba(184,151,62,0.1)', border: '1px solid rgba(184,151,62,0.2)', borderRadius: 20, padding: '3px 10px', cursor: 'pointer' }}>Change</button>
          </div>
        )}

        {/* Count / clear bar */}
        <div style={{ padding: '10px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!loading && (
            <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
              {vendors.length} vendor{vendors.length !== 1 ? 's' : ''} found
            </span>
          )}
          {activeCount() > 0 && (
            <button onClick={clearAll} style={{ fontSize: 12, color: '#b8973e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
          )}
        </div>

        {/* Grid */}
        <div style={{ padding: '4px 16px 20px', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : vendors.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.25 }}>{scope !== 'all' ? '📍' : '🔍'}</div>
              <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: '0 0 6px', fontFamily: 'Georgia,serif' }}>
                {scope !== 'all' ? `No vendors found ${scope === 'nearby' ? 'nearby' : scope === 'city' ? `in ${location?.city || 'your city'}` : `in ${location?.country || 'your country'}`}` : 'No vendors found'}
              </p>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>
                {scope !== 'all' ? 'Try expanding your search area' : 'Try adjusting your search or filters'}
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                {scope !== 'all' && (
                  <button onClick={() => setScope('all')} style={{ padding: '11px 22px', borderRadius: 12, background: 'linear-gradient(135deg,#6b1a2e,#8b2040)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(107,26,46,0.3)' }}>
                    Show all vendors
                  </button>
                )}
                <button onClick={clearAll} style={{ padding: '11px 22px', borderRadius: 12, background: '#f8f7f4', color: '#7a5c30', fontWeight: 700, fontSize: 13, border: '1px solid rgba(184,151,62,0.3)', cursor: 'pointer' }}>
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Hero banner — first boost ad gets the top featured slot */}
              {liveAds.length > 0 && liveAds[0].vendorId && (
                <FeaturedHeroBanner ad={liveAds[0]} />
              )}
              <div className="vendor-grid" style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>
                {vendors.slice(0, displayedCount).map((v, idx) => {
                  // In-feed slots start from liveAds[1] onwards (liveAds[0] is the hero)
                  const inFeedAds = liveAds.length > 1 ? liveAds.slice(1) : liveAds;
                  const adIndex = Math.floor(idx / 8);
                  const showAdAfter = (idx + 1) % 8 === 0 && adIndex < inFeedAds.length;
                  return (
                    <Fragment key={v.id}>
                      <div style={{ animationDelay: `${Math.min(idx, 8) * 0.05}s` }}>
                        <VendorCard vendor={v} isVendor={isVendor} format={format} onLogoClick={handleLogoClick} userLoc={location} />
                      </div>
                      {showAdAfter && (
                        <SponsoredAdCard key={`ad-${idx}`} ad={inFeedAds[adIndex]} />
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </>
          )}
          <div ref={loadMoreRef} style={{ height: 40 }} />
          {isFetchingMore && (
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', marginTop: 14 }}>
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}
        </div>
      </div>

      {/* Filter sheet */}
      {filterOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <button style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer' }} onClick={() => setFilterOpen(false)} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 14px', borderBottom: '1px solid #f1f0ee' }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'Georgia,serif' }}>Filter vendors</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Refine by service type</p>
              </div>
              <button onClick={() => setFilterOpen(false)} style={{ padding: '7px 16px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Done</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Verified only toggle */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Verification</p>
                <button
                  onClick={() => setVerifiedOnly(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1.5px solid ${verifiedOnly ? '#2563eb' : '#e5e7eb'}`, background: verifiedOnly ? 'rgba(37,99,235,0.07)' : '#fff', cursor: 'pointer', width: '100%' }}
                >
                  <div style={{ width: 38, height: 22, borderRadius: 11, background: verifiedOnly ? '#2563eb' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: verifiedOnly ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: verifiedOnly ? '#1d4ed8' : '#111827' }}>Verified vendors only</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Show only uMshado-verified businesses</p>
                  </div>
                </button>
              </div>

              {/* Budget max */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Max budget{budgetMax ? ` · R${budgetMax.toLocaleString()}` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="e.g. 20000"
                    value={budgetMax ?? ''}
                    onChange={e => setBudgetMax(e.target.value ? Number(e.target.value) : null)}
                    style={{ flex: 1, height: 44, borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '0 14px', fontSize: 14, color: '#111827', outline: 'none', background: '#fafafa' }}
                  />
                  {budgetMax && (
                    <button onClick={() => setBudgetMax(null)} style={{ padding: '0 14px', height: 44, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer', flexShrink: 0 }}>Clear</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[5000, 10000, 20000, 50000].map(val => (
                    <button key={val} onClick={() => setBudgetMax(budgetMax === val ? null : val)}
                      style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: budgetMax === val ? 'linear-gradient(135deg,#6b1a2e,#8b2040)' : '#f3f4f6', color: budgetMax === val ? '#fff' : '#6b7280' }}>
                      R{(val/1000).toFixed(0)}k
                    </button>
                  ))}
                </div>
              </div>

              {/* Services */}
              {displayedServices.length > 0 ? (
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Services{categoryFilter ? ` · ${categoryFilter}` : ''}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {displayedServices.map(s => {
                      const active = serviceFilter.includes(s);
                      return (
                        <button key={s} onClick={() => toggleService(s)}
                          style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: active ? 'linear-gradient(135deg,#6b1a2e,#8b2040)' : '#f8f7f4', color: active ? '#fff' : '#374151', boxShadow: active ? '0 2px 8px rgba(107,26,46,0.2)' : '0 1px 3px rgba(0,0,0,0.06)', transition: 'all 0.15s' }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Select a category above to filter services.</p>
              )}
            </div>
            <div style={{ padding: '12px 20px 24px', display: 'flex', gap: 10, borderTop: '1px solid #f1f0ee' }}>
              <button onClick={() => { setServiceFilter([]); setVerifiedOnly(false); setBudgetMax(null); }} style={{ flex: 1, height: 46, borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Clear</button>
              <button onClick={() => setFilterOpen(false)} style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6b1a2e,#8b2040)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(107,26,46,0.3)' }}>
                Apply{(serviceFilter.length + (verifiedOnly ? 1 : 0) + (budgetMax ? 1 : 0)) > 0 ? ` (${serviceFilter.length + (verifiedOnly ? 1 : 0) + (budgetMax ? 1 : 0)})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope sheet */}
      {scopeOpen && (
        <ScopeSheet
          scope={scope} setScope={setScope} location={effectiveLocation}
          onClose={() => setScopeOpen(false)} onDetect={() => detect(true)}
          onManualLocation={(loc) => { setManualLocation(loc); }}
        />
      )}

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
      <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />
    </div>
  );
}
