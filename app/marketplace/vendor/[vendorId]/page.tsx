'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { trackVendorEvent } from '@/lib/analytics';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { formatWhatsappLink } from '@/lib/whatsapp';

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
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
    const key = `saved_vendor_${vendorId}`;
    try {
      setIsSaved(localStorage.getItem(key) === '1');
    } catch {
      setIsSaved(false);
    }
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !vendorId) { setIsOwner(false); setIsVendorRole(false); return; }
        // Check active role — vendors should not see couple CTAs on any profile
        const { data: profile } = await supabase.from('profiles').select('active_role').eq('id', user.id).maybeSingle();
        if (profile?.active_role === 'vendor') setIsVendorRole(true);
        // Check if vendorId matches user.id directly OR via user_id column
        if (vendorId === user.id) { setIsOwner(true); return; }
        const { data } = await supabase.from('vendors').select('user_id').eq('id', vendorId).maybeSingle();
        setIsOwner(data?.user_id === user.id);
      } catch {
        setIsOwner(false);
        setIsVendorRole(false);
      }
    })();
  }, [vendorId]);

  const hideCTAs = isPreview || isOwner || isVendorRole;

  const handleToggleSave = async () => {
    if (!vendor?.id) return;
    const next = !isSaved;
    setIsSaved(next);
    const key = `saved_vendor_${vendor.id}`;
    try {
      localStorage.setItem(key, next ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    if (next) {
      trackVendorEvent(vendor.id, 'save_vendor', { source: 'vendor_profile' });
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col px-4">
        {/* Header with Back Button and Hero */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 -ml-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-3">
                {/* Avatar / Logo */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                  {(() => {
                    const logo = (vendor as any).logo_url || vendor.portfolioUrls[0] || null;
                    return logo ? (
                      <button
                        type="button"
                        onClick={() => { (window as any).__vendorLogoPreview = logo; /* noop for SSR */ }}
                        className="w-full h-full flex items-center justify-center"
                        aria-label="View vendor logo"
                      >
                        <img src={logo} alt="vendor" className="w-full h-full object-contain p-2" />
                      </button>
                    ) : (
                      <span>{vendor.name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase()}</span>
                    );
                  })()}
                </div>

                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-gray-900 truncate">{vendor.name}</h1>
                  <p className="text-xs text-gray-600 truncate mt-0.5">{vendor.category}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <VerifiedBadge verified={vendor.verified} />
                    {vendor.topRated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-200">
                        Top Rated
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">{vendor.rating}</div>
                <div className="text-xs text-gray-500">{vendor.reviewCount} reviews</div>
              </div>
              {!hideCTAs && (
                <button
                  onClick={handleToggleSave}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isSaved
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50'
                  }`}
                >
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-28">
          {/* Hero Cover */}
          <div className="px-4 pt-4">
            <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
              {(() => {
                const hero = vendor.coverUrl || vendor.portfolioUrls?.[0] || null;
                if (!hero) {
                  return (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200" />
                  );
                }
                return (
                  <img
                    src={hero}
                    alt={`${vendor.name} cover`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                );
              })()}

              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            </div>
          </div>

          {/* Vendor Info Card */}
          <div className="px-4 py-5 border-b border-gray-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {vendor.verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md border border-blue-200">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                  {vendor.topRated && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-md border border-amber-200">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Top Rated
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 mb-2">
                  <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-lg font-bold text-gray-900">{vendor.rating}</span>
                  <span className="text-sm text-gray-600">({vendor.reviewCount} reviews)</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{vendor.location}</span>
                </div>
                {!hideCTAs && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleToggleSave}
                    className="px-4 py-2 rounded-xl border border-purple-300 text-purple-700 font-semibold text-sm bg-white hover:bg-purple-50 active:scale-[0.98] transition"
                  >
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Portfolio Section */}
          <div className="px-4 py-5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3">Portfolio</h2>
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
                  <div className="mb-4 rounded-xl overflow-hidden border-2 border-gray-200">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${ytId}`} title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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
          <div className="px-4 py-5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3">About</h2>
            <p className="text-sm text-gray-700 leading-relaxed break-words">{vendor.about}</p>
          </div>

          {/* Services Section */}
          <div className="px-4 py-5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3">Services Offered</h2>
            {vendor.services.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vendor.services.map((service) => (
                  <span
                    key={service}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg border border-purple-100 break-words max-w-full"
                  >
                    {service}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No services listed yet</p>
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
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-900 mb-3">Connect</h2>
                <div className="flex flex-wrap gap-2">
                  {present.map(k => {
                    const label = k === 'whatsapp' ? 'WhatsApp' : k.charAt(0).toUpperCase() + k.slice(1);
                    const href = normalize(k, links[k]);
                    if (!href) return null;
                    return (
                      <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                        {label}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Packages Section */}
          <div className="px-4 py-5 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900 mb-3">Packages & Pricing</h2>
            {vendor.packages.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No packages available yet. Contact vendor for pricing.</p>
            ) : (
            <div className="space-y-3">
              {vendor.packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3"
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
                    <p className="text-xl font-bold text-purple-600 whitespace-nowrap">
                      R{pkg.fromPrice.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
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
                          className="px-2 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded border border-gray-200 break-words max-w-full"
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
                    className="block w-full px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm text-center hover:bg-purple-700 active:scale-95 transition-all shadow-sm"
                  >
                    Request Quote
                  </Link>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>

          

          {/* Contact Section */}
          <div className="px-4 py-5">
            {hideCTAs ? (
              <div className="space-y-3">
                {(isPreview || isOwner) ? (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                      <p className="text-sm font-semibold text-amber-800">Preview mode</p>
                      <p className="text-xs text-amber-700 mt-1">This is how couples see your profile. Couple actions are hidden.</p>
                    </div>
                    <Link
                      href="/vendor/dashboard"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-base hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
                      Back to Dashboard
                    </Link>
                  </>
                ) : (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-purple-800">View only</p>
                    <p className="text-xs text-purple-700 mt-1">You&apos;re browsing as a vendor. Couple actions are hidden.</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-gray-900 mb-3">Get in Touch</h2>
                <div className="space-y-2.5">
                  <Link
                    href={`/messages/new?vendorId=${vendor.id}`}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-base hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Start Chat
                  </Link>

                  {(() => {
                    try {
                      const href = formatWhatsappLink(vendor.contact.whatsapp);
                      if (href) {
                        return (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base hover:bg-green-600 transition-colors">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            WhatsApp: {vendor.contact.whatsapp}
                          </a>
                        );
                      }
                    } catch {
                      // fallback below
                    }
                    return (
                      <button
                        disabled
                        className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base opacity-80 cursor-not-allowed"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        WhatsApp: {vendor.contact.whatsapp}
                      </button>
                    );
                  })()}
                </div>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Preferred contact method: <span className="font-medium capitalize">{vendor.contact.preferredContact}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {hideCTAs ? <VendorBottomNav /> : <BottomNav />}
      </div>
    </div>
  );
}
