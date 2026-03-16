'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackVendorEvent } from '@/lib/analytics';
import { useAuthRole } from '@/app/providers/AuthRoleProvider';

/* ------------------------------------------------------------------ */
/*  Vendor type ΓÇô minimal fields from the vendors table                */
/* ------------------------------------------------------------------ */

interface VendorInfo {
  id: string;          // vendors.id which IS auth.users(id)
  name: string;        // business_name
  category: string;
  location: string;
}

/* ------------------------------------------------------------------ */
/*  UUID validator                                                     */
/* ------------------------------------------------------------------ */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;

/* ------------------------------------------------------------------ */
/*  Inner content (needs Suspense for useSearchParams)                 */
/* ------------------------------------------------------------------ */

function StartChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuthRole();
  const vendorId = searchParams.get('vendorId');            // vendors.id (= auth uid of vendor)
  const prefillMessage = searchParams.get('message') || '';

  const [message, setMessage] = useState('');

  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [vendorLoading, setVendorLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Pre-fill message from query string
  useEffect(() => { if (prefillMessage) setMessage(prefillMessage); }, [prefillMessage]);

  /* ΓöÇΓöÇ Fetch vendor info & redirect if conversation already exists ΓöÇΓöÇ */
  useEffect(() => {
    (async () => {
      setVendorLoading(true);

      // 1. Validate vendorId is a proper UUID
      if (!vendorId || !UUID_RE.test(vendorId)) {
        setVendor(null);
        setVendorLoading(false);
        return;
      }

      // 2. Must be logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVendor(null);
        setVendorLoading(false);
        return;
      }

      // 3. Block vendors from messaging other vendors
      if (role === 'vendor') {
        alert('Vendors cannot message other vendors. Only couples can request quotes and start conversations with vendors.');
        router.replace('/marketplace');
        return;
      }

      // 4. Look up vendor by id (vendors.id = auth user id)
      const { data, error } = await supabase
        .from('vendors')
        .select('id, business_name, category, location')
        .eq('id', vendorId)
        .maybeSingle();

      if (error || !data) {
        console.error('Vendor not found:', vendorId, error);
        setVendor(null);
        setVendorLoading(false);
        return;
      }

      setVendor({
        id: data.id,
        name: data.business_name || 'Vendor',
        category: data.category || '',
        location: data.location || '',
      });

      // 5. If a conversation already exists, skip straight to it
      //    (unless user has a prefilled message they want to compose)
      if (!prefillMessage) {
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('couple_id', user.id)
          .eq('vendor_id', data.id)
          .maybeSingle();

        if (existing?.id) {
          router.replace(`/messages/thread/${existing.id}`);
          return;
        }
      }

      setVendorLoading(false);
    })();
  }, [vendorId, role, router, prefillMessage]);

  /* ΓöÇΓöÇ Start chat / find-or-create conversation ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  const handleStartChat = async () => {
    if (!vendor || sending) return;
    setSending(true);

    try {
      // 1. Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert('Please sign in to start a chat.'); return; }

      // 2. Prevent self-chat
      if (vendor.id === user.id) {
        alert('You cannot start a chat with your own vendor profile.');
        return;
      }

      // 3. Find existing conversation between this couple and this vendor
      //    couple_id = current user (couple), vendor_id = vendor's auth id
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('couple_id', user.id)
        .eq('vendor_id', vendor.id)
        .maybeSingle();

      let conversationId = existing?.id;

      // 4. If none exists, create one
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ couple_id: user.id, vendor_id: vendor.id })
          .select('id')
          .single();

        if (convError) {
          // Race-condition: unique constraint conflict ΓåÆ fetch again
          if (convError.code === '23505') {
            const { data: retry } = await supabase
              .from('conversations')
              .select('id')
              .eq('couple_id', user.id)
              .eq('vendor_id', vendor.id)
              .maybeSingle();
            conversationId = retry?.id;
          }
          // FK violation: vendor auth user doesn't exist yet
          if (convError.code === '23503') {
            console.error('Error creating conversation:', convError);
            alert('This vendor hasn\'t completed their account setup yet and cannot receive messages. Please try again later or contact support.');
            return;
          }
          if (!conversationId) {
            console.error('Error creating conversation:', convError);
            alert('Failed to start chat. Please try again.');
            return;
          }
        } else {
          conversationId = newConv.id;
        }

        // Track event
        trackVendorEvent(vendor.id, 'message_started', {
          source: 'messages_new',
          conversation_id: conversationId,
        });
      }

      // 5. Send first message if provided
      if (message.trim()) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_id: user.id,
          message_text: message.trim(),
          read: false,
        });

        // Update last_message_at
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      // 6. Navigate to the thread
      router.push(`/messages/thread/${conversationId}`);
    } catch (err) {
      console.error('Unexpected error starting chat:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  /* ΓöÇΓöÇ Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-20 pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-5 sticky top-0 z-10">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-3 -ml-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Message Vendor</h1>
          <p className="text-sm text-gray-600 mt-1.5">
            {vendor ? `Start a conversation with ${vendor.name}` : vendorLoading ? 'Loading…' : 'Vendor not found'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {/* Vendor Preview Card */}
          {vendorLoading ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vendor ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
              <h2 className="text-base font-bold text-gray-900">{vendor.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{vendor.category}</p>
              {vendor.location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span>{vendor.location}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              Vendor not found. Please go back and try again.
            </div>
          )}

          {/* Helper Text */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <p className="text-xs text-blue-700 leading-relaxed">Keep communication on uMshado to share files, contracts, and images. This helps protect both parties and keeps everything organized.</p>
            </div>
          </div>

          {/* First Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I'm interested in your services for my wedding. Can we discuss availability and pricing?"
              rows={6}
              className="w-full px-4 py-3.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-base placeholder:text-gray-400 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1.5">Start with a friendly introduction and mention your wedding date if you have one</p>
          </div>

        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40">
        <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 flex gap-3">
          {vendor ? (
            <Link href={`/v/${vendor.id}`} className="flex-1 px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors">
              Back to Profile
            </Link>
          ) : (
            <button onClick={() => router.back()} className="flex-1 px-4 py-3.5 border-2 border-gray-200 text-gray-400 rounded-xl font-semibold text-base text-center" disabled>Back</button>
          )}
          <button
            onClick={handleStartChat}
            disabled={!vendor || sending}
            className={`flex-1 px-4 py-3.5 rounded-xl font-semibold text-base text-center transition-all ${vendor && !sending ? 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-lg shadow-purple-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            {sending ? 'Starting…' : 'Start Chat'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page wrapper (Suspense for useSearchParams)                        */
/* ------------------------------------------------------------------ */

export default function StartChat() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <StartChatContent />
    </Suspense>
  );
}
