import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";

type Body = {
  quoteId?: string;       // uuid
  quoteRef?: string;      // e.g. Q-20260217-94032
  vendorId?: string;      // optional safety
  status?: string;        // requested | sent | accepted | declined | etc
  finalPrice?: number;    // vendor final price
  message?: string;       // vendor message
};

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { quoteId, quoteRef, vendorId, status, finalPrice, message } = body;

    if (!quoteId && !quoteRef) {
      return NextResponse.json(
        { success: false, error: "Missing quoteId or quoteRef" },
        { status: 400 }
      );
    }

    // Normalize status: accept 'sent' from older UIs and store it as 'negotiating'
    const normalizedStatus = status === "sent" ? "negotiating" : status;

    const svc = createServiceClient();

    // Build WHERE
    const whereById = quoteId && isUuid(quoteId);

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

    return NextResponse.json({ success: true, quote: result.data });
  } catch (err: any) {
    console.error("quotes/status route fatal:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
