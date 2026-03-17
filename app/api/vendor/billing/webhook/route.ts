import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function verifySignature(data: Record<string, string>, passphrase: string, signature: string): boolean {
  const filtered = { ...data };
  delete filtered.signature;
  const paramString = Object.entries(filtered)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : paramString;
  const computed = crypto.createHash('md5').update(withPassphrase).digest('hex');
  return computed === signature;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
    const signature = params.signature || '';

    // Verify signature
    if (!verifySignature(params, passphrase, signature)) {
      console.error('PayFast webhook: invalid signature');
      return new NextResponse('Invalid signature', { status: 400 });
    }

    const paymentStatus = params.payment_status;
    const intentId = params.m_payment_id;
    const vendorId = params.custom_str1;
    const paymentType = params.custom_str2 || 'pro';
    const billingCycle = params.custom_str3 || 'monthly';

    if (paymentStatus !== 'COMPLETE') {
      // Update intent to failed/cancelled
      await supabase
        .from('payment_intents')
        .update({ status: paymentStatus.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', intentId);
      return new NextResponse('OK', { status: 200 });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Load intent for richer metadata (billing cycle + ad creative)
    const { data: intent } = await supabase
      .from('payment_intents')
      .select('id,user_id,payment_type,billing_cycle,ad_creative,metadata')
      .eq('id', intentId)
      .maybeSingle();

    const effectiveType = intent?.payment_type || paymentType;
    const effectiveCycle = intent?.billing_cycle || billingCycle;

    if (effectiveType === 'pro') {
      const subUntil = addMonths(now, effectiveCycle === 'yearly' ? 12 : 1).toISOString();
      const { error: vendorError } = await supabase
        .from('vendors')
        .update({
          subscription_tier: 'pro',
          subscription_status: 'active',
          subscription_expires_at: subUntil,
          plan: 'pro',
          plan_until: subUntil,
          updated_at: nowIso,
        })
        .eq('id', vendorId);

      if (vendorError) {
        console.error('Failed to update vendor pro subscription:', vendorError);
        return new NextResponse('DB error', { status: 500 });
      }
    }

    if (effectiveType === 'verification') {
      await supabase
        .from('verification_requests')
        .upsert({
          vendor_id: vendorId,
          user_id: intent?.user_id || null,
          amount_cents: Math.round(parseFloat(params.amount_gross || '0') * 100),
          status: 'paid_pending_review',
          payfast_payment_id: params.pf_payment_id,
          paid_at: nowIso,
          updated_at: nowIso,
        }, { onConflict: 'vendor_id' });

      await supabase
        .from('vendors')
        .update({
          verification_status: 'paid_pending_review',
          verification_paid_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', vendorId);
    }

    if (effectiveType === 'boost') {
      const boostEnd = addDays(now, 30).toISOString();
      const creative = intent?.ad_creative || intent?.metadata?.adCreative || null;

      await supabase
        .from('vendor_boosts')
        .insert({
          vendor_id: vendorId,
          status: 'active',
          amount_cents: Math.round(parseFloat(params.amount_gross || '0') * 100),
          ad_headline: creative?.headline || null,
          ad_body: creative?.body || null,
          ad_cta: creative?.cta || null,
          started_at: nowIso,
          ends_at: boostEnd,
          payfast_payment_id: params.pf_payment_id,
          created_at: nowIso,
          updated_at: nowIso,
        });

      await supabase
        .from('vendors')
        .update({
          featured: true,
          featured_until: boostEnd,
          updated_at: nowIso,
        })
        .eq('id', vendorId);
    }

    // Mark intent as complete
    await supabase
      .from('payment_intents')
      .update({
        status: 'complete',
        payfast_payment_id: params.pf_payment_id,
        updated_at: nowIso,
      })
      .eq('id', intentId);

    // Log the transaction
    await supabase.from('billing_transactions').insert({
      vendor_id: vendorId,
      plan: effectiveType,
      payment_type: effectiveType,
      billing_cycle: effectiveType === 'pro' ? effectiveCycle : null,
      amount_cents: Math.round(parseFloat(params.amount_gross || '0') * 100),
      payfast_payment_id: params.pf_payment_id,
      status: 'complete',
      created_at: nowIso,
    });

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
