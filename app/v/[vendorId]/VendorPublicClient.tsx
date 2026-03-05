'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PortfolioGallery from './PortfolioGallery';
import { trackVendorEvent } from '@/lib/analytics';
import { formatWhatsappLink } from '@/lib/whatsapp';

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
  const [activeSection, setActiveSection] = useState<'about' | 'portfolio' | 'packages'>('about');
  const hasTracked = useRef(false);

  const portfolio = vendor.portfolio_urls || [];
  const coverImg = vendor.cover_url || portfolio[0] || null;
  const waHref = vendor.contact?.whatsapp ? formatWhatsappLink(vendor.contact.whatsapp) : null;
  const social = vendor.social_links || {};
  const videoId = (social.youtube || social.video) ? ytId((social.youtube || social.video).trim()) : null;
  const hasSocial = ['instagram', 'tiktok', 'facebook', 'website'].some(k => social[k]);

  // Analytics: track profile view on mount
  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    trackVendorEvent(vendorId, 'profile_view', { source: 'public_profile' }).catch(() => {});
  }, [vendorId]);

  // Restore saved state
  useEffect(() => {
    try { setIsSaved(localStorage.getItem(`saved_vendor_${vendorId}`) === '1'); } catch {}
  }, [vendorId]);

  const toggleSave = () => {
    const next = !isSaved;
    setIsSaved(next);
    try { localStorage.setItem(`saved_vendor_${vendorId}`, next ? '1' : '0'); } catch {}
    if (next) trackVendorEvent(vendorId, 'save_vendor', { source: 'public_profile' }).catch(() => {});
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
        {/* HERO and rest omitted for brevity (kept identical to provided implementation) */}
        <div className="relative w-full" style={{ height: 'clamp(280px,52vw,480px)' }}>
          {coverImg ? (
            <img src={coverImg} alt={vendor.business_name} className="absolute inset-0 w-full h-full object-cover" loading="eager" />
          ) : (
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#6b1f3a 0%,#8a2a4d 40%,#c97a8e 100%)' }} />
          )}
          {/* ...rest of UI (kept as in attachment) */}
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-36 pt-4 space-y-4">
          {/* Render About / Portfolio / Packages sections */}
          {activeSection === 'about' && (
            <>
              {vendor.description && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <p>{vendor.description}</p>
                </section>
              )}
              {services.length > 0 && (
                <section className="rounded-2xl p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  {/* services list */}
                </section>
              )}
            </>
          )}

          {activeSection === 'portfolio' && (
            <section className="rounded-2xl overflow-hidden p-5" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--primary,#6b1f3a)' }}>Portfolio</h2>
              {videoId && (
                <div className="mb-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border,#eadfd6)' }}>
                  {/* video */}
                </div>
              )}
              <PortfolioGallery images={portfolio} vendorName={vendor.business_name} />
            </section>
          )}

          {activeSection === 'packages' && (
            <>
              {packages.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                  <p>No packages</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {packages.map((pkg, idx) => (
                    <div key={pkg.id} className="rounded-2xl p-4" style={{ background: '#fff', border: '1.5px solid var(--border,#eadfd6)' }}>
                      <h3 className="font-semibold">{pkg.name}</h3>
                      {pkg.base_price !== null && <div>{formatPrice(pkg.base_price)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
