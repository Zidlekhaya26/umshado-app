import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/apiValidate";
import { createServiceClient } from "@/lib/supabaseServer";

const QuoteStatusSchema = z.object({
  quoteId:    z.string().uuid().optional(),
  quoteRef:   z.string().min(1).max(50).optional(),
  vendorId:   z.string().uuid().optional(),
  status:     z.enum(['requested', 'sent', 'negotiating', 'accepted', 'declined', 'cancelled']).optional(),
  finalPrice: z.number().min(0).max(10_000_000).optional(),
  message:    z.string().max(2000).optional(),
}).refine(d => d.quoteId || d.quoteRef, { message: 'quoteId or quoteRef is required' });

export async function POST(req: NextRequest) {
  // --- Auth: resolve user from Bearer token ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authedUser = await userRes.json();
  const userId: string | undefined = authedUser?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: body, error: bodyError } = await validateBody(req, QuoteStatusSchema);
    if (bodyError) return bodyError;

    const { quoteId, quoteRef, vendorId, status, finalPrice, message } = body;

    // Normalize status: accept 'sent' from older UIs and store it as 'negotiating'
    const normalizedStatus = status === "sent" ? "negotiating" : status;

    const svc = createServiceClient();

    // --- Fetch quote first to verify existence and ownership ---
    let quoteQuery = svc
      .from("quotes")
      .select("id, quote_ref, couple_id, vendor_id")
      .limit(1);

    if (quoteId) {
      quoteQuery = quoteQuery.eq("id", quoteId);
    } else {
      quoteQuery = quoteQuery.eq("quote_ref", quoteRef!);
      if (vendorId) quoteQuery = quoteQuery.eq("vendor_id", vendorId);
    }

    const { data: existingQuote, error: fetchErr } = await quoteQuery.maybeSingle();

    if (fetchErr) {
      console.error("quotes/status fetch error:", fetchErr);
      return NextResponse.json({ success: false, error: "Failed to fetch quote" }, { status: 500 });
    }

    if (!existingQuote) {
      return NextResponse.json(
        { success: false, error: "No quote matched the provided quoteId/quoteRef." },
        { status: 404 }
      );
    }

    // --- Ownership check ---
    let authorized = false;

    if (existingQuote.couple_id === userId) {
      // Caller is the couple on this quote
      authorized = true;
    } else {
      // Check if caller owns the vendor on this quote
      const { data: myVendor } = await svc
        .from("vendors")
        .select("id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (myVendor && myVendor.id === existingQuote.vendor_id) {
        authorized = true;
      }
    }

    if (!authorized) {
      console.log(JSON.stringify({
        event: 'quote_status_forbidden',
        userId,
        quoteId: existingQuote.id,
        quoteRef: existingQuote.quote_ref,
        reason: 'not_a_participant',
      }));
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build WHERE
    const whereById = !!quoteId;

    let q = svc.from("quotes").update({
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
    });

    // Try to attach final price + message with the preferred column names
    const updatePreferred = {
      ...(typeof finalPrice === "number" ? { vendor_final_price: finalPrice } : {}),
      ...(typeof message === "string" && message.trim() ? { vendor_message: message.trim() } : {}),
    };

    const updateFallback = {
      ...(typeof finalPrice === "number" ? { final_price: finalPrice } : {}),
      ...(typeof message === "string" && message.trim() ? { message: message.trim() } : {}),
    };

    // Apply preferred fields first
    if (Object.keys(updatePreferred).length > 0) {
      q = svc.from("quotes").update({
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...updatePreferred,
      });
    }

    // WHERE conditions
    if (whereById) {
      q = q.eq("id", quoteId!);
    } else {
      q = q.eq("quote_ref", quoteRef!);
      if (vendorId) q = q.eq("vendor_id", vendorId);
    }

    // Attempt preferred update first (use maybeSingle to avoid PGRST116 when 0 rows)
    let result = await q.select("*").maybeSingle();

    // If preferred columns don't exist, retry with fallback columns
    if (result.error && /column .* does not exist|schema cache/i.test(result.error.message)) {
      let q2 = svc.from("quotes").update({
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
        ...updateFallback,
      });

      if (whereById) {
        q2 = q2.eq("id", quoteId!);
      } else {
        q2 = q2.eq("quote_ref", quoteRef!);
        if (vendorId) q2 = q2.eq("vendor_id", vendorId);
      }

      result = await q2.select("*").maybeSingle();
    }

    if (result.error) {
      console.error("quotes/status update error:", result.error);
      return NextResponse.json(
        { success: false, error: result.error.message || "Failed to update quote" },
        { status: 500 }
      );
    }

    // No rows matched -> return 404 with helpful hint
    if (!result.data) {
      return NextResponse.json(
        {
          success: false,
          error: "No quote matched the provided quoteId/quoteRef (0 rows updated).",
          received: { quoteId, quoteRef, status: normalizedStatus },
          hint: "Ensure frontend sends the DB UUID quote.id OR your quotes.quote_ref exists and matches. Also verify SUPABASE_SERVICE_ROLE_KEY is set for server-side writes if RLS is enabled.",
        },
        { status: 404 }
      );
    }

    console.log(JSON.stringify({ event: 'quote_status_updated', userId, quoteId: existingQuote.id }));
    return NextResponse.json({ success: true, quote: result.data });
  } catch (err: any) {
    console.error("quotes/status route fatal:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
