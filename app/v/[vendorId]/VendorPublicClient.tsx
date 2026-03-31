'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PortfolioGallery from './PortfolioGallery';
import { trackVendorEvent } from '@/lib/analytics';
import { formatWhatsappLink } from '@/lib/whatsapp';
import RateVendorSheet from '@/components/RateVendorSheet';
import { supabase } from '@/lib/supabaseClient';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';

// ── Types ──────────────────────────────────────────────────────────────────

interface VendorData {
  id: string;
  business_name: string;
  category: string;
  location: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  portfolio_urls: string[];
  contact: { whatsapp?: string; phone?: string } | null;
  social_links: Record<string, string>;
  verified: boolean;
  top_rated: boolean;
  rating: number;
  review_count: number;
}

interface ServiceItem { id: string; name: string }

interface PackageItem {
  id: string;
  name: string;
  base_price: number | null;
  pricing_mode: string;
  base_guests: number | null;
  base_hours: number | null;
  included_services: string[];
  is_popular: boolean;
  description: string | null;
}

interface Props {
  vendorId: string;
  vendor: VendorData;
  services: ServiceItem[];
  packages: PackageItem[];
  catIcon: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

const PRICING_LABELS: Record<string, string> = {
  guest: 'guest-based', 'guest-based': 'guest-based',
  time: 'time-based', 'time-based': 'time-based',
  'per-person': 'per person', package: 'fixed package', 'package-based': 'fixed package',
  event: 'per event', 'event-based': 'per event',
  quantity: 'quantity-based', 'quantity-based': 'quantity-based',
};

function formatPrice(n: number) {
  return 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ytId(url: string): string | null {
  const p = [/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
  for (const r of p) { const m = url.match(r); if (m) return m[1]; }
  return null;
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <svg key={i} className={`w-3.5 h-3.5 ${i <= full ? 'text-amber-400' : i === full + 1 && half ? 'text-amber-300' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {count > 0 && <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{rating.toFixed(1)} ({count})</span>}
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────

export default function VendorPublicClient({ vendorId, vendor, services, packages, catIcon }: Props) {
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<'about' | 'portfolio' | 'packages' | 'availability'>('about');
  const [showRating, setShowRating] = useState(false);
  const [isCouple, setIsCouple] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const hasTracked = useRef(false);
  const trackedPackages = useRef<Set<string>>(new Set());

  const portfolio = vendor.portfolio_urls || [];
  const coverImg = vendor.cover_url || portfolio[0] || null;
  const waHref = vendor.contact?.whatsapp ? formatWhatsappLink(vendor.contact.whatsapp) : null;
  const social = vendor.social_links || {};
  const videoId = (social.youtube || social.video) ? ytId((social.youtube || social.video).trim()) : null;
  const hasSocial = ['instagram', 'tiktok', 'facebook', 'website'].some(k => social[k]);

  // Check if user is currently active as a couple (not just has_couple)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_role')
        .eq('id', user.id)
        .maybeSingle();
      setIsCouple(profile?.active_role === 'couple');
    })();
  }, []);

  // Analytics: track profile view on mount
  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    trackVendorEvent(vendorId, 'profile_view', { source: 'public_profile' }).catch(() => {});
  }, [vendorId]);

  // Analytics: track package_view for each package when packages tab is first opened
  useEffect(() => {
    if (activeSection !== 'packages') return;
    packages.forEach(pkg => {
      if (!trackedPackages.current.has(pkg.id)) {
        trackedPackages.current.add(pkg.id);
        trackVendorEvent(vendorId, 'package_view', { package_id: pkg.id, package_name: pkg.name, source: 'public_profile' }).catch(() => {});
      }
    });
  }, [activeSection, vendorId, packages]);

  // Restore saved state from DB
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('saved_vendors')
        .select('id')
        .eq('user_id', user.id)
        .eq('vendor_id', vendorId)
        .maybeSingle();
      setIsSaved(!!data);
    })();
  }, [vendorId]);

  const toggleSave = async () => {
    const next = !isSaved;
    setIsSaved(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (next) {
        await supabase.from('saved_vendors').upsert({ user_id: user.id, vendor_id: vendorId });
        trackVendorEvent(vendorId, 'save_vendor', { source: 'public_profile' }).catch(() => {});
      } else {
        await supabase.from('saved_vendors').delete().eq('user_id', user.id).eq('vendor_id', vendorId);
      }
    }
  };

  const shareProfile = async () => {
    const url = window.location.href;
    const text = `Check out ${vendor.business_name} on uMshado — SA's wedding platform`;
    try {
      if (navigator.share) { await navigator.share({ title: vendor.business_name, text, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const ld = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    name: vendor.business_name, description: vendor.description,
    address: { '@type': 'PostalAddress', addressLocality: vendor.location },
    ...(vendor.logo_url ? { image: vendor.logo_url } : {}),
    ...(vendor.rating > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: vendor.rating, reviewCount: vendor.review_count } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <div className="min-h-screen" style={{ background: 'var(--bg,#F7F0EA)' }}>
        {/* Hero Cover */}
        <div className="relative w-full" style={{ height: 'clamp(280px,52vw,480px)' }}>
          {coverImg ? (
            <Image src={coverImg} alt={vendor.business_name} fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#6b1f3a 0%,#8a2a4d 40%,#c97a8e 100%)' }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)' }} />
          
          {/* Top actions bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between">
            <Link href="/marketplace" className="p-2 bg-white/90 backdrop-blur rounded-full shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex gap-2">
              <button onClick={toggleSave} className="p-2.5 bg-white/90 backdrop-blur rounded-full shadow-lg active:scale-95 transition">
                <svg className={`w-5 h-5 ${isSaved ? 'fill-red-500 text-red-500' : 'text-gray-700'}`} fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button onClick={shareProfile} className="p-2.5 bg-white/90 backdrop-blur rounded-full shadow-lg active:scale-95 transition relative">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied && <div className="absolute -bottom-8 right-0 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap">Copied!</div>}
              </button>
            </div>
          </div>

          {/* Bottom vendor info */}
          <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%)' }}>
            <div className="flex items-start gap-3">
              {vendor.logo_url && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/20 backdrop-blur border-2 border-white/50 flex-shrink-0 relative">
                  <Image src={vendor.logo_url} alt={vendor.business_name} fill className="object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{vendor.business_name}</h1>
                <p className="text-sm mb-2" style={{ color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{catIcon} {vendor.category}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5" style={{ color: '#ffffff' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{vendor.location}</span>
                  </div>
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-md">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                  {vendor.top_rated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded-md">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Top Rated
                    </span>
                  )}
                </div>
                {vendor.rating > 0 && (
                  <div className="mt-2">
                    <StarRating rating={vendor.rating} count={vendor.review_count} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Tab Bar */}
        <div className="sticky top-0 z-10 bg-white border-b" style={{ borderColor: 'var(--border,#eadfd6)' }}>
          <div style={{ maxWidth: 672, margin: '0 auto', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {([
              { key: 'about',        label: 'About'     },
              { key: 'portfolio',    label: 'Portfolio' },
              { key: 'packages',     label: 'Packages'  },
              { key: 'availability', label: 'Dates'     },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                style={{
                  flex: '1 0 auto',
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  borderBottom: activeSection === key ? '2px solid var(--primary,#6b1f3a)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeSection === key ? 'var(--primary,#6b1f3a)' : 'var(--muted,#8b7355)',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-36 pt-6 space-y-6">
          {/* About Tab */}
          {activeSection === 'about' && (
            <>
              {vendor.description && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary,#6b1f3a)' }}>About</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text,#4a3728)' }}>{vendor.description}</p>
                </section>
              )}
              
              {services.length > 0 && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary,#6b1f3a)' }}>Services Offered</h2>
                  <div className="flex flex-wrap gap-2">
                    {services.map(s => (
                      <span key={s.id} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--accent,#fef3e2)', color: 'var(--primary,#6b1f3a)', border: '1px solid var(--border,#eadfd6)' }}>
                        {s.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {hasSocial && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary,#6b1f3a)' }}>Connect</h2>
                  <div className="flex flex-wrap gap-2">
                    {social.instagram && (
                      <a href={/^https?:\/\//i.test(social.instagram) ? social.instagram : `https://${social.instagram}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: 'var(--border,#eadfd6)', color: 'var(--text,#4a3728)' }}>
                        Instagram
                      </a>
                    )}
                    {social.tiktok && (
                      <a href={/^https?:\/\//i.test(social.tiktok) ? social.tiktok : `https://${social.tiktok}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: 'var(--border,#eadfd6)', color: 'var(--text,#4a3728)' }}>
                        TikTok
                      </a>
                    )}
                    {social.facebook && (
                      <a href={/^https?:\/\//i.test(social.facebook) ? social.facebook : `https://${social.facebook}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: 'var(--border,#eadfd6)', color: 'var(--text,#4a3728)' }}>
                        Facebook
                      </a>
                    )}
                    {social.website && (
                      <a href={/^https?:\/\//i.test(social.website) ? social.website : `https://${social.website}`} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl border-2 text-sm font-semibold hover:bg-gray-50 transition" style={{ borderColor: 'var(--border,#eadfd6)', color: 'var(--text,#4a3728)' }}>
                        Website
                      </a>
                    )}
                  </div>
                </section>
              )}

              {waHref && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <h2 className="text-sm font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary,#6b1f3a)' }}>Get in Touch</h2>
                  <div className="space-y-2">
                    {isCouple && (
                      <Link href={`/messages/new?vendorId=${vendorId}`} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold text-sm active:scale-95 transition shadow-md" style={{ background: '#6b1f3a', color: '#ffffff' }}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Start Chat
                      </Link>
                    )}
                    <a href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => trackVendorEvent(vendorId, 'contact_click', { method: 'whatsapp', source: 'public_profile' }).catch(() => {})} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 font-semibold text-sm active:scale-95 transition" style={{ borderColor: '#eadfd6', color: '#6b1f3a', background: '#ffffff' }}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </a>
                    {isCouple && (
                      <button onClick={() => setShowRating(true)} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold text-sm active:scale-95 transition" style={{ background: 'var(--grad-primary)', color: '#ffffff', boxShadow: '0 2px 8px var(--um-crimson-glow)' }}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Rate Vendor
                      </button>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Portfolio Tab */}
          {activeSection === 'portfolio' && (
            <section className="rounded-2xl overflow-hidden p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--primary,#6b1f3a)' }}>Portfolio</h2>
              {videoId && (
                <div className="mb-4 rounded-xl overflow-hidden border-2" style={{ borderColor: 'var(--border,#eadfd6)' }}>
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    {ytPlaying ? (
                      <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title="Vendor Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    ) : (
                      <button onClick={() => setYtPlaying(true)} className="absolute inset-0 w-full h-full" style={{ padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}>
                        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="Video thumbnail" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.22)' }}>
                          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(220,0,0,0.92)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                            <svg className="w-7 h-7" style={{ marginLeft: 4 }} fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <PortfolioGallery images={portfolio} vendorName={vendor.business_name} />
            </section>
          )}

          {/* Packages Tab */}
          {activeSection === 'packages' && (
            <>
              {packages.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <p className="text-sm italic" style={{ color: 'var(--muted,#8b7355)' }}>No packages available yet. Contact vendor for pricing.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {packages.map(pkg => (
                    <div key={pkg.id} className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-base font-bold" style={{ color: 'var(--text,#4a3728)' }}>{pkg.name}</h3>
                            {pkg.is_popular && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Most popular</span>
                            )}
                          </div>
                          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted,#8b7355)' }}>
                            {PRICING_LABELS[pkg.pricing_mode] || pkg.pricing_mode}
                          </p>
                        </div>
                        {pkg.base_price !== null && (
                          <div className="text-xl font-bold" style={{ color: 'var(--primary,#6b1f3a)' }}>{formatPrice(pkg.base_price)}</div>
                        )}
                      </div>

                      {(pkg.base_guests || pkg.base_hours) && (
                        <div className="flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--accent,#fef3e2)', color: 'var(--text,#4a3728)' }}>
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">
                            {pkg.pricing_mode === 'guest' && pkg.base_guests && `${pkg.base_guests}+ guests`}
                            {pkg.pricing_mode === 'time' && pkg.base_hours && `${pkg.base_hours} hours coverage`}
                          </span>
                        </div>
                      )}

                      {pkg.description && (
                        <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text,#4a3728)' }}>{pkg.description}</p>
                      )}

                      {pkg.included_services.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted,#8b7355)' }}>Included services:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {pkg.included_services.map((svc, i) => (
                              <span key={i} className="px-2 py-1 text-xs font-medium rounded border" style={{ background: 'var(--accent,#fef3e2)', color: 'var(--text,#4a3728)', borderColor: 'var(--border,#eadfd6)' }}>
                                {svc}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/quotes/summary?vendorId=${vendorId}&packageId=${pkg.id}`}
                        onClick={() => trackVendorEvent(vendorId, 'quote_requested', { source: 'public_profile', package_id: pkg.id, package_name: pkg.name }).catch(() => {})}
                        className="block w-full px-4 py-3 rounded-xl font-semibold text-sm text-center active:scale-95 transition shadow-md"
                        style={{ background: '#6b1f3a', color: '#ffffff' }}
                      >
                        Request Quote
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Availability Tab */}
          {activeSection === 'availability' && (
            <section className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
              <AvailabilityCalendar vendorId={vendorId} />
            </section>
          )}
        </div>
      </div>

      {/* Rate Vendor Sheet */}
      <RateVendorSheet
        vendorId={vendorId}
        vendorName={vendor.business_name}
        isOpen={showRating}
        onClose={() => setShowRating(false)}
        onSaved={() => {}}
      />
    </>
  );
}
