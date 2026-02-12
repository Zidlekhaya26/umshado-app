'use client';

import { useEffect, useState } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { UmshadoIcon } from '@/components/ui/UmshadoLogo';
import BottomNav from '@/components/BottomNav';
import VendorBottomNav from '@/components/VendorBottomNav';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConversationRow {
  id: string;
  couple_id: string;
  vendor_id: string;
  last_message_at: string | null;
  created_at: string;
}

interface ConversationItem {
  id: string;
  otherName: string;        // business_name (for couple view) or full_name (for vendor view)
  otherRole: 'vendor' | 'couple';
  logoUrl: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function MessagesIndex() {
  const router = useRouter();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string | undefined>(undefined);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setItems([]); return; }

      // Determine active role to filter conversations correctly
      const { data: profileData } = await supabase
        .from('profiles')
        .select('active_role')
        .eq('id', user.id)
        .maybeSingle();
      const activeRole = profileData?.active_role || 'couple';
      setIsVendor(activeRole === 'vendor');

      // If vendor, fetch vendor ID and publish status for CTAs
      let myVendorId: string | null = null;
      if (activeRole === 'vendor') {
        const { data: vRow } = await supabase
          .from('vendors')
          .select('id, is_published')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (vRow) {
          myVendorId = vRow.id;
          setVendorId(vRow.id);
          setIsPublished(vRow.is_published || false);
        }
      }

      // Filter conversations by role: couple sees couple_id matches, vendor sees vendor_id matches (use vendor row id)
      const roleFilter = activeRole === 'vendor'
        ? `vendor_id.eq.${myVendorId ?? user.id}`
        : `couple_id.eq.${user.id}`;

