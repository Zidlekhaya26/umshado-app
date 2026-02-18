'use client';

import { useState, useEffect } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { getVendorSetupStatus } from '@/lib/vendorOnboarding';
import VendorBottomNav from '@/components/VendorBottomNav';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VendorProfile {
  id: string;
  business_name: string | null;
  category: string | null;
  location: string | null;
  description: string | null;
  logo_url: string | null;
  is_published: boolean;
  contact: { whatsapp?: string; phone?: string } | null;
  portfolio_urls?: string[];
}

interface Quote {
  id: string;
  quote_ref: string;
  package_name: string;
  guest_count: number;
  hours: number;
  base_from_price: number;
  status: string;
  created_at: string;
  couple_id: string;
  couple_name: string;
  couple_avatar?: string | null;
}

interface Metrics {
  profileViews: number;
  savedByCouples: number;
  chatsStarted: number;
  quotesReceived: number;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function VendorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({ profileViews: 0, savedByCouples: 0, chatsStarted: 0, quotesReceived: 0 });
  const [quoteRequests, setQuoteRequests] = useState<Quote[]>([]);
  const [negotiations, setNegotiations] = useState<Quote[]>([]);
  const [recentNotifications, setRecentNotifications] = useState<{ id: string; title: string; body: string; created_at: string; link: string | null }[]>([]);
  const [servicesCount, setServicesCount] = useState(0);
  const [packagesCount, setPackagesCount] = useState(0);
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string | undefined>(undefined);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  /* ── Load everything ────────────────────────────────────────── */

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Find vendor row
      let v: VendorProfile | null = null;

      const cols = 'id, business_name, category, location, description, logo_url, is_published, onboarding_completed, contact, portfolio_urls';
      const { data: v1 } = await supabase.from('vendors').select(cols).eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (v1) { v = v1 as unknown as VendorProfile; } else {
        const { data: v2 } = await supabase.from('vendors').select(cols).eq('id', user.id).maybeSingle();
        if (v2) v = v2 as unknown as VendorProfile;
      }

      if (!v) { setLoading(false); return; }
      setVendor(v);

      // determine onboarding status for this vendor
      try {
        const status = await getVendorSetupStatus(supabase, v.id);
        setNeedsOnboarding(Boolean(status.needsOnboarding));
      } catch (e) {
        console.warn('Unable to determine vendor onboarding status:', e);
      }

      // Parallel data fetching
      const vendorId = v.id;

