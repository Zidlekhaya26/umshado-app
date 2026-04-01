'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';
import { supabase } from '@/lib/supabaseClient';
import { trackVendorEvent } from '@/lib/analytics';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { formatWhatsappLink } from '@/lib/whatsapp';
import { useCurrency } from '@/app/providers/CurrencyProvider';

type PricingMode =
  | 'guest-based'
  | 'time-based'
  | 'per-person'
  | 'package-based'
  | 'event-based'
  | 'quantity-based';

interface Package {
  id: string;
  name: string;
  fromPrice: number;
  pricingMode: PricingMode;
  guestRange?: { min: number; max: number };
  hours?: number;
  includedServices: string[];
  isPopular: boolean;
}

interface VendorProfile {
  id: string;
  name: string;
  category: string;
  location: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  topRated: boolean;
  about: string;
  services: string[];
  packages: Package[];
  portfolioImages: number;
  portfolioUrls: string[];
  coverUrl?: string | null;
  contact: {
    whatsapp: string;
    phone: string;
    preferredContact: string;
  };
  socialLinks?: { [key: string]: string };
  preferredCurrency?: string | null;
}

export default function VendorProfile() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = params.vendorId as string;
  const isPreview = searchParams.get('preview') === '1';

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isVendorRole, setIsVendorRole] = useState(false);
  const [myReview, setMyReview] = useState<{ rating: number; review_text: string | null; reviewer_name: string | null; vendor_reply: string | null } | null>(null);
  const [allReviews, setAllReviews] = useState<{ id: string; rating: number; review_text: string | null; reviewer_name: string | null; created_at: string; vendor_reply: string | null }[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const { user, role } = useAuthRole();
  const { format } = useCurrency();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [ytPlaying, setYtPlaying] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const hasTrackedProfileView = useRef(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const initialPinchDistance = useRef<number | null>(null);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  const shareCurrentImage = async () => {
    if (!vendor) return;
    const url = vendor.portfolioUrls[lightboxIndex];
    const title = `${vendor.name} — Image ${lightboxIndex + 1}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert('Image URL copied to clipboard');
      }
    } catch (err) {
      console.warn('Share failed', err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      lastPan.current = { x: pan.x, y: pan.y };
    } else if (e.touches.length === 2) {
      initialPinchDistance.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && zoomScale > 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - (touchStartX.current ?? touch.clientX);
      const base = lastPan.current || { x: 0, y: 0 };
      setPan({ x: base.x + dx, y: base.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = Math.min(3, Math.max(1, zoomScale * (dist / (initialPinchDistance.current || 1))));
      setZoomScale(scale);
    } else if (e.touches.length === 1 && zoomScale > 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - (touchStartX.current ?? touch.clientX);
      const base = lastPan.current || { x: 0, y: 0 };
      setPan({ x: base.x + dx, y: base.y });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // swipe detection when not zoomed
    if (zoomScale <= 1 && e.changedTouches.length === 1 && touchStartX.current != null) {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - touchStartX.current;
      if (dx > 50) setLightboxIndex(i => Math.max(0, i - 1));
      else if (dx < -50 && vendor) setLightboxIndex(i => Math.min((vendor.portfolioUrls || []).length - 1, i + 1));
      touchStartX.current = null;
    }
    // reset pinch reference
    initialPinchDistance.current = null;
    lastPan.current = { x: pan.x, y: pan.y };
    // clamp scale
    setZoomScale(s => Math.min(3, Math.max(1, s)));
  };

  useEffect(() => {
    if (!vendorId) return;
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

  useEffect(() => {
    (async () => {
      if (!vendorId) {
        setVendor(null);
        return;
      }

      const uuidStrict = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
      if (!uuidStrict.test(vendorId)) {
        setVendor(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('id, business_name, category, location, rating, review_count, verified, top_rated, about, description, cover_url, portfolio_images, portfolio_urls, contact, social_links')
          .eq('id', vendorId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching vendor profile:', error);
          console.error('Supabase error details:', { 
            message: error.message, 
            details: error.details, 
            hint: error.hint, 
            code: error.code 
          });
          setVendor(null);
          return;
        }

        if (!data) {
          console.warn('No vendor found with ID:', vendorId);
          setVendor(null);
          return;
        }

        if (data) {
          // Fetch real services for this vendor
          let serviceNames: string[] = [];
          try {
            const { data: vsData } = await supabase
              .from('vendor_services')
              .select('service_id, custom_name, services:service_id(name)')
              .eq('vendor_id', data.id);
            if (vsData) {
              serviceNames = vsData.map((vs: any) => {
                if (vs.custom_name) return vs.custom_name;
                if (vs.services && vs.services.name) return vs.services.name;
                return null;
              }).filter(Boolean);
            }
          } catch (err) {
            console.warn('Could not fetch vendor services:', err);
          }

          // Fetch real packages for this vendor
          let vendorPackages: Package[] = [];
          try {
            const { data: pkgData } = await supabase
              .from('vendor_packages')
              .select('*')
              .eq('vendor_id', data.id)
              .order('base_price', { ascending: true });
            if (pkgData) {
              const dbToAppMode = (mode: string): PricingMode => {
                switch (mode) {
                  case 'guest': return 'guest-based';
                  case 'time': return 'time-based';
                  case 'per-person': return 'per-person';
                  case 'package': return 'package-based';
                  case 'event': return 'event-based';
                  case 'quantity': return 'quantity-based';
                  default: return 'guest-based';
                }
              };
              vendorPackages = pkgData.map((p: any) => ({
                id: p.id,
                name: p.name || '',
                fromPrice: p.base_price || 0,
                pricingMode: dbToAppMode(p.pricing_mode),
                guestRange: p.pricing_mode === 'guest' ? { min: p.base_guests || 0, max: (p.base_guests || 0) + 100 } : undefined,
                hours: p.pricing_mode === 'time' ? (p.base_hours || 0) : undefined,
                includedServices: p.included_services || [],
                isPopular: p.is_popular || false,
              }));
            }
          } catch (err) {
            console.warn('Could not fetch vendor packages:', err);
          }

          // try to fetch vendor user preferences (currency)
          let vendorCurrency: string | null = null;
          try {
            const { data: pref } = await supabase
              .from('user_preferences')
              .select('currency')
              .eq('user_id', data.id)
              .maybeSingle();
            if (pref && pref.currency) vendorCurrency = pref.currency;
          } catch (err) {
            console.warn('Could not fetch vendor preferences:', err);
          }

          setVendor({
            id: data.id,
            name: data.business_name || '',
            category: data.category || '',
            location: data.location || '',
            rating: data.rating || 0,
            reviewCount: data.review_count || 0,
            verified: data.verified || false,
            topRated: data.top_rated || false,
            about: (data.description || data.about) || '',
            services: serviceNames,
            packages: vendorPackages,
            portfolioImages: data.portfolio_images || 0,
            portfolioUrls: data.portfolio_urls || [],
            coverUrl: (data as any).cover_url ?? null,
              contact: data.contact || { whatsapp: '', phone: '', preferredContact: '' },
              socialLinks: data.social_links || {}
            , preferredCurrency: vendorCurrency
          });
        } else {
          setVendor(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching vendor profile:', err);
        setVendor(null);
      }
    })();
  }, [vendorId]);

  useEffect(() => {
    if (!vendor?.id || hasTrackedProfileView.current) return;
    hasTrackedProfileView.current = true;
    trackVendorEvent(vendor.id, 'profile_view', { source: 'vendor_profile' });
  }, [vendor?.id]);

  // Detect if the current user owns this vendor profile + if user is a vendor
  useEffect(() => {
    (async () => {
      try {
        const u = user ?? null;
        if (!u || !vendorId) { setIsOwner(false); setIsVendorRole(false); return; }
        // Use global role
        setIsVendorRole((role ?? 'couple') === 'vendor');
        // Check if vendorId matches user.id directly OR via user_id column
        if (vendorId === u.id) { setIsOwner(true); return; }
        const { data } = await supabase.from('vendors').select('user_id').eq('id', vendorId).maybeSingle();
        setIsOwner(data?.user_id === u.id);
      } catch {
        setIsOwner(false);
        setIsVendorRole(false);
      }
    })();
  }, [vendorId, user, role]);

  // Fetch reviews for this vendor
  useEffect(() => {
    if (!vendorId) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const url = `/api/vendor/${vendorId}/review${session?.user?.id ? `?coupleId=${session.user.id}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const resolvedReviews = (json.reviews || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          review_text: r.review_text,
          reviewer_name: (r.profiles as any)?.full_name || (r.couples as any)?.partner_name || 'Anonymous',
          created_at: r.created_at,
          vendor_reply: r.vendor_reply ?? null,
        }));
        setAllReviews(resolvedReviews);
        if (json.myReview) {
          const mr = json.myReview;
          setMyReview({
            rating: mr.rating,
            review_text: mr.review_text,
            reviewer_name: (mr.profiles as any)?.full_name || (mr.couples as any)?.partner_name || null,
            vendor_reply: mr.vendor_reply ?? null,
          });
        }
      } catch {
        // reviews are non-critical
      }
    })();
  }, [vendorId]);

  const hideCTAs = isPreview || isOwner || isVendorRole;

  const handleToggleSave = async () => {
    if (!vendor?.id) return;
    const next = !isSaved;
    setIsSaved(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (next) {
        await supabase.from('saved_vendors').upsert({ user_id: user.id, vendor_id: vendor.id });
        trackVendorEvent(vendor.id, 'save_vendor', { source: 'vendor_profile' });
      } else {
        await supabase.from('saved_vendors').delete().eq('user_id', user.id).eq('vendor_id', vendor.id);
      }
    }
  };
  // Loading state
  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto w-full max-w-full sm:max-w-md lg:max-w-6xl lg:px-6 min-h-screen bg-white shadow-lg flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading vendor profile...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen" style={{ background: '#faf8f5' }}>
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+80px)]">
        {/* ── Full-bleed Hero ── */}
        <div className="relative w-full flex-shrink-0" style={{ height: 'clamp(280px,55vw,440px)' }}>
          {/* Cover image */}
          {(() => {
            const hero = vendor.coverUrl || vendor.portfolioUrls?.[0] || null;
            return hero ? (
              <img src={hero} alt={`${vendor.name} cover`} className="w-full h-full object-cover" loading="eager" />
            ) : (
              <div className="w-full h-full" style={{ background: 'linear-gradient(135deg,#4d0f21 0%,#9A2143 50%,#c97a8e 100%)' }} />
            );
          })()}
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.05) 58%, rgba(0,0,0,0.82) 100%)' }} />

          {/* Top bar: back + save */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
            <button onClick={() => router.back()} className="p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              <svg className="w-5 h-5" style={{ color: '#1a0d12' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {!hideCTAs && (
              <button onClick={handleToggleSave} className="p-2.5 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                <svg className="w-5 h-5" style={{ color: isSaved ? '#9A2143' : '#1a0d12' }} fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            )}
          </div>

          {/* Bottom overlay: logo + name + meta */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-end gap-3">
              {(() => {
                const logo = (vendor as any).logo_url || null;
                return logo ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2" style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
                    <Image src={logo} alt="logo" width={64} height={64} className="object-cover w-full h-full" />
                  </div>
                ) : null;
              })()}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-white text-xs font-semibold rounded-md" style={{ background: 'rgba(59,130,246,0.85)', backdropFilter: 'blur(4px)' }}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      Verified
                    </span>
                  )}
                  {vendor.topRated && (
                    <span className="px-2 py-0.5 text-white text-xs font-semibold rounded-md" style={{ background: 'rgba(245,158,11,0.9)' }}>Top Rated</span>
                  )}
                </div>
                <h1 className="text-2xl font-bold mb-0.5" style={{ color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.55)', fontFamily: 'var(--font-display,Georgia,serif)', lineHeight: 1.15 }}>{vendor.name}</h1>
                <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}>{vendor.category}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {vendor.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="#fbbf24" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                      <span className="text-sm font-bold" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{vendor.rating.toFixed(1)}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>({vendor.reviewCount})</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-sm" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>{vendor.location}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CTA Strip ── */}
        {hideCTAs ? (
          <div className="px-4 py-3 border-b" style={{ background: '#fff', borderColor: '#e8d5d0' }}>
            {(isPreview || isOwner) ? (
              <div className="rounded-xl px-4 py-2.5 text-center" style={{ background: '#fef3e2', border: '1px solid #e8d5d0' }}>
                <p className="text-sm font-semibold" style={{ color: '#9A2143' }}>Preview mode</p>
                <p className="text-xs mt-0.5" style={{ color: '#7a5060' }}>This is how couples see your profile.</p>
              </div>
            ) : (
              <div className="rounded-xl px-4 py-2.5 text-center" style={{ background: '#fef3e2', border: '1px solid #e8d5d0' }}>
                <p className="text-sm font-semibold" style={{ color: '#9A2143' }}>View only</p>
                <p className="text-xs mt-0.5" style={{ color: '#7a5060' }}>You&apos;re browsing as a vendor.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center gap-2.5 border-b" style={{ background: '#fff', borderColor: '#e8d5d0' }}>
            <Link href={`/messages/new?vendorId=${vendor.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition active:scale-[0.98]" style={{ background: '#9A2143', color: '#fff', boxShadow: '0 2px 8px rgba(154,33,67,0.25)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Chat
            </Link>
            {(() => {
              try {
                const href = formatWhatsappLink(vendor.contact.whatsapp);
                if (href) return (
                  <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackVendorEvent(vendor.id, 'contact_click', { method: 'whatsapp', source: 'vendor_profile' }).catch(() => {})} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition active:scale-[0.98]" style={{ background: '#25D366', color: '#fff' }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    WhatsApp
                  </a>
                );
              } catch {}
              return null;
            })()}
          </div>
        )}

        {/* ── Content ── */}
        <div className="flex-1 pb-28">

          {/* Portfolio Section */}
          <div className="px-4 py-5 border-b" style={{ borderColor: '#e8d5d0' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: '#9A2143' }}>Portfolio</h2>
            {/* Video showreel (if provided) */}
            {(() => {
              const videoUrl = vendor.socialLinks?.youtube || vendor.socialLinks?.video || '';
              if (!videoUrl) return null;
              const extractYouTubeId = (url: string): string | null => {
                const patterns = [/(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/, /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/, /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/];
                for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
                return null;
              };
              const ytId = extractYouTubeId(videoUrl.trim());
              if (ytId) {
                return (
                  <div className="mb-4 rounded-xl overflow-hidden border-2" style={{ borderColor: '#e8d5d0' }}>
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      {ytPlaying ? (
                        <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      ) : (
                        <button onClick={() => setYtPlaying(true)} className="absolute inset-0 w-full h-full" style={{ padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}>
                          <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt="Video thumbnail" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.22)' }}>
                            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(220,0,0,0.92)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                              <svg className="w-7 h-7" style={{ marginLeft: 4 }} fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }
              // mp4 or other direct video
              if (/\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl.trim())) {
                return (
                  <div className="mb-4 rounded-xl overflow-hidden border-2 border-gray-200">
                    <video controls playsInline className="w-full h-auto max-h-[60vh] bg-black"> 
                      <source src={videoUrl.trim()} />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                );
              }
              return null;
            })()}

            {vendor.portfolioUrls.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {vendor.portfolioUrls.slice(0, 9).map((url, index) => (
                    <button
                      key={index}
                      onClick={() => { setLightboxIndex(index); setLightboxOpen(true); }}
                      className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 p-0"
                      type="button"
                    >
                      <img
                        src={url}
                        alt={`Portfolio ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
                {vendor.portfolioUrls.length > 9 && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    +{vendor.portfolioUrls.length - 9} more images
                  </p>
                )}
              </>
            ) : vendor.portfolioImages > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: Math.min(vendor.portfolioImages, 9) }).map((_, index) => (
                    <div
                      key={index}
                      className="aspect-square rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center"
                    >
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  ))}
                </div>
                {vendor.portfolioImages > 9 && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    +{vendor.portfolioImages - 9} more images
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">No portfolio images yet</p>
            )}
          </div>

          {/* Lightbox modal */}
          {lightboxOpen && (
            <div
              className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
              onTouchStart={(e) => handleTouchStart(e)}
              onTouchMove={(e) => handleTouchMove(e)}
              onTouchEnd={(e) => handleTouchEnd(e)}
            >
              <button aria-label="Close" onClick={() => { setLightboxOpen(false); setZoomScale(1); setPan({ x: 0, y: 0 }); }} className="absolute top-4 right-4 p-3 text-white bg-black/30 rounded-full">✕</button>
              <div className="absolute left-4 top-4 flex gap-2">
                <button aria-label="Share" onClick={() => shareCurrentImage()} className="p-2 text-white bg-black/30 rounded-full">⤴</button>
                <a aria-label="Download" href={vendor.portfolioUrls[lightboxIndex]} download className="p-2 text-white bg-black/30 rounded-full">↓</a>
              </div>
              <button aria-label="Prev" onClick={() => { setLightboxIndex(i => Math.max(0, i - 1)); setZoomScale(1); setPan({ x: 0, y: 0 }); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/30 rounded-full">‹</button>
              <div className="max-h-[90vh] max-w-[95vw] flex items-center justify-center">
                <img
                  src={vendor.portfolioUrls[lightboxIndex]}
                  alt={`Full ${lightboxIndex + 1}`}
                  className="object-contain touch-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
                    transition: 'transform 0ms'
                  }}
                />
              </div>
              <button aria-label="Next" onClick={() => { setLightboxIndex(i => Math.min((vendor.portfolioUrls||[]).length - 1, i + 1)); setZoomScale(1); setPan({ x: 0, y: 0 }); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white bg-black/30 rounded-full">›</button>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white text-sm">
                <div className="text-center">Image {lightboxIndex + 1} of {vendor.portfolioUrls.length}</div>
              </div>
            </div>
          )}

          {/* About Section */}
          <div className="px-4 py-5 border-b" style={{ borderColor: '#e8d5d0' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: '#9A2143' }}>About</h2>
            <p className="text-sm leading-relaxed break-words" style={{ color: '#4a3728' }}>{vendor.about}</p>
          </div>

          {/* Services Section */}
          <div className="px-4 py-5 border-b" style={{ borderColor: '#e8d5d0' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: '#9A2143' }}>Services Offered</h2>
            {vendor.services.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vendor.services.map((service) => (
                  <span
                    key={service}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg break-words max-w-full"
                    style={{ background: '#fef3e2', color: '#9A2143', border: '1px solid #e8d5d0' }}
                  >
                    {service}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm italic" style={{ color: '#7a5060' }}>No services listed yet</p>
            )}
          </div>

          {/* Connect / Social Links */}
          {(() => {
            const links = vendor.socialLinks || {};
            const keys = ['instagram','tiktok','facebook','website','whatsapp'];
            const present = keys.filter(k => links[k]);
            if (present.length === 0) return null;
            const normalize = (k: string, v: string) => {
              let url = (v || '').trim();
              if (!url) return null;
              if (k === 'whatsapp') {
                // if contains non-digits keep as-is, else use wa.me
                const digits = url.replace(/[^0-9]/g, '');
                if (digits.length > 6) return `https://wa.me/${digits}`;
              }
              if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
              return url;
            };

            return (
              <div className="px-4 py-4 border-b" style={{ borderColor: '#e8d5d0' }}>
                <h2 className="text-base font-bold mb-3" style={{ color: '#9A2143' }}>Connect</h2>
                <div className="flex flex-wrap gap-2">
                  {present.map(k => {
                    const label = k === 'whatsapp' ? 'WhatsApp' : k.charAt(0).toUpperCase() + k.slice(1);
                    const href = normalize(k, links[k]);
                    if (!href) return null;
                    return (
                      <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl text-sm font-semibold transition" style={{ background: '#fff', border: '1.5px solid #e8d5d0', color: '#9A2143' }}>
                        {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Packages Section */}
          <div className="px-4 py-5 border-b" style={{ borderColor: '#e8d5d0' }}>
            <h2 className="text-base font-bold mb-3" style={{ color: '#9A2143' }}>Packages & Pricing</h2>
            {vendor.packages.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No packages available yet. Contact vendor for pricing.</p>
            ) : (
            <div className="space-y-3">
              {vendor.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl p-4 space-y-3"
                  style={{ background: '#fff', border: '1.5px solid #e8d5d0' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-bold text-gray-900">{pkg.name}</h3>
                        {pkg.isPopular && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                            Most popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {pkg.pricingMode === 'guest-based' && 'Guest-based Pricing'}
                        {pkg.pricingMode === 'time-based' && 'Time-based Pricing'}
                        {pkg.pricingMode === 'per-person' && 'Per Person Pricing'}
                        {pkg.pricingMode === 'package-based' && 'Package Pricing'}
                        {pkg.pricingMode === 'event-based' && 'Event Pricing'}
                        {pkg.pricingMode === 'quantity-based' && 'Quantity Pricing'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-xl font-bold text-amber-900 whitespace-nowrap">{format(pkg.fromPrice)}</p>
                      {vendor.preferredCurrency && (
                        <p className="text-xs text-gray-500">Vendor currency: {vendor.preferredCurrency}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ background: '#fef3e2', color: '#4a3728' }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">
                      {pkg.pricingMode === 'guest-based' && `${pkg.guestRange?.min ?? ''}-${pkg.guestRange?.max ?? ''} guests`}
                      {pkg.pricingMode === 'time-based' && `${pkg.hours ?? ''} hours coverage`}
                      {pkg.pricingMode === 'per-person' && 'Per person rate'}
                      {pkg.pricingMode === 'package-based' && 'Fixed package price'}
                      {pkg.pricingMode === 'event-based' && 'Per event'}
                      {pkg.pricingMode === 'quantity-based' && 'Per quantity'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Included services:</p>
                      <div className="flex flex-wrap gap-1.5">
                      {pkg.includedServices.map((service) => (
                        <span
                          key={service}
                          className="px-2 py-1 text-xs font-medium rounded break-words max-w-full"
                          style={{ background: '#fef3e2', color: '#7a5060', border: '1px solid #e8d5d0' }}
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!hideCTAs && (
                  <Link
                    href={`/quotes/summary?vendorId=${vendor.id}&packageId=${pkg.id}`}
                    onClick={() =>
                      trackVendorEvent(vendor.id, 'quote_requested', {
                        source: 'vendor_profile',
                        package_id: pkg.id,
                        package_name: pkg.name
                      })
                    }
                    className="block w-full px-4 py-3 rounded-xl font-semibold text-sm text-center active:scale-95 transition-all shadow-sm"
                    style={{ background: '#9A2143', color: '#fff' }}
                  >
                    Request Quote
                  </Link>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>

          

          {/* Reviews Section */}
          {(vendor?.reviewCount > 0 || myReview || (isOwner && allReviews.length > 0)) && (
            <div className="px-4 py-5 border-b" style={{ borderColor: '#e8d5d0' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900">Reviews</h2>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-bold text-gray-900">{vendor?.rating?.toFixed(1)}</span>
                  <span className="text-sm text-gray-500">({vendor?.reviewCount})</span>
                </div>
              </div>

              {/* Vendor sees all reviews; couples only see their own */}
              {isOwner ? (
                <div className="space-y-3">
                  {allReviews.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No reviews yet.</p>
                  ) : allReviews.map(r => (
                    <div key={r.id} className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-gray-900">{r.reviewer_name}</span>
                        <span className="text-amber-500 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      </div>
                      {r.review_text && <p className="text-sm text-gray-700 leading-relaxed">{r.review_text}</p>}
                      {/* Existing reply */}
                      {r.vendor_reply && replyingTo !== r.id && (
                        <div className="mt-2 pl-3 border-l-2 border-[#9A2143]">
                          <p className="text-xs font-semibold text-[#9A2143] mb-0.5">Your reply</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{r.vendor_reply}</p>
                          <button
                            className="text-xs text-[#9A2143] mt-1 font-medium underline"
                            onClick={() => { setReplyingTo(r.id); setReplyDraft(r.vendor_reply!); }}
                          >Edit reply</button>
                        </div>
                      )}
                      {/* Reply form */}
                      {replyingTo === r.id ? (
                        <div className="mt-2">
                          <textarea
                            value={replyDraft}
                            onChange={e => setReplyDraft(e.target.value)}
                            placeholder="Write your reply…"
                            rows={3}
                            style={{ width: '100%', borderRadius: 8, border: '1.5px solid rgba(154,33,67,0.25)', padding: '8px 10px', fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button
                              disabled={replySubmitting || !replyDraft.trim()}
                              onClick={async () => {
                                if (!replyDraft.trim()) return;
                                setReplySubmitting(true);
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const res = await fetch(`/api/vendor/${vendorId}/review`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                    body: JSON.stringify({ reviewId: r.id, reply: replyDraft.trim() }),
                                  });
                                  if (res.ok) {
                                    setAllReviews(prev => prev.map(rv => rv.id === r.id ? { ...rv, vendor_reply: replyDraft.trim() } : rv));
                                    setReplyingTo(null);
                                    setReplyDraft('');
                                  }
                                } finally {
                                  setReplySubmitting(false);
                                }
                              }}
                              style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: '#9A2143', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: replySubmitting || !replyDraft.trim() ? 'default' : 'pointer', opacity: replySubmitting || !replyDraft.trim() ? 0.5 : 1 }}
                            >{replySubmitting ? 'Saving…' : 'Post reply'}</button>
                            <button
                              onClick={() => { setReplyingTo(null); setReplyDraft(''); }}
                              style={{ padding: '7px 16px', borderRadius: 8, background: 'transparent', border: '1.5px solid #e0d0d5', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#7a5060' }}
                            >Cancel</button>
                          </div>
                        </div>
                      ) : !r.vendor_reply && (
                        <button
                          className="text-xs text-[#9A2143] mt-2 font-semibold"
                          onClick={() => { setReplyingTo(r.id); setReplyDraft(''); }}
                        >+ Reply</button>
                      )}
                    </div>
                  ))}
                </div>
              ) : myReview ? (
                <div className="bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">Your review</span>
                    <span className="text-amber-500 text-sm">{'★'.repeat(myReview.rating)}{'☆'.repeat(5 - myReview.rating)}</span>
                  </div>
                  {myReview.review_text && <p className="text-sm text-gray-700 leading-relaxed">{myReview.review_text}</p>}
                  {myReview.vendor_reply && (
                    <div className="mt-2 pl-3 border-l-2 border-[#9A2143]">
                      <p className="text-xs font-semibold text-[#9A2143] mb-0.5">Vendor reply</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{myReview.vendor_reply}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Back to Dashboard (owner/preview only) */}
          {(isPreview || isOwner) && (
            <div className="px-4 py-4">
              <Link href="/vendor/dashboard" className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold text-sm text-white transition active:scale-[0.98]" style={{ background: '#BD983F', boxShadow: '0 2px 8px rgba(189,152,63,0.3)' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                Back to Dashboard
              </Link>
            </div>
          )}
        </div>

        {hideCTAs ? <VendorBottomNav /> : <BottomNav />}
      </div>
    </div>
  );
}
