import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

/**
 * POST /api/quotes/status
 *
 * Updates a quote's status and notifies the other party.
 * Used for: vendor sends final quote, couple accepts/declines.
 *
 * Body: {
 *   quoteId: string;
 *   status: 'negotiating' | 'accepted' | 'declined';
 *   vendorFinalPrice?: number;
 *   vendorMessage?: string;
 *   conversationId: string;
 * }
 */
export async function POST(req: NextRequest) {
  try {
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
    const userId = authUser?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // --- Body ---
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { quoteId, status, vendorFinalPrice, vendorMessage, conversationId } = body;

    if (!quoteId || !status || !conversationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const validStatuses = ['negotiating', 'accepted', 'declined'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const supabase = createServiceClient();
    // 1. Fetch current quote to verify ownership
    const { data: existingQuote, error: fetchErr } = await supabase
      .from('quotes')
      .select('id, quote_ref, couple_id, vendor_id, status, vendor_final_price, package_name')
      .eq('id', quoteId)
      .single();

    if (fetchErr || !existingQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Verify user is either the couple or vendor on this quote
    const isVendor = existingQuote.vendor_id === userId;
    const isCouple = existingQuote.couple_id === userId;

    if (!isVendor && !isCouple) {
      return NextResponse.json({ error: 'Not authorized for this quote' }, { status: 403 });
    }

    // 2. Build update payload
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (vendorFinalPrice !== undefined && isVendor) {
      updatePayload.vendor_final_price = vendorFinalPrice;
    }
    if (vendorMessage !== undefined && isVendor) {
      updatePayload.vendor_message = vendorMessage;
    }

    // 3. Update quote
    const { data: updated, error: updateErr } = await supabase
      .from('quotes')
      .update(updatePayload)
      .eq('id', quoteId)
      .select('id, quote_ref, status, vendor_final_price, vendor_message, couple_id, vendor_id, created_at')
      .single();

    if (updateErr) {
      console.error('[quotes/status] update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
    }

    // 4. Insert a chat message about the status change
    let messageText = '';
    if (isVendor && status === 'negotiating' && vendorFinalPrice) {
      messageText = `Final quote for ${existingQuote.quote_ref}: R${vendorFinalPrice.toLocaleString()}${vendorMessage ? `\n\n${vendorMessage}` : ''}`;
    } else if (isCouple && status === 'accepted') {
      messageText = `Quote accepted (${existingQuote.quote_ref})`;
    } else if (isCouple && status === 'declined') {
      messageText = `Quote declined (${existingQuote.quote_ref})`;
    }

    if (messageText) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        message_text: messageText,
        quote_ref: existingQuote.quote_ref,
        read: false,
      });

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    // 5. Insert conversion row if accepted
    if (status === 'accepted') {
      const amount = updated.vendor_final_price ?? existingQuote.vendor_final_price ?? 0;
      try {
        await supabase.from('conversions').insert({
          quote_id: quoteId,
          vendor_id: existingQuote.vendor_id,
          couple_id: existingQuote.couple_id,
          amount,
          status: 'accepted',
        });
      } catch {
        // conversions table may not exist yet — non-critical
      }
    }

    // 6. Notify the OTHER party
    const notifyUserId = isVendor ? existingQuote.couple_id : existingQuote.vendor_id;
    let notifyTitle = '';
    let notifyBody = '';

    if (isVendor && status === 'negotiating') {
      notifyTitle = `Final quote sent (${existingQuote.quote_ref})`;
      notifyBody = `Vendor sent a final quote of R${(vendorFinalPrice || 0).toLocaleString()}.`;
    } else if (isCouple && status === 'accepted') {
      notifyTitle = `Quote accepted (${existingQuote.quote_ref})`;
      notifyBody = 'Couple has accepted your quote.';
    } else if (isCouple && status === 'declined') {
      notifyTitle = `Quote declined (${existingQuote.quote_ref})`;
      notifyBody = 'Couple has declined your quote.';
    }

    if (notifyTitle) {
      await notifyUsers({
        userIds: [notifyUserId],
        type: 'quote_status_updated',
        title: notifyTitle,
        body: notifyBody,
        link: `/messages/thread/${conversationId}`,
        meta: { quoteId, quoteRef: existingQuote.quote_ref, status, conversationId },
      });
    }

    return NextResponse.json({ success: true, quote: updated });
  } catch (err: any) {
    console.error('[quotes/status] unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
