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
    const plan = params.custom_str2;

    if (paymentStatus !== 'COMPLETE') {
      // Update intent to failed/cancelled
      await supabase
        .from('payment_intents')
        .update({ status: paymentStatus.toLowerCase(), updated_at: new Date().toISOString() })
        .eq('id', intentId);
      return new NextResponse('OK', { status: 200 });
    }

    const now = new Date();
    const planUntil = addMonths(now, 1).toISOString();

    // Activate vendor plan
    const { error: vendorError } = await supabase
      .from('vendors')
      .update({
        plan,
        plan_until: planUntil,
        featured: plan === 'elite' || plan === 'pro',
        featured_until: plan === 'elite' ? planUntil : plan === 'pro' ? planUntil : null,
        updated_at: now.toISOString(),
      })
      .eq('id', vendorId);

    if (vendorError) {
      console.error('Failed to update vendor plan:', vendorError);
      return new NextResponse('DB error', { status: 500 });
    }

    // Mark intent as complete
    await supabase
      .from('payment_intents')
      .update({
        status: 'complete',
        payfast_payment_id: params.pf_payment_id,
        updated_at: now.toISOString(),
      })
      .eq('id', intentId);

    // Log the transaction
    await supabase.from('billing_transactions').insert({
      vendor_id: vendorId,
      plan,
      amount_cents: Math.round(parseFloat(params.amount_gross || '0') * 100),
      payfast_payment_id: params.pf_payment_id,
      status: 'complete',
      created_at: now.toISOString(),
    });

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
