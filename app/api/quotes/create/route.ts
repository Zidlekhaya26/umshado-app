import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createServiceClient } from '@/lib/supabaseServer';
import { formatPrice } from '@/lib/currency';
import { notifyUsers } from '@/lib/server/notify';
import { checkRateLimit } from '@/lib/rateLimit';

const CreateQuoteSchema = z.object({
  vendorId:    z.string().uuid('vendorId must be a valid UUID'),
  packageId:   z.string().min(1, 'packageId is required'),
  packageName: z.string().min(1).max(200).optional(),
  pricingMode: z.enum(['guest-based', 'hour-based', 'fixed', 'time-based', 'per-person', 'package-based', 'event-based', 'quantity-based']).optional().nullable(),
  guestCount:  z.number().int().min(1).max(10000).optional().nullable(),
  hours:       z.number().min(0).max(168).optional().nullable(),
  basePrice:   z.number().min(0),
  addOns:      z.array(z.unknown()).optional(),
  notes:       z.string().max(2000).optional().nullable(),
  quoteRef:    z.string().min(1).max(50, 'quoteRef too long'),
});

/**
 * POST /api/quotes/create
 *
 * Creates a quote + conversation + initial message, then notifies both parties.
 * Replaces the client-side insert in /quotes/summary so notifications use service role.
 *
 * Body: {
 *   vendorId, packageId, packageName, pricingMode, guestCount?, hours?,
 *   basePrice, addOns, notes?, quoteRef
 * }
 *
 * Auth: Bearer token required (user must be authenticated couple).
 */
export async function POST(req: NextRequest) {
  // --- Auth: get user from access token ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseAnon = (await import('@/lib/supabaseClient')).supabase;

  // We need to validate the token to get the user, but use the anon URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Validate user with auth API
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

  // Rate limit: 5 quote requests per userId per 10 minutes
  const { allowed: quoteAllowed } = checkRateLimit(`quote:${userId}`, 5, 10 * 60 * 1000);
  if (!quoteAllowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  // --- Parse body ---
  const { data: body, error: bodyError } = await validateBody(req, CreateQuoteSchema);
  if (bodyError) return bodyError;

  const { vendorId, packageId, packageName, pricingMode, guestCount, hours, basePrice, addOns, notes, quoteRef } = body;

  const supabase = createServiceClient();

  try {
    // 1. Create quote
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        quote_ref: quoteRef,
        couple_id: userId,
        vendor_id: vendorId,
        package_id: packageId,
        package_name: packageName,
        pricing_mode: pricingMode,
        guest_count: guestCount ?? null,
        hours: hours ?? null,
        base_from_price: basePrice,
        add_ons: addOns ?? [],
        notes: notes || null,
        status: 'requested',
      })
      .select('id')
      .single();

    if (quoteError) {
      console.error('[quotes/create] quote insert error:', quoteError);
      return NextResponse.json({ error: 'Failed to create quote: ' + quoteError.message }, { status: 500 });
    }

    // 2. Create or find conversation
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('couple_id', userId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    let conversationId = existingConv?.id;

    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ couple_id: userId, vendor_id: vendorId })
        .select('id')
        .single();

      if (convError) {
        if (convError.code === '23505') {
          const { data: retry } = await supabase
            .from('conversations')
            .select('id')
            .eq('couple_id', userId)
            .eq('vendor_id', vendorId)
            .maybeSingle();
          conversationId = retry?.id;
        }
        if (!conversationId) {
          console.error(JSON.stringify({ route: 'quotes/create', event: 'conversation_failed', quoteId: quoteData.id, coupleId: userId, vendorId }));
          return NextResponse.json({ error: 'Quote created but conversation failed', quoteId: quoteData.id }, { status: 500 });
        }
      } else {
        conversationId = newConv.id;
      }
    }

    // 3. Insert initial message
    const pricingLine = pricingMode === 'guest-based' || pricingMode === 'per-person'
      ? `Guests: ${guestCount}`
      : pricingMode === 'time-based' || pricingMode === 'hour-based'
      ? `Hours: ${hours}`
      : null;

    const messageText = `Quote request ${quoteRef} created\n\nPackage: ${packageName}${
      pricingLine ? `\n${pricingLine}` : ''
    }\nEstimated Total: ${formatPrice((basePrice || 0), 'ZAR')}${
      notes ? `\n\nNotes: ${notes}` : ''
    }`;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_text: messageText,
      quote_ref: quoteRef,
    });

    // 4. Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    // 5. Fetch vendor user_id + business name for notification
    const { data: vendorData } = await supabase
      .from('vendors')
      .select('business_name, user_id')
      .eq('id', vendorId)
      .maybeSingle();

    const vendorName   = vendorData?.business_name || 'a vendor';
    const vendorUserId = vendorData?.user_id ?? vendorId; // user_id is the auth UUID

    // 6. Notify BOTH parties
    // Vendor gets "New quote request" — must use user_id, not vendor row id
    await notifyUsers({
      userIds: [vendorUserId],
      type: 'quote_created',
      title: `New quote request (${quoteRef})`,
      body: `A couple requested a quote for ${packageName}.`,
      link: `/messages/thread/${conversationId}`,
      meta: { quoteId: quoteData.id, quoteRef, conversationId },
    });

    // Couple gets confirmation "Your quote was sent"
    await notifyUsers({
      userIds: [userId],
      type: 'quote_created',
      title: 'Quote request sent',
      body: `Your quote request for ${packageName} was sent to ${vendorName}.`,
      link: `/messages/thread/${conversationId}`,
      meta: { quoteId: quoteData.id, quoteRef, conversationId },
    });

    console.log(JSON.stringify({
      route: 'quotes/create',
      event: 'quote_created',
      quoteId: quoteData.id,
      quoteRef,
      coupleId: userId,
      vendorId,
      conversationId,
    }));
    return NextResponse.json({
      success: true,
      quoteId: quoteData.id,
      conversationId,
      quoteRef,
    });
  } catch (err: any) {
    console.error(JSON.stringify({ route: 'quotes/create', event: 'unexpected_error', coupleId: userId, vendorId, quoteRef, error: err?.message }));
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
