import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function verifySignature(data: Record<string, string>, passphrase: string, signature: string): boolean {
  const filtered = { ...data };
  delete filtered.signature;
  const paramString = Object.entries(filtered)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : paramString;
  const computed = crypto.createHash('md5').update(withPassphrase).digest('hex');
  return computed === signature;
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const text = await req.text();
    const params = Object.fromEntries(new URLSearchParams(text));

    const passphrase = process.env.PAYFAST_PASSPHRASE || '';
    if (!verifySignature(params, passphrase, params.signature || '')) {
      console.error(JSON.stringify({ route: 'verify-webhook', event: 'signature_invalid' }));
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const paymentStatus = params.payment_status;
    const verRequestId = params.m_payment_id;
    const vendorId = params.custom_str1;
    const now = new Date().toISOString();

    if (paymentStatus !== 'COMPLETE') {
      await supabase
        .from('verification_requests')
        .update({ status: 'payment_failed', updated_at: now })
        .eq('id', verRequestId);
      console.log(JSON.stringify({ route: 'verify-webhook', event: 'payment_not_complete', verRequestId, vendorId, paymentStatus }));
      return new NextResponse('OK', { status: 200 });
    }

    // Idempotency guard: if already processed, skip all downstream writes.
    // This prevents duplicate billing_transactions rows and duplicate admin
    // notifications on PayFast retries.
    const { data: existingReq } = await supabase
      .from('verification_requests')
      .select('status')
      .eq('id', verRequestId)
      .maybeSingle();

    if (existingReq?.status === 'paid_pending_review') {
      console.log(JSON.stringify({ route: 'verify-webhook', event: 'idempotency_skip', verRequestId, vendorId }));
      return new NextResponse('OK', { status: 200 });
    }

    // Mark payment received — now awaiting manual review by uMshado team
    const { error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status: 'paid_pending_review',
        payfast_payment_id: params.pf_payment_id,
        paid_at: now,
        updated_at: now,
      })
      .eq('id', verRequestId);

    if (updateError) {
      console.error('Failed to update verification request:', updateError);
      return new NextResponse('DB error', { status: 500 });
    }

    // Update vendor verification_status
    await supabase
      .from('vendors')
      .update({
        verification_status: 'paid_pending_review',
        updated_at: now,
      })
      .eq('id', vendorId);

    // Log the transaction
    await supabase.from('billing_transactions').insert({
      vendor_id: vendorId,
      plan: 'verification',
      amount_cents: Math.round(parseFloat(params.amount_gross || '0') * 100),
      payfast_payment_id: params.pf_payment_id,
      status: 'complete',
      created_at: now,
    });

    // Notify admin via in-app notification (if notifyUsers is available)
    try {
      const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      if (adminEmails.length > 0) {
        // Find admin user IDs
        const usersRes = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`,
          {
            headers: {
              apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
              Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
            },
          }
        );
        if (usersRes.ok) {
          const body = await usersRes.json();
          const adminIds = (body?.users || [])
            .filter((u: { email?: string; id: string }) => adminEmails.includes(u.email?.toLowerCase() || ''))
            .map((u: { id: string }) => u.id);

          if (adminIds.length > 0) {
            await supabase.from('notifications').insert(
              adminIds.map((uid: string) => ({
                user_id: uid,
                type: 'verification_request',
                title: 'New Verification Request 🔵',
                body: `A vendor has paid for verification and is awaiting review.`,
                link: '/admin/verifications',
                meta: { vendor_id: vendorId, verification_request_id: verRequestId },
                created_at: now,
              }))
            );
          }
        }
      }
    } catch (notifyErr) {
      console.error('Failed to notify admin:', notifyErr);
    }

    console.log(JSON.stringify({
      route: 'verify-webhook',
      event: 'payment_complete',
      verRequestId,
      vendorId,
      amountCents: Math.round(parseFloat(params.amount_gross || '0') * 100),
      pfPaymentId: params.pf_payment_id,
    }));
    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error(JSON.stringify({ route: 'verify-webhook', event: 'unexpected_error', error: err instanceof Error ? err.message : String(err) }));
    return new NextResponse('Internal error', { status: 500 });
  }
}
