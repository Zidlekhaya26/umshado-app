'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCurrency } from '@/app/providers/CurrencyProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MessageAttachment {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  signed_url?: string;
}

interface Message {
  id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
  attachments?: MessageAttachment[];
  // local-only flag to avoid re-appending from realtime
  _optimistic?: boolean;
}

interface Conversation {
  id: string;
  couple_id: string;
  vendor_id: string;
}

interface Quote {
  id: string;
  quote_ref: string;
  status: 'requested' | 'negotiating' | 'accepted' | 'declined' | 'expired';
  vendor_final_price: number | null;
  vendor_message: string | null;
  couple_id: string;
  vendor_id: string;
  created_at: string;
  add_ons?: any[];
  package_name?: string | null;
  base_from_price?: number | null;
  guest_count?: number | null;
  hours?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

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
  // Pagination / performance: track oldest loaded message and paging
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const PAGE_SIZE = 50;

  // Other party identity for the header
  const [otherPartyName, setOtherPartyName] = useState('');
  const [otherPartyLogo, setOtherPartyLogo] = useState<string | null>(null);
  const [otherPartyLocation, setOtherPartyLocation] = useState<string | null>(null);
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string | undefined>(undefined);

  // Typing indicator and presence
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smart scroll
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const userScrolledUpRef = useRef(false); // Ref to avoid stale closures in realtime subscription
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  // Quote management
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isUpdatingQuote, setIsUpdatingQuote] = useState(false);
  const [showFinalQuoteModal, setShowFinalQuoteModal] = useState(false);
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
        .in('status', ['requested', 'negotiating', 'accepted', 'declined', 'expired'])
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
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
      // Log the quote object for debugging — ensure it's the DB row
      // eslint-disable-next-line no-console
      console.log('Quote object being used:', quote);

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

      // Log payload for verification
      // eslint-disable-next-line no-console
      console.log('Sending quote status payload', payload);

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
        setShowFinalQuoteModal(false);
        setFinalPrice('');
        setFinalMessage('');
        return;
      }

      // Update UI state from server
      setQuote(data.quote as Quote);
      alert('Final quote sent successfully ✅');
      setShowFinalQuoteModal(false);
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
    } catch (err) { console.error(err); alert('Failed to update quote.'); } finally { setIsUpdatingQuote(false); }
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

  const userIsVendor = conversation && currentUserId && conversation.vendor_id === currentUserId;
  const userIsCouple = conversation && currentUserId && conversation.couple_id === currentUserId;

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        {/* Header – shows who you're chatting with */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/messages')} className="text-gray-600 hover:text-gray-900 p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center relative">
              {otherPartyLogo ? (
                <button type="button" onClick={() => { setLogoSrc(otherPartyLogo ?? null); setLogoAlt(otherPartyName || 'Logo'); setLogoOpen(true); }} className="w-full h-full flex items-center justify-center" aria-label="View logo">
                  <img src={otherPartyLogo} alt="" className="w-full h-full object-contain p-2" />
                </button>
              ) : (
                <span className="text-white font-bold text-base">
                  {otherPartyName.charAt(0).toUpperCase() || '?'}
                </span>
              )}
              {/* Online indicator */}
              {otherUserOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <ImageLightbox src={logoSrc} alt={logoAlt} isOpen={logoOpen} onClose={() => setLogoOpen(false)} />

            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{otherPartyName || 'Loading…'}</h1>
              <p className="text-xs text-gray-500">
                {otherUserTyping ? 'typing...' : otherUserOnline ? 'online' : otherPartyLocation ? otherPartyLocation : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 relative"
        >
          {messages.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-500">
              <p>No messages yet. Say hello! 👋</p>
            </div>
          )}

          {hasMoreOlder && (
            <div className="text-center w-full">
              <button onClick={async () => {
                if (isLoadingOlder || !oldestTimestamp || !conversationId) return;
                setIsLoadingOlder(true);
                try {
                  const { data: raw } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conversationId)
                    .lt('created_at', oldestTimestamp)
                    .order('created_at', { ascending: false })
                    .limit(PAGE_SIZE);

                  const page = raw || [];
                  const withAttachments = await Promise.all(
                    page.reverse().map(async (msg) => {
                      const { data: atts } = await supabase
                        .from('message_attachments')
                        .select('*')
                        .eq('message_id', msg.id);
                      const signed = await Promise.all(
                        (atts || []).map(async (att) => {
                          try { const { data: s } = await supabase.storage.from('umshado-files').createSignedUrl(att.file_path, 3600); return { ...att, signed_url: s?.signedUrl }; } catch { return att; }
                        })
                      );
                      return { ...msg, attachments: signed } as Message;
                    })
                  );

                  // prepend older messages
                  setMessages(prev => [...withAttachments, ...prev]);
                  const newOldest = page.length > 0 ? page[page.length - 1].created_at : oldestTimestamp;
                  setOldestTimestamp(newOldest);
                  setHasMoreOlder(page.length === PAGE_SIZE);
                } catch (e) {
                  console.error('Failed to load older messages', e);
                } finally {
                  setIsLoadingOlder(false);
                }
              }} className="text-sm px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50">{isLoadingOlder ? 'Loading…' : 'Load older messages'}</button>
            </div>
          )}

          {messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isMine ? 'bg-purple-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                  {/* Show sender display name for incoming messages when vendor is viewing */}
                  {!isMine && userIsVendor && otherPartyName && (
                    <div className="text-xs font-semibold text-gray-700 mb-1">{otherPartyName}</div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.message_text}</div>

                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {msg.attachments.map((att) => (
                        <button key={att.id} onClick={() => handleDownloadAttachment(att)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${isMine ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-gray-50'}`}>
                          <div className="font-semibold">{att.file_name}</div>
                          <div className="opacity-80">{att.mime_type || 'File'} · {formatFileSize(att.file_size)}</div>
                          {isImage(att.mime_type) && att.signed_url && (
                            <img src={att.signed_url} alt={att.file_name} className="mt-2 max-h-48 w-auto rounded-lg" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`mt-1 text-[10px] ${isMine ? 'opacity-70' : 'text-gray-400'}`}>{formatTimestamp(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          
          {/* New messages badge */}
          {userScrolledUp && newMessagesCount > 0 && (
            <div className="sticky bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex justify-center">
              <button
                onClick={() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  setUserScrolledUp(false);
                  userScrolledUpRef.current = false;
                  setNewMessagesCount(0);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                {newMessagesCount} new message{newMessagesCount > 1 ? 's' : ''} ↓
              </button>
            </div>
          )}
        </div>

        {/* Upload Error */}
        {uploadError && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-xs text-red-700">{uploadError}</div>
        )}

        {/* Quote Card */}
        {quote && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-gray-500">Quote #{quote.quote_ref}</div>
                  <div className="text-sm font-bold text-gray-900">Status: {quote.status === 'negotiating' ? 'Sent' : quote.status}</div>
                </div>
                {quote.vendor_final_price && (
                  <div className="text-lg font-bold text-purple-700">{format(quote.vendor_final_price)}</div>
                )}
              </div>
              {quote.vendor_message && (
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{quote.vendor_message}</div>
              )}
              {/* Add-ons */}
              {Array.isArray((quote as any)?.add_ons) && (quote as any).add_ons.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Add-ons</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(quote as any).add_ons.map((a: any, idx: number) => (
                      <span
                        key={`${a?.name ?? 'addon'}-${idx}`}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200"
                      >
                        {a?.name ?? 'Add-on'}{typeof a?.price === 'number' ? ` • ${format(a.price)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray((quote as any)?.add_ons) && (quote as any).add_ons.length === 0 && (
                <p className="text-xs text-gray-400 mt-2">No add-ons selected</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {userIsVendor && (
                  <button onClick={() => setShowFinalQuoteModal(true)} disabled={isUpdatingQuote} className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                    {quote.vendor_final_price ? 'Update Final Quote' : 'Send Final Quote'}
                  </button>
                )}
                {userIsCouple && quote.status === 'negotiating' && (
                  <>
                    <button onClick={() => handleCoupleDecision('accepted')} disabled={isUpdatingQuote} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">Accept</button>
                    <button onClick={() => handleCoupleDecision('declined')} disabled={isUpdatingQuote} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Decline</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Input Bar */}
        {pendingAttachments.length > 0 && (
          <div className="px-4 pt-3 pb-2 bg-white border-t border-gray-200">
            <div className="space-y-2">
              {pendingAttachments.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    <div className="text-sm text-gray-700 truncate">{file.name}</div>
                  </div>
                  <button onClick={() => setPendingAttachments(prev => prev.filter((_, i) => i !== idx))} className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors" aria-label="Remove attachment">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-end gap-2">
          <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-2.5 rounded-xl border-2 border-gray-300 text-gray-600 hover:bg-gray-50 flex-shrink-0">
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            )}
          </button>
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              broadcastTyping();
            }}
            onKeyDown={handleKeyPress}
            className="flex-1 resize-none rounded-xl border-2 border-gray-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={1}
            placeholder="Type a message…"
          />
          <button onClick={handleSend} disabled={isSending || (pendingAttachments.length === 0 && !newMessage.trim())} className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${ (pendingAttachments.length > 0 || newMessage.trim()) ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-200 text-gray-400'}`}>
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Final Quote Modal */}
      {showFinalQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Send Final Quote</h2>
            <p className="mt-1 text-xs text-gray-600">Set your final price and optional message.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Final Price (R)</label>
                <input type="number" min={1} value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500" placeholder="e.g. 25000" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Message (optional)</label>
                <textarea rows={3} value={finalMessage} onChange={(e) => setFinalMessage(e.target.value)} className="w-full resize-none rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500" placeholder="Add notes about what's included…" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setShowFinalQuoteModal(false)} disabled={isUpdatingQuote} className="flex-1 rounded-lg border-2 border-gray-300 px-3 py-2 font-semibold text-gray-700">Cancel</button>
              <button onClick={handleSendFinalQuote} disabled={isUpdatingQuote} className="flex-1 rounded-lg bg-purple-600 px-3 py-2 font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                {isUpdatingQuote ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
