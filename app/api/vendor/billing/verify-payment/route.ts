import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// One-time verification fee: R499
const VERIFICATION_AMOUNT = 49900; // cents
const VERIFICATION_LABEL = 'uMshado Business Verification';

function generateSignature(data: Record<string, string>, passphrase: string): string {
  const paramString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase
    ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : paramString;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { token } = body;

    let authedUser = null;
    const headerToken = req.headers.get('x-supabase-auth');
    const authToken = headerToken || token;

    if (authToken) {
      const { data } = await supabase.auth.getUser(authToken);
      authedUser = data.user;
    }

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, business_name, verified, verification_status')
      .eq('user_id', authedUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    if (vendor.verified) {
      return NextResponse.json({ error: 'Your business is already verified.' }, { status: 400 });
    }

    if (vendor.verification_status === 'paid_pending_review') {
      return NextResponse.json({ error: 'Your verification is already under review.' }, { status: 400 });
    }

    const merchantId = process.env.PAYFAST_MERCHANT_ID!;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY!;
    const passphrase = process.env.PAYFAST_PASSPHRASE || '';
    const isSandbox = process.env.PAYFAST_SANDBOX === 'true';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://umshado.co.za';

    // Create a verification_request record
    const { data: verRequest, error: verError } = await supabase
      .from('verification_requests')
      .insert({
        vendor_id: vendor.id,
        user_id: authedUser.id,
        status: 'payment_pending',
        amount_cents: VERIFICATION_AMOUNT,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (verError || !verRequest) {
      console.error('Failed to create verification request:', verError);
      return NextResponse.json({ error: 'Failed to initiate verification' }, { status: 500 });
    }

    const pfData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/vendor/billing?verified_return=1`,
      cancel_url: `${baseUrl}/vendor/billing?verify_cancelled=1`,
      notify_url: `${baseUrl}/api/vendor/billing/verify-webhook`,
      name_first: vendor.business_name || 'Vendor',
      name_last: '',
      email_address: authedUser.email || '',
      m_payment_id: verRequest.id,
      amount: (VERIFICATION_AMOUNT / 100).toFixed(2),
      item_name: VERIFICATION_LABEL,
      item_description: 'One-time fee for uMshado business verification review',
      custom_str1: vendor.id,
      custom_str2: 'verification',
      custom_str3: verRequest.id,
    };

    Object.keys(pfData).forEach((k) => { if (!pfData[k]) delete pfData[k]; });
    pfData.signature = generateSignature(pfData, passphrase);

    const payfastBase = isSandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    const queryString = Object.entries(pfData)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    return NextResponse.json({ redirectUrl: `${payfastBase}?${queryString}` });
  } catch (err) {
    console.error('verify-payment error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
