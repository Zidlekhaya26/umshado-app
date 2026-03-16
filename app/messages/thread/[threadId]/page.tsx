'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';
import { trackVendorEvent } from '@/lib/analytics';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface MessageAttachment { id: string; file_path: string; file_name: string; mime_type: string | null; file_size: number | null; signed_url?: string; }
interface Message { id: string; sender_id: string; message_text: string; created_at: string; attachments?: MessageAttachment[]; _optimistic?: boolean; }
interface Conversation { id: string; couple_id: string; vendor_id: string; }
interface Quote { id: string; quote_ref: string; status: 'requested'|'negotiating'|'accepted'|'declined'|'expired'|'booked'; vendor_final_price: number|null; vendor_message: string|null; couple_id: string; vendor_id: string; created_at: string; add_ons?: any[]; package_name?: string|null; base_from_price?: number|null; guest_count?: number|null; hours?: number|null; }

/* ─── Helpers ────────────────────────────────────────────────────────── */
const C = {
  crimson: '#9A2143', crimsonDark: '#731832', crimsonDim: 'rgba(154,33,67,0.1)',
  gold: '#BD983F', goldDim: 'rgba(189,152,63,0.1)',
  dark: '#1a0d12', bg: '#faf8f5', card: '#fff',
  border: '#f0ebe4', muted: '#7a5060', text: '#2d1a22',
  myBubble: '#9A2143', myText: '#fff',
  theirBubble: '#fff', theirText: '#2d1a22', theirBorder: '#eedbd3',
};

/* Avatar */
function Avatar({ name, url, size = 44, showOnline = false }: { name: string; url: string|null; size?: number; showOnline?: boolean; }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.crimsonDim}`, position: 'relative' }}>
        {url ? <Image src={url} alt={name} fill style={{ objectFit: 'cover' }} /> : <span style={{ color: '#fff', fontWeight: 800, fontSize: size * 0.33, fontFamily: 'Georgia, serif' }}>{initials}</span>}
      </div>
      {showOnline && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />}
    </div>
  );
}

/* Typing Dots */
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 10px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.muted, animation: `typingBounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </div>
  );
}

const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
const formatDate = (ts: string) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
};

const insertDateSeparators = (msgs: Message[]) => {
  const result: any[] = [];
  let lastDate = '';
  msgs.forEach((msg, idx) => {
    const d = formatDate(msg.created_at);
    if (d !== lastDate) { result.push({ type: 'date-separator', date: d, key: `sep-${idx}` }); lastDate = d; }
    result.push({ type: 'message', msg, key: msg.id });
  });
  return result;
};

const getQuoteStatusColor = (status: string) => {
  switch (status) {
    case 'requested': return '#3b82f6';
    case 'negotiating': return C.gold;
    case 'accepted': return '#22c55e';
    case 'booked':   return '#22c55e';
    case 'declined': return '#ef4444';
    case 'expired': return '#9ca3af';
    default: return C.muted;
  }
};

