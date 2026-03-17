import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers, shouldThrottleMessageNotification } from '@/lib/server/notify';

const SendMessageSchema = z.object({
  conversationId: z.string().uuid('conversationId must be a valid UUID'),
  messageText: z.string().min(1, 'messageText is required').max(5000, 'messageText too long'),
});

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
  const { data: body, error: bodyError } = await validateBody(req, SendMessageSchema);
  if (bodyError) return bodyError;

  const { conversationId, messageText } = body;

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

    // Resolve vendor auth user id — conv.vendor_id may be vendors.id (row UUID) not auth UUID
    let vendorAuthId = conv.vendor_id;
    if (conv.vendor_id !== senderId && conv.couple_id !== senderId) {
      // sender might be a vendor whose user_id differs from vendors.id
      const { data: myVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', senderId)
        .maybeSingle();
      if (myVendor?.id !== conv.vendor_id) {
        return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
      }
    }

    // For notification: resolve the vendor's auth user_id for the receiver side
    if (conv.vendor_id !== conv.couple_id) {
      const { data: vRow } = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', conv.vendor_id)
        .maybeSingle();
      if (vRow?.user_id) vendorAuthId = vRow.user_id;
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

    // 4. Identify receiver — use resolved auth user id for vendor side
    const senderIsCouple = conv.couple_id === senderId;
    const receiverId = senderIsCouple ? vendorAuthId : conv.couple_id;

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
