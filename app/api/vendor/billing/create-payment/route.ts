import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

type BillingType = 'pro' | 'verification' | 'boost';
type BillingCycle = 'monthly' | 'yearly';

const PRICE_CENTS = {
  pro: { monthly: 4999, yearly: 49900 },
  verification: 9900,
  boost: 19900,
} as const;

const ITEM_LABELS = {
  pro: 'uMshado Pro Subscription',
  verification: 'uMshado Business Verification (One-time)',
  boost: 'uMshado Marketplace & Community Boost (30 days)',
} as const;

function getBillingAmount(type: BillingType, cycle: BillingCycle): number {
  if (type === 'pro') return PRICE_CENTS.pro[cycle];
  if (type === 'verification') return PRICE_CENTS.verification;
  return PRICE_CENTS.boost;
}

function resolveAuthToken(req: NextRequest, bodyToken?: string): string | undefined {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return req.headers.get('x-supabase-auth') || bodyToken;
}

function generateSignature(data: Record<string, string>, passphrase: string): string {
  // Build query string from ordered params
  const paramString = Object.entries(data)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, '+')}`)
    .join('&');
  const withPassphrase = passphrase ? `${paramString}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}` : paramString;
  return crypto.createHash('md5').update(withPassphrase).digest('hex');
}

const CreatePaymentSchema = z.object({
  type: z.enum(['pro', 'verification', 'boost']).optional(),
  plan: z.enum(['pro', 'verification', 'boost']).optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  adCreative: z.object({
    headline: z.string().max(100).optional(),
    body: z.string().max(300).optional(),
    cta: z.string().max(100).optional(),
  }).optional().nullable(),
  token: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Parse and validate body — invalid enum values return 400 instead of silently coercing
    const { data: body, error: bodyError } = await validateBody(req, CreatePaymentSchema);
    if (bodyError) return bodyError;
    const rawType = body.type || body.plan; // backward compat: 'plan' alias still accepted
    const type: BillingType = rawType ?? 'pro';
    const billingCycle: BillingCycle = body.billingCycle ?? 'monthly';
    const adCreative = body.adCreative ?? null;

    const authToken = resolveAuthToken(req, body.token);
    const { data: { user: authedUser } } = await supabase.auth.getUser(authToken);

    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get vendor
    const { data: vendor } = await supabase
      .from('vendors')
      .select('id, business_name, subscription_tier, subscription_status, verified')
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
    const amountCents = getBillingAmount(type, billingCycle);

    // Create a payment_intent record in Supabase for tracking
    const { data: intent, error: intentError } = await supabase
      .from('payment_intents')
      .insert({
        vendor_id: vendor.id,
        user_id: authedUser.id,
        payment_type: type,
        plan: type,
        billing_cycle: type === 'pro' ? billingCycle : null,
        amount_cents: amountCents,
        status: 'pending',
        ad_creative: type === 'boost' ? adCreative : null,
        metadata: type === 'boost' ? { adCreative } : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
      amount: (amountCents / 100).toFixed(2),
      item_name: ITEM_LABELS[type],
      item_description:
        type === 'pro'
          ? `uMshado Pro ${billingCycle} subscription`
          : type === 'verification'
            ? 'One-time business verification payment'
            : '30-day sponsored marketplace/community boost',
      custom_str1: vendor.id,
      custom_str2: type,
      custom_str3: type === 'pro' ? billingCycle : '',
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