/* ─── Main ───────────────────────────────────────────────────────────── */
export default function ChatThread() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.threadId as string | undefined;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const PAGE_SIZE = 50;
  const [otherPartyName, setOtherPartyName] = useState('');
  const [otherPartyLogo, setOtherPartyLogo] = useState<string | null>(null);
  const [otherPartyLocation, setOtherPartyLocation] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const userScrolledUpRef = useRef(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);
  const [isVendorInThread, setIsVendorInThread] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [finalMessage, setFinalMessage] = useState('');
  const { format } = useCurrency();

  /* ── Get current user ───────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    })();
  }, []);

  /* ── Load conversation + resolve other party identity ────────── */
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    (async () => {
      // 1. Fetch conversation row
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select('id, couple_id, vendor_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (convErr || !conv) {
        console.error('Error/missing conversation:', convErr);
        return;
      }

      setConversation(conv);

      // 2. Determine who the "other" person is
      // Conversations store `vendor_id` as the vendor row id (not auth user id) in many deployments.
      // Resolve whether the current user is the vendor by looking up their vendor row.
      let iAmVendor = false;
      try {
        if (currentUserId) {
          const { data: myVendor } = await supabase
            .from('vendors')
            .select('id, user_id')
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (myVendor && myVendor.id) {
            iAmVendor = myVendor.id === conv.vendor_id;
          } else {
            // fallback: some conversations use auth uid directly for vendor_id
            iAmVendor = conv.vendor_id === currentUserId;
          }
        }
      } catch (err) {
        console.warn('Could not resolve vendor identity for current user', err);
        iAmVendor = conv.vendor_id === currentUserId;
      }

      setIsVendorInThread(iAmVendor);

      if (iAmVendor) {
        // Prefer the public `couples` table (partner1/partner2, partner_name, avatar) via helper
          try {
            const { getCoupleDisplayName } = await import('@/lib/coupleHelpers');
            const d = await getCoupleDisplayName(conv.couple_id);
            setOtherPartyName(d.displayName || 'Couple (unknown)');
            setOtherPartyLogo(d.avatarUrl || null);
            setOtherPartyLocation(d.location || null);
          } catch (err) {
            console.warn('Failed to resolve couple display name', err);
            setOtherPartyName('Couple (unknown)');
            setOtherPartyLogo(null);
            setOtherPartyLocation(null);
          }
      } else {
        // Show vendor's business name + logo
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('business_name, logo_url')
          .eq('id', conv.vendor_id)
          .maybeSingle();
        setOtherPartyName(vendorData?.business_name || 'Vendor');
        setOtherPartyLogo(vendorData?.logo_url || null);
      }
    })();
  }, [conversationId, currentUserId]);

  /* ── Load quote associated with this conversation ───────────── */
  useEffect(() => {
    if (!conversation) return;
    (async () => {
      const { data } = await supabase
        .from('quotes')
        .select('id, quote_ref, status, vendor_final_price, vendor_message, couple_id, vendor_id, created_at, add_ons, package_name, base_from_price, guest_count, hours')
        .eq('couple_id', conversation.couple_id)
        .eq('vendor_id', conversation.vendor_id)
        .in('status', ['requested', 'negotiating', 'accepted', 'declined', 'expired', 'booked'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setQuote(data || null);
    })();
  }, [conversation]);

  /* ── Load messages + realtime subscription ──────────────────── */
  useEffect(() => {
    if (!conversationId) return;

    let mounted = true;

    const loadInitial = async () => {
      try {
        // Load newest messages first (descending), limit to PAGE_SIZE for performance
        const { data: raw } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        const newestFirst = raw || [];
        const oldest = newestFirst.length > 0 ? newestFirst[newestFirst.length - 1].created_at : null;

        const withAttachments = await Promise.all(
          newestFirst.reverse().map(async (msg) => {
            const { data: atts } = await supabase
              .from('message_attachments')
              .select('*')
              .eq('message_id', msg.id);

            const signed = await Promise.all(
              (atts || []).map(async (att) => {
                try {
                  const { data: s } = await supabase.storage.from('umshado-files').createSignedUrl(att.file_path, 3600);
                  return { ...att, signed_url: s?.signedUrl };
                } catch { return att; }
              })
            );

            return { ...msg, attachments: signed } as Message;
          })
        );

        if (!mounted) return;
        setMessages(withAttachments);
        setOldestTimestamp(oldest);
        setHasMoreOlder((newestFirst || []).length === PAGE_SIZE);
      } catch (err) {
        console.error('Failed to load initial messages:', err);
      }
    };

    loadInitial();

    // Realtime: append new messages only (skip if _optimistic flag is set to avoid duplicates)
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        try {
          const { data: atts } = await supabase.from('message_attachments').select('*').eq('message_id', payload.new.id);
          const signed = await Promise.all(
            (atts || []).map(async (att) => {
              const { data: s } = await supabase.storage.from('umshado-files').createSignedUrl(att.file_path, 3600);
              return { ...att, signed_url: s?.signedUrl };
            })
          );
          
          const newMsg = { ...(payload.new as Message), attachments: signed };
          
          setMessages((prev) => {
            // Avoid duplicate if we already have this message with exact same ID
            if (prev.some(m => m.id === newMsg.id)) return prev;
            
            // Check if this is a real message matching a recent optimistic message
            // (same sender, text, and within 10 seconds - indicates optimistic -> real transition)
            const matchingOptimistic = prev.find(m => 
              m._optimistic && 
              m.sender_id === newMsg.sender_id &&
              m.message_text === newMsg.message_text &&
              Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000
            );
            
            if (matchingOptimistic) {
              // Replace the optimistic message with the real one
              return prev.map(m => m.id === matchingOptimistic.id ? newMsg : m);
            }
            
            // If user scrolled up, increment badge counter (use ref to avoid stale closure)
            if (userScrolledUpRef.current && newMsg.sender_id !== currentUserId) {
              setNewMessagesCount(c => c + 1);
            }
            
            return [...prev, newMsg];
          });
        } catch (e) { console.warn('Realtime message handling error', e); }
      })
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]); // Removed userScrolledUp from deps to prevent re-subscription on scroll

  /* ── Presence channel for typing indicator and online status ─── */
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const presenceChannel = supabase.channel(`presence:${conversationId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const otherUsers = Object.keys(state).filter(k => k !== currentUserId);
        setOtherUserOnline(otherUsers.length > 0);
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (key !== currentUserId) setOtherUserOnline(true);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key !== currentUserId) {
          const state = presenceChannel.presenceState();
          const otherUsers = Object.keys(state).filter(k => k !== currentUserId);
          setOtherUserOnline(otherUsers.length > 0);
          setOtherUserTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [conversationId, currentUserId]);

  /* ── Broadcast channel for typing events ───────────────────── */
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`);

    typingChannel
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload?.userId !== currentUserId) {
          setOtherUserTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 3000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(typingChannel); };
  }, [conversationId, currentUserId]);

  /* ── Broadcast typing events when user types ────────────────── */
  const broadcastTyping = useCallback(() => {
    if (!conversationId || !currentUserId) return;
    supabase.channel(`typing:${conversationId}`).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId },
    });
  }, [conversationId, currentUserId]);

  /* ── Smart auto-scroll: only scroll if near bottom or own message ── */
  useEffect(() => {
    if (messages.length === 0) return;
    
    const container = messagesContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    const lastMessage = messages[messages.length - 1];
    const isMyMessage = lastMessage?.sender_id === currentUserId;
    
    // Auto-scroll if: near bottom OR it's my own message
    if (isNearBottom || isMyMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUserScrolledUp(false);
      userScrolledUpRef.current = false;
      setNewMessagesCount(0);
    }
  }, [messages, currentUserId]);

  /* ── Track scroll position ──────────────────────────────────── */
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    const scrolledUp = !isNearBottom;
    setUserScrolledUp(scrolledUp);
    userScrolledUpRef.current = scrolledUp; // Keep ref in sync
    
    if (isNearBottom) {
      setNewMessagesCount(0);
    }
  }, []);

  /* ── Realtime: listen for quote updates for this conversation/thread ── */
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`quotes-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `thread_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;

          setQuote((prev: any) => {
            if (!prev) return next;
            if (prev.id === next.id) return { ...prev, ...next };
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  /* ── Send message (via API route for server-side notifications) ── */
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId || isSending) return;

    setIsSending(true);
    const tempId = `optimistic-${Date.now()}`;
    const messageText = newMessage.trim();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { alert('You must be signed in to send messages.'); return; }

      // Optimistic message: show immediately with _optimistic flag
      const optimisticMessage: Message = {
        id: tempId,
        sender_id: session.user.id,
        message_text: messageText,
        created_at: new Date().toISOString(),
        attachments: [],
        _optimistic: true,
      };
      
      setMessages((prev) => [...prev, optimisticMessage]);
      setNewMessage('');

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId,
          messageText,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setNewMessage(messageText);
        alert('Failed to send message: ' + (err.error || 'Unknown error'));
        return;
      }

      // Replace optimistic message with real one
      const json = await res.json().catch(() => ({ success: true }));
      const realMessageId = json.messageId;
      
      if (realMessageId) {
        setMessages(prev => prev.map(m => 
          m.id === tempId 
            ? { ...m, id: realMessageId, _optimistic: false }
            : m
        ));
      }
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Enhanced send: upload pending attachments first (if any), sending each as its own message via API,
  // then send the text message (if present). This preserves notification behavior from /api/messages/send.
  const handleSend = async () => {
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !conversationId || isSending) return;
    setIsSending(true);
    setIsUploading(true);
    setUploadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { alert('You must be signed in to send messages.'); return; }

      // 1) Upload and send attachments (each as its own message to keep existing behavior)
      for (const file of pendingAttachments) {
        try {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
          if (!allowedTypes.includes(file.type)) { alert(`File type not allowed: ${file.type}`); continue; }
          if (file.size > 10 * 1024 * 1024) { alert(`File too large: ${file.name}. Max 10 MB.`); continue; }

          const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const filePath = `threads/${conversationId}/${Date.now()}-${sanitized}`;

          const { error: uploadErr } = await supabase.storage.from('umshado-files').upload(filePath, file, { cacheControl: '3600', upsert: false });
          if (uploadErr) { alert(`Failed to upload ${file.name}.`); continue; }

          // Call server API to insert message + notify recipient
          const attachRes = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ conversationId, messageText: `Attachment: ${file.name}` }),
          });

          if (!attachRes.ok) {
            const e = await attachRes.json().catch(() => ({}));
            // cleanup uploaded file
            await supabase.storage.from('umshado-files').remove([filePath]);
            console.warn('Failed to create attachment message:', e);
            continue;
          }

          const attachResult = await attachRes.json();
          const messageId = attachResult.messageId;

          // Link attachment to message
          const { error: attErr } = await supabase.from('message_attachments').insert({ conversation_id: conversationId, message_id: messageId, uploader_id: currentUserId, file_path: filePath, file_name: file.name, mime_type: file.type, file_size: file.size });
          if (attErr) {
            console.warn('Failed to insert message_attachments:', attErr);
          }

          await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
        } catch (err) {
          console.warn('Attachment send error:', err);
        }
      }

      // 2) Send text message if present
      if (newMessage.trim()) {
        const textRes = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ conversationId, messageText: newMessage.trim() }),
        });
        if (!textRes.ok) {
          const err = await textRes.json().catch(() => ({}));
          alert('Failed to send message: ' + (err.error || 'Unknown error'));
        } else {
          setNewMessage('');
        }
      }

      // clear pending attachments
      setPendingAttachments([]);
    } catch (err) {
      console.error('Unexpected error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  /* ── Auth helper: get access token for API calls ────────────── */
  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  /* ── Send final quote (vendor action) — via API route ────── */
  const handleSendFinalQuote = async () => {
    if (!quote || !currentUserId || !conversationId) return;
    const priceValue = parseInt(finalPrice.replace(/[^0-9]/g, ''), 10);
    if (!priceValue || priceValue <= 0) { alert('Please enter a valid final price.'); return; }

    setIsUpdatingQuote(true);
    try {
      const isUuidLocal = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

      const payload: any = {
        status: 'negotiating',
        finalPrice: priceValue,
        message: finalMessage || '',
      };

      if (quote && isUuidLocal((quote as any).id)) {
        payload.quoteId = (quote as any).id;
      } else if (quote && ((quote as any).quote_ref || (quote as any).quoteRef) && (quote as any).vendor_id) {
        payload.quoteRef = (quote as any).quote_ref || (quote as any).quoteRef;
        payload.vendorId = (quote as any).vendor_id;
      } else {
        alert('Quote data not loaded. Please refresh.');
        return;
      }

      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        alert('You are not logged in. Please sign in again.');
        return;
      }

      const res = await fetch('/api/quotes/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        alert(data?.error || 'Failed to send final quote.');
        return;
      }

      if (!data?.quote) {
        alert('Quote updated, but server returned no data.');
        setShowBottomSheet(false);
        setFinalPrice('');
        setFinalMessage('');
        return;
      }

      // Update UI state from server
      setQuote(data.quote as Quote);
      alert('Final quote sent successfully ✅');
      setShowBottomSheet(false);
      setFinalPrice('');
      setFinalMessage('');
    } catch (e) { console.error('handleSendFinalQuote error', e); alert('Network/server error sending quote.'); } finally { setIsUpdatingQuote(false); }
  };

  /* ── Couple accept / decline quote — via API route ──────── */
  const handleCoupleDecision = async (decision: 'accepted' | 'declined') => {
    if (!quote || !currentUserId || !conversationId) return;
    setIsUpdatingQuote(true);
    try {
      const token = await getAccessToken();
      if (!token) { alert('Please sign in again.'); return; }

      const res = await fetch('/api/quotes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quoteId: quote.id,
          quoteRef: (quote as any)?.quote_ref || (quote as any)?.quoteRef || null,
          status: decision,
          conversationId,
        }),
      });

      let result: any = null;
      try { result = await res.json(); } catch { result = null; }

      if (!res.ok || (result && result.success === false)) {
        alert((result && result.error) || 'Failed to update quote status.');
        return;
      }

      if (result && result.quote) {
        setQuote(result.quote as Quote);
      }

      // Track quote outcome against the vendor
      if (conversation?.vendor_id) {
        const eventType = decision === 'accepted' ? 'quote_accepted' : 'quote_declined';
        trackVendorEvent(conversation.vendor_id, eventType, { quote_id: quote.id, quote_ref: (quote as any).quote_ref }).catch(() => {});
      }
    } catch (err) { console.error(err); alert('Failed to update quote.'); } finally { setIsUpdatingQuote(false); }
  };

  /* ── Vendor confirm booking ─────────────────────────────────── */
  const handleConfirmBooking = async () => {
    if (!quote || !currentUserId) return;
    if (!confirm('Confirm this booking? This will notify the couple.')) return;
    setIsUpdatingQuote(true);
    try {
      const token = await getAccessToken();
      if (!token) { alert('Please sign in again.'); return; }
      const res = await fetch('/api/vendor/booking/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quote_id: quote.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { alert(data?.error || 'Failed to confirm booking.'); return; }
      setQuote(prev => prev ? { ...prev, status: 'booked' } : prev);
    } catch (err) { console.error(err); alert('Failed to confirm booking.'); } finally { setIsUpdatingQuote(false); }
  };

  /* ── Vendor decline quote ────────────────────────────────────── */
  const handleVendorDecline = async () => {
    if (!quote || !currentUserId) return;
    if (!confirm('Decline this quote request? The couple will be notified.')) return;
    setIsUpdatingQuote(true);
    try {
      const token = await getAccessToken();
      if (!token) { alert('Please sign in again.'); return; }
      const res = await fetch('/api/quotes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quoteId: quote.id, status: 'declined' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) { alert(data?.error || 'Failed to decline quote.'); return; }
      if (data?.quote) setQuote(data.quote as Quote);
    } catch (err) { console.error(err); alert('Failed to decline quote.'); } finally { setIsUpdatingQuote(false); }
  };

  /* ── File attachment upload ─────────────────────────────────── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Queue selected files for user to review before sending
    setPendingAttachments(prev => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Client-side image resizing: reduce large image dimensions and compress to save bandwidth
  const resizeImageFile = async (file: File, maxDim = 1920, quality = 0.8): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    try {
      // Use createImageBitmap for performant decoding when available
      const bitmap = await (createImageBitmap ? createImageBitmap(file as any) : new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img as any);
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      }));

      // bitmap may be ImageBitmap or HTMLImageElement
      const width = (bitmap as any).width;
      const height = (bitmap as any).height;
      const ratio = Math.min(1, Math.min(maxDim / width, maxDim / height));
      const w = Math.round(width * ratio);
      const h = Math.round(height * ratio);

      if (ratio === 1) {
        // No resize needed
        return file;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap as any, 0, 0, w, h);

      // Prefer JPEG for compression; preserve PNG only if original was PNG and transparency likely needed
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
      if (!blob) return file;

      const ext = mime === 'image/png' ? '.png' : '.jpg';
      const newName = file.name.replace(/\.[^/.]+$/, '') + ext;
      const newFile = new File([blob], newName, { type: mime });
      return newFile;
    } catch (err) {
      // If anything fails, fall back to original file
      return file;
    }
  };

  const handleDownloadAttachment = async (att: MessageAttachment) => {
    if (att.signed_url) { window.open(att.signed_url, '_blank'); return; }
    try {
      const { data } = await supabase.storage.from('umshado-files').createSignedUrl(att.file_path, 3600);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch { alert('Failed to download file.'); }
  };

  /* ── Helpers ────────────────────────────────────────────────── */
  const isImage = (m: string | null) => m?.startsWith('image/');
  const formatFileSize = (b: number | null) => { if (!b) return ''; if (b < 1024) return `${b} B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`; return `${(b / (1024 * 1024)).toFixed(1)} MB`; };
  const formatTimestamp = (ts: string) => new Date(ts).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const items = insertDateSeparators(messages);

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100svh', height: '100svh', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes typingBounce { 0%, 60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
        @keyframes bubbleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(154,33,67,0.1)' }}>
        <button onClick={() => router.push('/messages')} style={{ padding: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 10, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>

        <Avatar name={otherPartyName} url={otherPartyLogo} size={40} showOnline={otherUserOnline} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherPartyName || 'Loading…'}</h1>
          {otherUserTyping ? (
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)', animation: 'slideDown 0.2s ease' }}>typing…</p>
          ) : otherUserOnline ? (
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>online</p>
          ) : otherPartyLocation ? (
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherPartyLocation}</p>
          ) : null}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: C.muted }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.crimsonDim, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="24" height="24" fill="none" stroke={C.crimson} strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>No messages yet. Say hello! 👋</p>
          </div>
        )}

        {hasMoreOlder && (
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <button onClick={async () => {
              if (isLoadingOlder || !oldestTimestamp || !conversationId) return;
              setIsLoadingOlder(true);
              try {
                const { data: raw } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).lt('created_at', oldestTimestamp).order('created_at', { ascending: false }).limit(PAGE_SIZE);
                const page = raw || [];
                const withAttachments = await Promise.all(page.reverse().map(async (msg) => {
                  const { data: atts } = await supabase.from('message_attachments').select('*').eq('message_id', msg.id);
                  const signed = await Promise.all((atts || []).map(async (att) => {
                    try { const { data: s } = await supabase.storage.from('umshado-files').createSignedUrl(att.file_path, 3600); return { ...att, signed_url: s?.signedUrl }; } catch { return att; }
                  }));
                  return { ...msg, attachments: signed } as Message;
                }));
                setMessages(prev => [...withAttachments, ...prev]);
                const newOldest = page.length > 0 ? page[page.length - 1].created_at : oldestTimestamp;
                setOldestTimestamp(newOldest); setHasMoreOlder(page.length === PAGE_SIZE);
              } catch (e) { console.error('Failed to load older messages', e); } finally { setIsLoadingOlder(false); }
            }} style={{ padding: '8px 16px', borderRadius: 12, background: C.card, border: `1.5px solid ${C.border}`, color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {isLoadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {items.map((item, idx) => {
          if (item.type === 'date-separator') {
            return (
              <div key={item.key} style={{ textAlign: 'center', margin: '12px 0 8px', fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{item.date}</div>
            );
          }

          const msg = item.msg as Message;
          const isMine = msg.sender_id === currentUserId;
          const bubbleBg = isMine ? C.myBubble : C.theirBubble;
          const bubbleText = isMine ? C.myText : C.theirText;
          const bubbleBorder = isMine ? 'none' : `1px solid ${C.theirBorder}`;
          const bubbleShadow = isMine ? '0 3px 12px rgba(154,33,67,0.15)' : '0 2px 8px rgba(0,0,0,0.06)';
          const borderRadius = isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px';

          return (
            <div key={item.key} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', animation: `bubbleIn 0.25s ease ${Math.min(idx * 0.02, 0.3)}s both` }}>
              <div style={{ maxWidth: '75%', background: bubbleBg, border: bubbleBorder, color: bubbleText, borderRadius, padding: '10px 14px', boxShadow: bubbleShadow, fontSize: 14, lineHeight: 1.45 }}>
                <div style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word'}}>
                  {msg.message_text}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {msg.attachments.map((att) => (
                      <button key={att.id} onClick={() => handleDownloadAttachment(att)} style={{ width: '100%', borderRadius: 10, border: isMine ? '1px solid rgba(255,255,255,0.2)' : `1px solid ${C.border}`, background: isMine ? 'rgba(255,255,255,0.1)' : C.bg, padding: '8px 10px', textAlign: 'left', fontSize: 11, cursor: 'pointer', color: bubbleText }}>
                        <div style={{ fontWeight: 700 }}>{att.file_name}</div>
                        <div style={{ opacity: 0.75, marginTop: 2 }}>{att.mime_type || 'File'} · {formatFileSize(att.file_size)}</div>
                        {isImage(att.mime_type) && att.signed_url && (
                          <img src={att.signed_url} alt={att.file_name} style={{ marginTop: 6, maxHeight: 180, width: 'auto', borderRadius: 8 }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 4, fontSize: 9, opacity: 0.6, textAlign: isMine ? 'right' : 'left' }}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}

        {otherUserTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'bubbleIn 0.2s ease' }}>
            <div style={{ background: C.theirBubble, border: `1px solid ${C.theirBorder}`, borderRadius: '18px 18px 18px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        {userScrolledUp && newMessagesCount > 0 && (
          <div style={{ position: 'sticky', bottom: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none', animation: 'slideDown 0.2s ease' }}>
            <button onClick={() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); setUserScrolledUp(false); userScrolledUpRef.current = false; setNewMessagesCount(0); }} style={{ padding: '8px 16px', borderRadius: 20, background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(154,33,67,0.3)', pointerEvents: 'all' }}>
              {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} ↓
            </button>
          </div>
        )}
      </div>

      {/* ── Upload Error ── */}
      {uploadError && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', borderTop: '2px solid #ef4444', fontSize: 11, color: '#dc2626', fontWeight: 600 }}>{uploadError}</div>
      )}

      {/* ── Quote Card ── */}
      {quote && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
          <div style={{ background: C.card, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(26,13,18,0.04)' }}>
            <div style={{ height: 4, background: getQuoteStatusColor(quote.status) }} />
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>Quote #{quote.quote_ref}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: C.text }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: getQuoteStatusColor(quote.status) + '20', color: getQuoteStatusColor(quote.status), fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                      {quote.status === 'negotiating' ? 'Sent' : quote.status}
                    </span>
                  </p>
                </div>
                {quote.vendor_final_price && (
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.crimson, fontFamily: 'Georgia, serif' }}>{format(quote.vendor_final_price)}</div>
                )}
              </div>
              {quote.vendor_message && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{quote.vendor_message}</p>
              )}
              {Array.isArray((quote as any)?.add_ons) && (quote as any).add_ons.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>Add-ons</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(quote as any).add_ons.map((a: any, idx: number) => (
                      <span key={`${a?.name ?? 'addon'}-${idx}`} style={{ padding: '4px 10px', borderRadius: 10, background: C.crimsonDim, color: C.crimson, fontSize: 10, fontWeight: 600 }}>
                        {a?.name ?? 'Add-on'}{typeof a?.price === 'number' ? ` • ${format(a.price)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {isVendorInThread && quote.status !== 'declined' && quote.status !== 'booked' && quote.status !== 'accepted' && (
                  <button onClick={() => setShowBottomSheet(true)} disabled={isUpdatingQuote} style={{ padding: '10px 16px', borderRadius: 12, background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(154,33,67,0.2)', opacity: isUpdatingQuote ? 0.5 : 1 }}>
                    {quote.vendor_final_price ? 'Update Final Quote' : 'Send Final Quote'}
                  </button>
                )}
                {isVendorInThread && quote.status === 'requested' && (
                  <button onClick={handleVendorDecline} disabled={isUpdatingQuote} style={{ padding: '10px 16px', borderRadius: 12, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: isUpdatingQuote ? 0.5 : 1 }}>Decline</button>
                )}
                {isVendorInThread && quote.status === 'accepted' && (
                  <button onClick={handleConfirmBooking} disabled={isUpdatingQuote} style={{ padding: '10px 16px', borderRadius: 12, background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(34,197,94,0.25)', opacity: isUpdatingQuote ? 0.5 : 1 }}>Confirm Booking</button>
                )}
                {conversation && currentUserId && conversation.couple_id === currentUserId && quote.status === 'negotiating' && (
                  <>
                    <button onClick={() => handleCoupleDecision('accepted')} disabled={isUpdatingQuote} style={{ padding: '10px 16px', borderRadius: 12, background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: isUpdatingQuote ? 0.5 : 1 }}>Accept</button>
                    <button onClick={() => handleCoupleDecision('declined')} disabled={isUpdatingQuote} style={{ padding: '10px 16px', borderRadius: 12, background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: isUpdatingQuote ? 0.5 : 1 }}>Decline</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending Attachments ── */}
      {pendingAttachments.length > 0 && (
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, background: C.card }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingAttachments.map((file, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <svg width="16" height="16" fill="none" stroke={C.muted} strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                </div>
                <button onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ marginLeft: 8, padding: 4, background: '#fef2f2', border: 'none', borderRadius: 8, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.card, padding: '12px 14px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{ padding: 10, borderRadius: '50%', background: C.bg, border: `1.5px solid ${C.border}`, color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isUploading ? 0.5 : 1 }}>
          {isUploading ? (
            <div style={{ width: 18, height: 18, border: `2px solid ${C.muted}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          )}
        </button>
        <textarea value={newMessage} onChange={(e) => { setNewMessage(e.target.value); broadcastTyping(); }} onKeyDown={handleKeyPress} style={{ flex: 1, resize: 'none', borderRadius: 22, border: `1.5px solid ${C.border}`, background: C.bg, padding: '10px 16px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }} rows={1} placeholder="Type a message…" onFocus={(e) => e.target.style.borderColor = C.crimson} onBlur={(e) => e.target.style.borderColor = C.border} />
        <button onClick={handleSend} disabled={isSending || (pendingAttachments.length === 0 && !newMessage.trim())} style={{ padding: 10, borderRadius: '50%', background: (pendingAttachments.length > 0 || newMessage.trim()) ? `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})` : C.border, color: (pendingAttachments.length > 0 || newMessage.trim()) ? '#fff' : C.muted, border: 'none', cursor: (pendingAttachments.length > 0 || newMessage.trim()) ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: (pendingAttachments.length > 0 || newMessage.trim()) ? '0 3px 12px rgba(154,33,67,0.25)' : 'none', opacity: isSending ? 0.5 : 1 }}>
          {isSending ? (
            <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          )}
        </button>
      </div>

      {/* ── Bottom Sheet: Final Quote ── */}
      {showBottomSheet && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }} onClick={() => setShowBottomSheet(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, background: C.card, borderRadius: '24px 24px 0 0', padding: '20px 20px 24px', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)', animation: 'slideDown 0.2s ease', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.border, margin: '0 auto 16px' }} />
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: C.dark, fontFamily: 'Georgia, serif' }}>Send Final Quote</h2>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: C.muted }}>Set your final price and optional message.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>Final Price (R)</label>
                <input type="number" min={1} value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} style={{ width: '100%', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.bg, padding: '12px 14px', fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} placeholder="e.g. 25000" onFocus={(e) => e.target.style.borderColor = C.crimson} onBlur={(e) => e.target.style.borderColor = C.border} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, color: C.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>Message (optional)</label>
                <textarea rows={3} value={finalMessage} onChange={(e) => setFinalMessage(e.target.value)} style={{ width: '100%', resize: 'none', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.bg, padding: '12px 14px', fontSize: 13, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }} placeholder="Add notes about what's included…" onFocus={(e) => e.target.style.borderColor = C.crimson} onBlur={(e) => e.target.style.borderColor = C.border} />
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={() => setShowBottomSheet(false)} disabled={isUpdatingQuote} style={{ flex: 1, padding: '12px', borderRadius: 14, border: `1.5px solid ${C.border}`, background: C.card, color: C.text, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: isUpdatingQuote ? 0.5 : 1 }}>Cancel</button>
              <button onClick={handleSendFinalQuote} disabled={isUpdatingQuote} style={{ flex: 1, padding: '12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${C.crimson}, ${C.crimsonDark})`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(154,33,67,0.25)', opacity: isUpdatingQuote ? 0.5 : 1 }}>
                {isUpdatingQuote ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
