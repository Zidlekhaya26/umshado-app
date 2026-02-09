'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VendorRow {
  id: string;
  business_name: string | null;
  category: string | null;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  portfolio_urls: string[] | null;
  social_links: Record<string, string> | null;
  contact: { whatsapp?: string; phone?: string; preferredContact?: string } | null;
  is_published: boolean;
}

interface PkgRow {
  id: string;
  name: string;
  base_price: number;
  pricing_mode: string;
  base_guests: number | null;
  base_hours: number | null;
  included_services: string[] | null;
  is_popular: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PRICING_LABELS: Record<string, string> = {
  guest: 'Guest-based',
  time: 'Time-based',
  'per-person': 'Per person',
  package: 'Fixed package',
  event: 'Flat event rate',
  quantity: 'Quantity-based',
};

function pricingLabel(mode: string, baseGuests: number | null, baseHours: number | null): string {
  if (mode === 'guest' && baseGuests != null) return `${baseGuests}+ guests`;
  if (mode === 'time' && baseHours != null) return `${baseHours} hours`;
  return PRICING_LABELS[mode] || mode;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Checklist item                                                     */
/* ------------------------------------------------------------------ */

function CheckItem({ ok, label, href }: { ok: boolean; label: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {ok ? (
          <svg className="w-4.5 h-4.5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-4.5 h-4.5 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
          </svg>
        )}
        <span className={`text-sm ${ok ? 'text-gray-700' : 'text-gray-500'}`}>{label}</span>
      </div>
      {!ok && (
        <Link href={href} className="text-xs font-semibold text-purple-600 hover:text-purple-700">
          Add →
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section header with Edit link                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <Link href={href} className="text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
        Edit
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function VendorReview() {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [packages, setPackages] = useState<PkgRow[]>([]);

  /* ── Load all data from Supabase ────────────────────────────── */

  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user;
        if (!user) { setLoading(false); return; }
        setUserEmail(user.email || null);

        // Fetch vendor row (try user_id first, fallback to id)
        const cols = 'id, business_name, category, location, description, logo_url, cover_url, portfolio_urls, social_links, contact, is_published, onboarding_completed';
        let v: VendorRow | null = null;

        const { data: v1 } = await supabase
          .from('vendors')
          .select(cols)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (v1) { v = v1 as unknown as VendorRow; } else {
          const { data: v2 } = await supabase
            .from('vendors')
            .select(cols)
            .eq('id', user.id)
            .maybeSingle();
          if (v2) v = v2 as unknown as VendorRow;
        }

        if (!v) { setLoading(false); return; }
        setVendorId(v.id);
        setVendor(v);

        // Fetch services (join to services catalog for name)
        const { data: vsData } = await supabase
          .from('vendor_services')
          .select('service_id, custom_name, services:service_id(name)')
          .eq('vendor_id', v.id);

        if (vsData) {
          setServices(
            vsData
              .map((vs: any) => vs.custom_name || vs.services?.name || null)
              .filter(Boolean),
          );
        }

        // Fetch packages
        const { data: pkgData } = await supabase
          .from('vendor_packages')
          .select('id, name, base_price, pricing_mode, base_guests, base_hours, included_services, is_popular')
          .eq('vendor_id', v.id)
          .order('base_price', { ascending: true });

        if (pkgData) setPackages(pkgData as PkgRow[]);
      } catch (err) {
        console.error('Error loading review data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ── Derived state ──────────────────────────────────────────── */

  const socialLinks = vendor?.social_links || {};
  const contact = vendor?.contact || {};
  const portfolioUrls = vendor?.portfolio_urls || [];
  const videoUrl = socialLinks.youtube || '';
  const ytId = videoUrl ? extractYouTubeId(videoUrl) : null;

  // Social entries (excluding the youtube key which is shown separately)
  const socialEntries = useMemo(() => {
    const labels: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', website: 'Website' };
    return Object.entries(socialLinks)
      .filter(([k, v]) => k !== 'youtube' && v)
      .map(([k, v]) => ({ key: k, label: labels[k] || k, url: v }));
  }, [socialLinks]);

  const hasContact = !!(contact.whatsapp || contact.phone || userEmail);
  const hasMedia = !!(vendor?.logo_url || vendor?.cover_url || portfolioUrls.length > 0);

  /* ── Publish readiness checklist ────────────────────────────── */

  const checks = {
    businessName: !!vendor?.business_name,
    services: services.length > 0,
    packages: packages.length >= 1,
    media: hasMedia,
    contact: hasContact,
  };
  const isComplete = Object.values(checks).every(Boolean);

  const searchParams = useSearchParams();
  const forcedEdit = Boolean(searchParams?.get('mode') === 'edit');
  const editMode = Boolean(forcedEdit || vendor?.is_published || (vendor as any)?.onboarding_completed);

  /* ── Publish handler ────────────────────────────────────────── */

  const handlePublish = async () => {
    if (!vendorId) return;
    setIsPublishing(true);
    try {
      // Directly update Supabase to set published + onboarding_completed
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please sign in to publish.');
        return;
      }

      const { error } = await supabase.from('vendors').update({ is_published: true, onboarding_completed: true }).eq('id', vendorId);
      if (error) {
        console.error('Publish error:', error);
        alert('Failed to publish. Please try again.');
        return;
      }

      alert('Congratulations! Your vendor profile has been published successfully!');
      router.push('/vendor/dashboard');
    } catch (err) {
      console.error('Publish error:', err);
      alert('Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  };

  /* ── Loading ────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg flex flex-col pb-24">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Review &amp; Publish</h1>
          <p className="text-sm text-gray-600 mt-1.5">Check everything looks good before going live</p>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
          {/* ── Status banner ────────────────────────────────── */}
          {vendor?.is_published ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-900">Profile is Live!</p>
                <p className="text-xs text-green-700 mt-0.5">Couples can see your profile on the marketplace</p>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl px-4 py-3.5 border flex items-start gap-3 ${isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isComplete ? 'text-green-600' : 'text-amber-600'}`} fill="currentColor" viewBox="0 0 20 20">
                {isComplete ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                )}
              </svg>
              <div>
                <p className={`text-sm font-semibold ${isComplete ? 'text-green-900' : 'text-amber-900'}`}>
                  {isComplete ? 'Ready to publish!' : 'Complete these steps first'}
                </p>
              </div>
            </div>
          )}

          {/* ── Publish checklist ────────────────────────────── */}
          {!vendor?.is_published && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-2.5">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Publish Checklist</h2>
              <CheckItem ok={checks.businessName} label="Business name" href="/vendor/onboarding" />
              <CheckItem ok={checks.services} label="At least 1 service selected" href="/vendor/services" />
              <CheckItem ok={checks.packages} label="At least 1 package created" href="/vendor/packages" />
              <CheckItem ok={checks.media} label="Logo, cover, or portfolio uploaded" href="/vendor/media" />
              <CheckItem ok={checks.contact} label="Contact method available" href="/vendor/media" />
            </div>
          )}

          {/* ── Section 1: Business Information ──────────────── */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <SectionHeader title="Business Information" href="/vendor/onboarding" />
            <div className="space-y-2.5">
              <div>
                <p className="text-xs font-medium text-gray-500">Business Name</p>
                <p className="text-sm text-gray-900 font-medium">{vendor?.business_name || <span className="italic text-gray-400">Not provided yet</span>}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">Category</p>
                  <p className="text-sm text-gray-900">{vendor?.category || <span className="italic text-gray-400">Not selected</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{vendor?.location || <span className="italic text-gray-400">Not provided</span>}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                  {vendor?.description || <span className="italic text-gray-400">No description provided</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Contact Email</p>
                <p className="text-sm text-gray-900">{userEmail || <span className="italic text-gray-400">Not available</span>}</p>
              </div>
            </div>
          </div>

          {/* ── Section 2: Services ──────────────────────────── */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <SectionHeader title="Services Offered" href="/vendor/services" />
            {services.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-100">{s}</span>
                  ))}
                </div>
                <p className="text-xs text-gray-500">{services.length} service{services.length !== 1 && 's'}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">No services added yet</p>
            )}
          </div>

          {/* ── Section 3: Packages & Pricing ────────────────── */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <SectionHeader title="Packages & Pricing" href="/vendor/packages" />
            {packages.length > 0 ? (
              <div className="space-y-3">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{pkg.name}</h3>
                        {pkg.is_popular && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">Popular</span>
                        )}
                      </div>
                      <p className="text-base font-bold text-purple-600 whitespace-nowrap">
                        R{Number(pkg.base_price).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="capitalize">{pricingLabel(pkg.pricing_mode, pkg.base_guests, pkg.base_hours)}</span>
                    </div>
                    {(pkg.included_services?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {pkg.included_services!.slice(0, 4).map((svc) => (
                          <span key={svc} className="px-2 py-0.5 bg-white text-gray-600 text-xs rounded border border-gray-200">{svc}</span>
                        ))}
                        {pkg.included_services!.length > 4 && (
                          <span className="px-2 py-0.5 text-gray-500 text-xs">+{pkg.included_services!.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-gray-500 pt-1">{packages.length} package{packages.length !== 1 && 's'} created</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No packages added yet</p>
            )}
          </div>

          {/* ── Section 4: Media ─────────────────────────────── */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <SectionHeader title="Media & Portfolio" href="/vendor/media" />
            <div className="space-y-3">
              {/* Logo */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Business Logo</p>
                {vendor?.logo_url ? (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                    <Image src={vendor.logo_url} alt="Logo" width={80} height={80} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No logo uploaded</p>
                )}
              </div>

              {/* Cover */}
              {vendor?.cover_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Cover Image</p>
                  <div className="w-full h-32 rounded-lg overflow-hidden border-2 border-gray-200 relative">
                    <Image src={vendor.cover_url} alt="Cover" fill sizes="100vw" className="object-cover" />
                  </div>
                </div>
              )}

              {/* Portfolio thumbnails */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Portfolio ({portfolioUrls.length} image{portfolioUrls.length !== 1 && 's'})</p>
                {portfolioUrls.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {portfolioUrls.slice(0, 8).map((url, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative">
                        <Image src={url} alt={`Portfolio ${i + 1}`} fill sizes="80px" className="object-cover" />
                      </div>
                    ))}
                    {portfolioUrls.length > 8 && (
                      <div className="aspect-square rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                        <span className="text-xs font-semibold text-gray-500">+{portfolioUrls.length - 8}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No portfolio images</p>
                )}
              </div>

              {/* Video showreel */}
              {ytId && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Video Showreel</p>
                  <div className="rounded-lg overflow-hidden border-2 border-gray-200">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title="Video preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 5: Contact & Social ───────────────────── */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4 space-y-3">
            <SectionHeader title="Contact & Social" href="/vendor/media" />
            <div className="space-y-2.5">
              {/* Contact details */}
              {userEmail && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Email</p>
                  <p className="text-sm text-gray-900">{userEmail}</p>
                </div>
              )}
              {contact.whatsapp && (
                <div>
                  <p className="text-xs font-medium text-gray-500">WhatsApp</p>
                  <p className="text-sm text-gray-900">{contact.whatsapp}</p>
                </div>
              )}
              {contact.phone && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900">{contact.phone}</p>
                </div>
              )}
              {contact.preferredContact && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Preferred Contact</p>
                  <p className="text-sm text-gray-900 capitalize">{contact.preferredContact}</p>
                </div>
              )}

              {!hasContact && (
                <p className="text-sm text-gray-400 italic">No contact details added</p>
              )}

              {/* Social links */}
              {socialEntries.length > 0 ? (
                <div className="pt-1 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500">Social Links</p>
                  {socialEntries.map(({ key, label, url }) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 w-20">{label}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline truncate">
                        {url}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-500">Social Links</p>
                  <p className="text-sm text-gray-400 italic">No social links added</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Info note ────────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-blue-900">Ready to go live?</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Once published, couples can view your profile and contact you. You can update your profile anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky bottom bar ────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40">
        <div className="max-w-md mx-auto flex gap-3">
          {editMode ? (
            <>
              <Link href="/vendor/dashboard" className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">Back to Dashboard</Link>
              <Link href="/vendor/profile/edit" className="flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-200">Edit Profile</Link>
            </>
          ) : (
            <>
              <Link href="/vendor/media" className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">Back</Link>
              <button
                onClick={handlePublish}
                disabled={!isComplete || isPublishing || vendor?.is_published}
                className={`flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center transition-all ${
                  isComplete && !isPublishing && !vendor?.is_published
                    ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-200'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isPublishing ? 'Publishing…' : vendor?.is_published ? 'Already Published' : 'Publish Profile'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