      // Fetch conversations the user participates in (based on their active role)
      const { data, error } = await supabase
        .from('conversations')
        .select('id, couple_id, vendor_id, last_message_at, created_at')
        .or(roleFilter)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Error loading conversations:', error);
        setItems([]);
        return;
      }

      const rows = (data || []) as ConversationRow[];

      // Resolve names + logos for each conversation
      const resolved = await Promise.all(
        rows.map(async (row) => {
          const iAmVendor = activeRole === 'vendor';

          // Fetch the last message preview
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('message_text')
            .eq('conversation_id', row.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (iAmVendor) {
            // I'm the vendor → resolve couple display using helper (prefer partner1 & partner2, then partner_name, then profile)
            try {
              const { getCoupleDisplayName } = await import('@/lib/coupleHelpers');
              const d = await getCoupleDisplayName(row.couple_id);
              return {
                id: row.id,
                otherName: d.displayName || 'Couple (unknown)',
                otherRole: 'couple' as const,
                logoUrl: d.avatarUrl || null,
                lastMessageAt: row.last_message_at || row.created_at,
                lastMessagePreview: lastMsg?.message_text || null,
              };
            } catch (err) {
              console.warn('Failed to resolve couple display name', err);
              return {
                id: row.id,
                otherName: 'Couple (unknown)',
                otherRole: 'couple' as const,
                logoUrl: null,
                lastMessageAt: row.last_message_at || row.created_at,
                lastMessagePreview: lastMsg?.message_text || null,
              };
            }
          }

          // I'm the couple → try marketplace view first (public), fallback to vendors table
          const { data: mv } = await supabase
            .from('marketplace_vendors')
            .select('business_name, logo_url')
            .eq('vendor_id', row.vendor_id)
            .maybeSingle();

          if (mv && (mv.business_name || mv.logo_url)) {
            return {
              id: row.id,
              otherName: mv.business_name || 'Vendor',
              otherRole: 'vendor' as const,
              logoUrl: mv.logo_url || null,
              lastMessageAt: row.last_message_at || row.created_at,
              lastMessagePreview: lastMsg?.message_text || null,
            };
          }

          const { data: vendorData } = await supabase
            .from('vendors')
            .select('business_name, logo_url')
            .eq('id', row.vendor_id)
            .maybeSingle();

          return {
            id: row.id,
            otherName: vendorData?.business_name || 'Vendor',
            otherRole: 'vendor' as const,
            logoUrl: vendorData?.logo_url || null,
            lastMessageAt: row.last_message_at || row.created_at,
            lastMessagePreview: lastMsg?.message_text || null,
          };
        })
      );

      setItems(resolved);
    } catch (err) {
      console.error('Unexpected error loading conversations:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Realtime: keep conversation list in sync for incoming updates/creates
  useEffect(() => {
    let convChannelA: any = null;
    let convChannelB: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Listen for conversation INSERT/UPDATE where couple_id == user.id
      convChannelA = supabase
        .channel(`conversations_user_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `couple_id=eq.${user.id}` }, () => {
          loadConversations();
        })
        .subscribe();

      // If vendor, also listen for vendor_id changes (use vendorId state if available)
      const vid = vendorId;
      if (vid) {
        convChannelB = supabase
          .channel(`conversations_vendor_${vid}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `vendor_id=eq.${vid}` }, () => {
            loadConversations();
          })
          .subscribe();
      }
    })();

    return () => {
      if (convChannelA) supabase.removeChannel(convChannelA);
      if (convChannelB) supabase.removeChannel(convChannelB);
    };
  }, [vendorId]);

  /* ── Time-ago helper ────────────────────────────────────────────── */
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' });
  };

  /* ── Share profile helper ──────────────────────────────────────── */
  const handleShareProfile = async () => {
    if (!vendorId) return;
    const profileUrl = `${window.location.origin}/marketplace/vendor/${vendorId}`;
    const shareText = `Check out our business on uMshado: ${profileUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'uMshado Vendor Profile', text: shareText, url: profileUrl }); } catch { /* user cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(shareText); alert('Profile link copied to clipboard!'); } catch { /* ignore */ }
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-screen-xl mx-auto min-h-screen flex flex-col pb-24 px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <div className="flex items-center gap-3">
            <UmshadoIcon size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Messages</h1>
              <p className="text-sm text-gray-600 mt-0.5">Your conversations</p>
            </div>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">No conversations yet</h3>
              {isVendor ? (
                <>
                  <p className="text-sm text-gray-600 mb-6">Couples will contact you here after viewing your profile or requesting a quote.</p>
                  <div className="flex flex-col gap-2.5 max-w-[220px] mx-auto">
                    {isPublished && vendorId && (
                      <button
                        onClick={handleShareProfile}
                        className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        Share Profile
                      </button>
                    )}
                    {isPublished && vendorId && (
                      <Link href={`/marketplace/vendor/${vendorId}?preview=1`} className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-900 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors text-center">
                        View Public Profile
                      </Link>
                    )}
                    {!isPublished && (
                      <Link href="/vendor/review" className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-md text-center">
                        Complete &amp; Publish Profile
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-6">Browse vendors and start chatting!</p>
                  <Link href="/marketplace" className="inline-block px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-md">
                    Browse Vendors
                  </Link>
                </>
              )}
            </div>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => router.push(`/messages/thread/${item.id}`)}
              className="w-full text-left rounded-xl border-2 border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              {/* Avatar / Logo */}
              <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                {item.logoUrl ? (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLogoSrc(item.logoUrl ?? null); setLogoAlt(item.otherName || 'Logo'); setLogoOpen(true); }}
                    className="w-full h-full flex items-center justify-center"
                    aria-label={`View ${item.otherName} logo`}
                  >
                    <img src={item.logoUrl} alt="" className="w-full h-full object-contain p-2" />
                  </button>
                ) : (
                  <span className="text-white font-bold text-lg">
                    {item.otherName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.otherName}</p>
                  <span className="text-xs text-gray-500 flex-shrink-0">{timeAgo(item.lastMessageAt)}</span>
                </div>
                {item.lastMessagePreview && (
                  <p className="text-xs text-gray-500 mt-1 truncate">{item.lastMessagePreview}</p>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Bottom CTA (role-aware) */}
        {!loading && items.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-4">
            {isVendor ? (
              isPublished && vendorId ? (
                <button
                  onClick={handleShareProfile}
                  className="block w-full px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-base text-center hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share Profile
                </button>
              ) : null
            ) : (
              <Link href="/marketplace" className="block w-full px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-base text-center hover:bg-purple-700 transition-colors shadow-md">
                Browse Vendors
              </Link>
            )}
          </div>
        )}
      </div>

      {isVendor ? <VendorBottomNav /> : <BottomNav />}
    </div>
  );
}
