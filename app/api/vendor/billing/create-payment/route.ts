import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// PayFast plan amounts in ZAR cents (PayFast uses integers)
const PLAN_AMOUNTS: Record<string, number> = {
  starter: 29900,
  pro: 69900,
  elite: 129900,
};

const PLAN_LABELS: Record<string, string> = {
  starter: 'uMshado Starter Plan',
  pro: 'uMshado Pro Plan',
  elite: 'uMshado Elite Plan',
};

function generateSignature(data: Record<string, string>, passphrase: string): string {
  // Build query string from ordered params
  const paramString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : paramString;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auth check
    const authHeader = req.headers.get('authorization') || req.headers.get('cookie') || '';
    // Use supabase auth from cookie
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('x-supabase-auth') || undefined
    );

    // Fallback: parse from request body if token passed
    const body = await req.json();
    const { plan, token } = body;

    let authedUser = user;
    if (!authedUser && token) {
      const { data } = await supabase.auth.getUser(token);
      authedUser = data.user;
    }

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!plan || !PLAN_AMOUNTS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get vendor
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, business_name, plan')
      .eq('user_id', authedUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    const merchantId = process.env.PAYFAST_MERCHANT_ID!;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY!;
    const passphrase = process.env.PAYFAST_PASSPHRASE || '';
    const isSandbox = process.env.PAYFAST_SANDBOX === 'true';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://umshado.co.za';

    // Create a payment_intent record in Supabase for tracking
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        vendor_id: vendor.id,
        user_id: authedUser.id,
        plan,
        amount_cents: PLAN_AMOUNTS[plan],
        status: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (intentError || !intent) {
      console.error('Failed to create payment intent:', intentError);
      return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
    }

    const pfData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/api/vendor/billing/success?intent=${intent.id}`,
      cancel_url: `${baseUrl}/vendor/billing?cancelled=1`,
      notify_url: `${baseUrl}/api/vendor/billing/webhook`,
      name_first: vendor.business_name || 'Vendor',
      name_last: '',
      email_address: authedUser.email || '',
      m_payment_id: intent.id,
      amount: (PLAN_AMOUNTS[plan] / 100).toFixed(2),
      item_name: PLAN_LABELS[plan],
      item_description: `Monthly subscription for ${PLAN_LABELS[plan]}`,
      custom_str1: vendor.id,
      custom_str2: plan,
    };

    // Remove empty values
    Object.keys(pfData).forEach((k) => {
      if (!pfData[k]) delete pfData[k];
    });

    pfData.signature = generateSignature(pfData, passphrase);

    const payfastBase = isSandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    const queryString = Object.entries(pfData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    return NextResponse.json({ redirectUrl: `${payfastBase}?${queryString}` });
  } catch (err) {
    console.error('create-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
