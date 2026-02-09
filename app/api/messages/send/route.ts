import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers, shouldThrottleMessageNotification } from '@/lib/server/notify';

/**
 * POST /api/messages/send
 *
 * Inserts a message into the messages table and notifies the receiver
 * (with anti-spam: max 1 notification per thread per receiver per 60s).
 *
 * Body: {
 *   conversationId: string;
 *   messageText: string;
 * }
 */
export async function POST(req: NextRequest) {
  // --- Auth ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const authUser = await userRes.json();
  const senderId = authUser?.id;
  if (!senderId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  // --- Body ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conversationId, messageText } = body;

  if (!conversationId || !messageText?.trim()) {
    return NextResponse.json({ error: 'Missing conversationId or messageText' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    // 1. Verify conversation exists and sender is a participant
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, couple_id, vendor_id')
      .eq('id', conversationId)
      .single();

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (conv.couple_id !== senderId && conv.vendor_id !== senderId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // 2. Insert message
    const { data: msgData, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_text: messageText.trim(),
        read: false,
      })
      .select('id, created_at')
      .single();

    if (msgErr) {
      console.error('[messages/send] insert error:', msgErr);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // 3. Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // 4. Identify receiver
    const receiverId = conv.couple_id === senderId ? conv.vendor_id : conv.couple_id;

    // 5. Anti-spam check: skip notification if one was sent within 60s for same thread
    const throttled = await shouldThrottleMessageNotification(receiverId, conversationId, 60);

    if (!throttled) {
      // Get sender's display name
      let senderName = 'Someone';
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', senderId)
        .maybeSingle();

      if (profile?.full_name) {
        senderName = profile.full_name;
      } else {
        // Try vendor business_name
        const { data: vendor } = await supabase
          .from('vendors')
          .select('business_name')
          .eq('id', senderId)
          .maybeSingle();
        if (vendor?.business_name) senderName = vendor.business_name;
      }

      // Truncate preview
      const preview = messageText.trim().length > 80
        ? messageText.trim().slice(0, 77) + '…'
        : messageText.trim();

      await notifyUsers({
        userIds: [receiverId],
        type: 'message_received',
        title: `New message from ${senderName}`,
        body: preview,
        link: `/messages/thread/${conversationId}`,
        meta: { threadId: conversationId, senderId },
      });
    }

    return NextResponse.json({
      success: true,
      messageId: msgData.id,
      createdAt: msgData.created_at,
    });
  } catch (err: any) {
    console.error('[messages/send] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