      const [
        servicesRes,
        packagesRes,
        convRes,
        quotesAllRes,
        quotesReqRes,
        quotesNegRes,
        notifsRes,
      ] = await Promise.all([
        supabase.from('vendor_services').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('vendor_packages').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('vendor_id', vendorId),
        supabase.from('quotes').select('id, quote_ref, package_name, guest_count, hours, base_from_price, status, created_at, couple_id').eq('vendor_id', vendorId).eq('status', 'requested').order('created_at', { ascending: false }).limit(5),
        supabase.from('quotes').select('id, quote_ref, package_name, guest_count, hours, base_from_price, status, created_at, couple_id').eq('vendor_id', vendorId).eq('status', 'negotiating').order('created_at', { ascending: false }).limit(5),
        supabase.from('notifications').select('id, title, body, created_at, link').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);

      setServicesCount(servicesRes.count ?? 0);
      setPackagesCount(packagesRes.count ?? 0);

      setMetrics({
        profileViews: 0,        // No tracking table yet
        savedByCouples: 0,      // No tracking table yet
        chatsStarted: convRes.count ?? 0,
        quotesReceived: quotesAllRes.count ?? 0,
      });

      // Add couple names to quotes
      const addCoupleNames = async (rows: any[]): Promise<Quote[]> => {
        return Promise.all((rows || []).map(async (q: any) => {
          // Prefer couples table which holds partner_name + avatar_url
          const { data: c } = await supabase.from('couples').select('partner_name, avatar_url').eq('id', q.couple_id).maybeSingle();
          if (c && (c.partner_name || c.avatar_url)) {
            return { ...q, couple_name: c.partner_name || 'Couple', couple_avatar: c.avatar_url || null } as Quote;
          }
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', q.couple_id).maybeSingle();
          return { ...q, couple_name: p?.full_name || 'Couple', couple_avatar: null } as Quote;
        }));
      };

      const [reqWithNames, negWithNames] = await Promise.all([
        addCoupleNames(quotesReqRes.data || []),
        addCoupleNames(quotesNegRes.data || []),
      ]);
      setQuoteRequests(reqWithNames);
      setNegotiations(negWithNames);

      setRecentNotifications((notifsRes.data as any[]) || []);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Conversation helper for quote cards ────────────────────── */

  const getConversationForQuote = async (quoteId: string, coupleId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: existing } = await supabase.from('conversations').select('id').eq('couple_id', coupleId).eq('vendor_id', vendor?.id || user.id).maybeSingle();
      if (existing?.id) return existing.id;

      const { data: newConv, error: convError } = await supabase.from('conversations').insert({ couple_id: coupleId, vendor_id: vendor?.id || user.id }).select('id').single();
      if (convError) {
        if (convError.code === '23505') {
          const { data: retry } = await supabase.from('conversations').select('id').eq('couple_id', coupleId).eq('vendor_id', vendor?.id || user.id).maybeSingle();
          return retry?.id ?? null;
        }
        console.error('Error creating conversation for quote:', convError);
        return null;
      }
      return newConv.id;
    } catch (err) {
      console.error('Error finding/creating conversation:', err);
      return null;
    }
  };


  // Profile completion logic (5 items)
  const profileChecks = vendor ? {
    businessInfo: !!vendor.business_name && !!vendor.category && !!vendor.location && !!vendor.description,
    services: servicesCount > 0,
    packages: packagesCount > 0,
    portfolio: Array.isArray(vendor.portfolio_urls) && vendor.portfolio_urls.length > 0,
    contact: !!(vendor.contact?.whatsapp || vendor.contact?.phone),
  } : null;

  const completedSteps = profileChecks ? Object.values(profileChecks).filter(Boolean).length : 0;
  const totalSteps = profileChecks ? Object.keys(profileChecks).length : 5;
  const percentComplete = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const profileComplete = completedSteps === totalSteps;

  /* ── Share profile helper ────────────────────────────────────── */
  const handleShareProfile = async () => {
    if (!vendor?.id) return;
    const profileUrl = `${window.location.origin}/marketplace/vendor/${vendor.id}`;
    const shareText = `Check out our business on uMshado: ${profileUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'uMshado Vendor Profile', text: shareText, url: profileUrl }); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(shareText); alert('Profile link copied to clipboard!'); } catch { /* ignore */ }
    }
  };

  /* ── Stats config ───────────────────────────────────────────── */

  const stats = [
    {
      label: 'Profile Views',
      value: metrics.profileViews,
      sub: metrics.profileViews === 0 ? 'Coming soon' : undefined,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>),
      color: 'blue',
    },
    {
      label: 'Saved by Couples',
      value: metrics.savedByCouples,
      sub: metrics.savedByCouples === 0 ? 'Coming soon' : undefined,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>),
      color: 'pink',
    },
    {
      label: 'Chats Started',
      value: metrics.chatsStarted,
      sub: metrics.chatsStarted === 0 ? 'No chats yet' : undefined,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>),
      color: 'green',
    },
    {
      label: 'Quotes Received',
      value: metrics.quotesReceived,
      sub: metrics.quotesReceived === 0 ? 'No quotes yet' : undefined,
      icon: (<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>),
      color: 'purple',
    },
  ];

  const getStatColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600',
      pink: 'bg-pink-50 text-pink-600',
      green: 'bg-green-50 text-green-600',
      purple: 'bg-purple-50 text-purple-600',
    };
    return colors[color] || colors.blue;
  };

  /* ── Loading state ──────────────────────────────────────────── */

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
      <div className="w-full mx-auto min-h-screen flex flex-col px-4 sm:px-6 lg:max-w-7xl min-w-0 overflow-x-hidden">
        {/* Header / Hero */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">

            {/* LEFT BLOCK: logo + title/subtitle */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {vendor?.logo_url ? (
                <button
                  type="button"
                  onClick={() => { setLogoSrc(vendor.logo_url ?? null); setLogoAlt(vendor.business_name || 'Logo'); setLogoOpen(true); }}
                  className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2 border-purple-200 flex items-center justify-center"
                  aria-label="View business logo"
                >
                  <img src={vendor.logo_url} alt="" className="w-full h-full object-contain p-2" />
                </button>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">
                    {(vendor?.business_name || 'V').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 truncate">{vendor?.business_name || 'Your vendor hub'}</h1>
                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2 sm:line-clamp-1">Your business hub — insights & activity</p>
              </div>
            </div>

            {/* RIGHT BLOCK: actions (grid -> becomes row on sm) */}
            <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 w-full sm:w-auto sm:flex sm:items-center">
              <div className="flex items-center gap-2">
                {vendor?.is_published && (
                  <span title="Published" className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold border border-green-100">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                    Live
                  </span>
                )}
              </div>

              <div className="flex items-center">
                <Link href="/vendor/profile/edit" className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-gray-200 whitespace-nowrap">Edit Profile</Link>
              </div>

              <div className="flex items-center">
                <button onClick={handleShareProfile} className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#7B1E3A] text-white text-sm font-semibold hover:brightness-110 transition whitespace-nowrap">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v13"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4 4 4"/></svg>
                  Share Profile
                </button>
              </div>

              <div className="flex items-center justify-end">
                <div className="relative">
                  <button
                    aria-label="Vendor menu"
                    onClick={() => setShowMenu(prev => !prev)}
                    className="ml-2 w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                  >
                    <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01"/></svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                      <button
                        onClick={async () => {
                          const ok = confirm('Log out from vendor account?');
                          if (!ok) return;
                          try {
                            const { error } = await supabase.auth.signOut();
                            if (error) console.error('Sign out error:', error);
                          } catch (err) {
                            console.error('Sign out failed:', err);
                          }
                          router.push('/auth/sign-in');
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-2 text-sm text-gray-700"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7"/></svg>
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
          <div className="flex-1 px-4 py-5 space-y-6 overflow-y-auto pb-24">

          {/* ── Profile Completion / Publish state ─────────────── */}
          {/* Show finish setup only when in wizard mode (not published and not onboarding_completed) */}
          {(!vendor?.is_published && !(vendor as any)?.onboarding_completed) && !profileComplete ? (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl px-4 py-5 text-white shadow-lg">
              <h2 className="text-lg font-bold mb-1">Profile Completion</h2>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-amber-100">{percentComplete}% complete</span>
                <span className="text-xs text-amber-200">{completedSteps} of {totalSteps} steps</span>
              </div>
              <div className="w-full bg-white/30 rounded-full h-2 mb-4">
                <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${percentComplete}%` }} />
              </div>
              <ul className="space-y-2 text-sm">
                {!profileChecks?.businessInfo && (<li><Link href="/vendor/onboarding" className="underline hover:text-white">Business info</Link> <span className="ml-1 text-amber-200">(name, category, location, description)</span></li>)}
                {!profileChecks?.services && (<li><Link href="/vendor/services" className="underline hover:text-white">Select at least 1 service</Link></li>)}
                {!profileChecks?.packages && (<li><Link href="/vendor/packages" className="underline hover:text-white">Create at least 1 package</Link></li>)}
                {!profileChecks?.portfolio && (<li><Link href="/vendor/media" className="underline hover:text-white">Upload at least 1 portfolio image</Link></li>)}
                {!profileChecks?.contact && (<li><Link href="/vendor/media" className="underline hover:text-white">Add contact details</Link> <span className="ml-1 text-amber-200">(phone or WhatsApp)</span></li>)}
              </ul>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl px-4 py-5 text-white shadow-lg">
              <h2 className="text-lg font-bold mb-1">Profile complete! ✅</h2>
              <p className="text-sm text-green-100 mb-3">You&apos;re ready to go live. Publish your profile to appear on the marketplace.</p>
              <Link href="/vendor/review" className="inline-block px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors">Review &amp; Publish →</Link>
            </div>
          )}

          {vendor?.is_published && (
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl px-4 py-5 text-white shadow-lg">
              <h2 className="text-lg font-bold mb-1">You&apos;re live! 🎉</h2>
              <p className="text-sm text-purple-100">Couples can discover and contact you for their special day.</p>
            </div>
          )}

          {/* ── Stats Cards ───────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Your Performance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 space-y-2 hover:shadow-md transition-shadow flex items-start">
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-12 h-12 rounded-full bg-[#F7F0EA] text-[#7B1E3A] flex items-center justify-center border border-[#fdeee8]">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-gray-900">{stat.value ?? 0}</p>
                    <p className="text-xs font-semibold text-gray-600">{stat.label}</p>
                    {stat.sub && <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Quote Requests ────────────────────────────────── */}
          {quoteRequests.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Quote Requests</h2>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">{quoteRequests.length} new</span>
              </div>
              <div className="space-y-2.5">
                {quoteRequests.map((quote) => (
                  <div key={quote.id} className="bg-white rounded-xl border-2 border-purple-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-mono text-purple-600 font-semibold">{quote.quote_ref}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {quote.couple_avatar ? (
                            <img src={quote.couple_avatar} alt={quote.couple_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {String(quote.couple_name || 'C').split(' ').map(s => s.charAt(0)).slice(0,2).join('').toUpperCase()}
                            </div>
                          )}
                          <p className="text-sm font-bold text-gray-900">{quote.couple_name}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-md">Pending</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-gray-700"><span className="font-medium">Package:</span> {quote.package_name}</p>
                      {quote.guest_count > 0 && <p className="text-sm text-gray-700"><span className="font-medium">Guests:</span> {quote.guest_count}</p>}
                      {quote.hours > 0 && <p className="text-sm text-gray-700"><span className="font-medium">Hours:</span> {quote.hours}</p>}
                      <p className="text-sm font-semibold text-purple-600">Est. Total: R{Number(quote.base_from_price).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const convId = await getConversationForQuote(quote.id, quote.couple_id);
                        if (convId) window.location.href = `/messages/thread/${convId}`;
                      }}
                      className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      Open Chat
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">{new Date(quote.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Negotiations ──────────────────────────────────── */}
          {negotiations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900">Negotiations</h2>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{negotiations.length} active</span>
              </div>
              <div className="space-y-2.5">
                {negotiations.map((quote) => (
                  <div key={quote.id} className="bg-white rounded-xl border-2 border-blue-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs font-mono text-blue-600 font-semibold">{quote.quote_ref}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {quote.couple_avatar ? (
                            <img src={quote.couple_avatar} alt={quote.couple_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                              {String(quote.couple_name || 'C').split(' ').map(s => s.charAt(0)).slice(0,2).join('').toUpperCase()}
                            </div>
                          )}
                          <p className="text-sm font-bold text-gray-900">{quote.couple_name}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md">Negotiating</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-gray-700"><span className="font-medium">Package:</span> {quote.package_name}</p>
                      {quote.guest_count > 0 && <p className="text-sm text-gray-700"><span className="font-medium">Guests:</span> {quote.guest_count}</p>}
                      {quote.hours > 0 && <p className="text-sm text-gray-700"><span className="font-medium">Hours:</span> {quote.hours}</p>}
                      <p className="text-sm font-semibold text-blue-600">Est. Total: R{Number(quote.base_from_price).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const convId = await getConversationForQuote(quote.id, quote.couple_id);
                        if (convId) window.location.href = `/messages/thread/${convId}`;
                      }}
                      className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      Open Chat
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-2">{new Date(quote.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Activity (from notifications) ──────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
              {recentNotifications.length > 0 && (
                <Link href="/notifications" className="text-sm font-medium text-purple-600 hover:text-purple-700">View all</Link>
              )}
            </div>
            {recentNotifications.length > 0 ? (
              <div className="bg-white rounded-xl border-2 border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {recentNotifications.map((n) => (
                  <div key={n.id} className="px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 text-purple-600">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 font-medium leading-tight">{n.title}</p>
                        {n.body && <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{n.body}</p>}
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border-2 border-gray-200 p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-700">No activity yet</p>
                <p className="text-xs text-gray-500 mt-1">When couples view, save, chat, or request quotes, you&apos;ll see it here.</p>
              </div>
            )}
          </div>

          {/* ── Quick Actions ─────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
            <div className="space-y-2.5">
              {needsOnboarding && (
                <Link
                  href="/vendor/services?mode=onboarding"
                  className="w-full px-4 py-3.5 bg-yellow-50 border-2 border-yellow-200 text-yellow-900 rounded-xl font-semibold text-base text-left hover:bg-yellow-100 hover:border-yellow-300 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-800">⚠️</div>
                    <span>Complete onboarding</span>
                  </div>
                  <svg className="w-5 h-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              )}
              {vendor?.is_published && (
                <Link
                  href={`/marketplace/vendor/${vendor.id}?preview=1`}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-base text-left hover:bg-gray-50 hover:border-purple-300 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span>View Public Profile</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              )}

              {vendor?.is_published && (
                <button
                  onClick={handleShareProfile}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-base text-left hover:bg-gray-50 hover:border-purple-300 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </div>
                    <span>Share Profile</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              )}

              <Link
                href="/vendor/packages"
                className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-base text-left hover:bg-gray-50 hover:border-purple-300 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  </div>
                  <span>Edit Packages</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>

              <Link
                href="/vendor/media"
                className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-base text-left hover:bg-gray-50 hover:border-purple-300 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <span>Edit Media &amp; Contact</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>

              <Link
                href="/vendor/services"
                className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-base text-left hover:bg-gray-50 hover:border-purple-300 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <span>Edit Services</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
          </div>

          {/* ── Help Card ─────────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Need help?</p>
                <p className="text-xs text-blue-700 mt-1">Check our vendor guide for tips on attracting more couples and growing your business.</p>
              </div>
            </div>
          </div>
        </div>

        <VendorBottomNav />
      </div>
    </div>
  );
}
