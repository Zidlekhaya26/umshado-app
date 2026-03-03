'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import VendorBottomNav from '@/components/VendorBottomNav';

type VendorPlan = {
  id?: string | null;
  plan?: string | null;
  plan_until?: string | null;
  featured?: boolean | null;
  featured_until?: string | null;
  business_name?: string | null;
  email?: string | null;
  verified?: boolean | null;
  verification_status?: string | null;
};

type PlanKey = 'starter' | 'pro' | 'elite';

const PLANS = [
  {
    key: 'starter' as PlanKey,
    label: 'Starter',
    price: 299,
    priceLabel: 'R299/mo',
    badge: null,
    features: [
      'Up to 3 packages',
      'Basic 7-day insights',
      'WhatsApp reply button on profile',
      'Marketplace listing',
    ],
    highlight: false,
  },
  {
    key: 'pro' as PlanKey,
    label: 'Pro',
    price: 699,
    priceLabel: 'R699/mo',
    badge: 'Most Popular',
    features: [
      'Unlimited packages',
      '30-day insights dashboard',
      'Featured badge on profile',
      'Priority quote sorting',
      'Quote analytics',
    ],
    highlight: true,
  },
  {
    key: 'elite' as PlanKey,
    label: 'Elite',
    price: 1299,
    priceLabel: 'R1,299/mo',
    badge: null,
    features: [
      'Everything in Pro',
      'Top-of-category placement',
      'Verified badge',
      'Monthly promotional boosts',
      'Dedicated support',
    ],
    highlight: false,
  },
];

export default function VendorBilling() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<PlanKey | null>(null);
  const [requestingVerify, setRequestingVerify] = useState(false);
  const [vendor, setVendor] = useState<VendorPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) { router.push('/auth/sign-in'); return; }

        const { data: vendorByUser } = await supabase
          .from('vendors')
          .select('id,plan,plan_until,featured,featured_until,business_name,verified,verification_status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: vendorById } = await supabase
          .from('vendors')
          .select('id,plan,plan_until,featured,featured_until,business_name,verified,verification_status')
          .eq('id', user.id)
          .maybeSingle();

        const v = vendorByUser || vendorById || null;
        setVendor(v ? { ...v, email: user.email } : { email: user.email });
      } catch (err) {
        console.error(err);
        setError('Failed to load billing info. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleUpgrade = async (planKey: PlanKey) => {
    setPaying(planKey);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/billing/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-auth': session?.access_token || '',
        },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment initiation failed');
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setPaying(null);
    }
  };

  const handleRequestVerification = async () => {
    setRequestingVerify(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/vendor/billing/verify-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-auth': session?.access_token || '',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not initiate verification');
      window.location.href = data.redirectUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setRequestingVerify(false);
    }
  };

  const currentPlan = (vendor?.plan || 'free').toLowerCase();
  const planUntil = vendor?.plan_until ? new Date(vendor.plan_until).toLocaleDateString('en-ZA') : null;
  const featuredUntil = vendor?.featured_until ? new Date(vendor.featured_until).toLocaleDateString('en-ZA') : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading billing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+80px)]">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Upgrade to unlock more features and visibility</p>
        </div>

        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {/* Current plan status */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm uppercase">
              {currentPlan[0]}
            </div>
            <div>
              <p className="text-xs text-gray-500">Current plan</p>
              <p className="font-bold text-gray-900 capitalize">{currentPlan}</p>
              {planUntil && <p className="text-xs text-gray-400">Renews {planUntil}</p>}
              {vendor?.featured && featuredUntil && (
                <p className="text-xs text-purple-600">Featured until {featuredUntil}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {PLANS.map((plan) => {
            const isActive = currentPlan === plan.key;
            const isLoading = paying === plan.key;
            const borderClass = plan.highlight ? 'border-purple-500' : isActive ? 'border-green-400' : 'border-gray-200';
            const bgClass = plan.highlight ? 'bg-purple-50' : 'bg-white';

            return (
              <div key={plan.key} className={`rounded-xl border-2 p-4 relative ${borderClass} ${bgClass}`}>
                {plan.badge && (
                  <span className="absolute -top-3 left-4 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-lg text-gray-900">{plan.label}</p>
                    <p className="text-2xl font-extrabold text-gray-900">{plan.priceLabel}</p>
                  </div>
                  {isActive && (
                    <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full self-start">
                      Active
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-purple-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={isActive || paying !== null}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    isActive
                      ? 'bg-gray-100 text-gray-400 cursor-default'
                      : plan.highlight
                      ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                      : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50'
                  }`}
                >
                  {isLoading ? 'Redirecting to PayFast...' : isActive ? 'Current Plan' : `Upgrade to ${plan.label}`}
                </button>
              </div>
            );
          })}

          <div className="rounded-xl bg-white border border-gray-100 p-4 flex items-center gap-3">
            <div className="text-2xl">🔒</div>
            <div>
              <p className="text-xs font-semibold text-gray-800">Secured by PayFast</p>
              <p className="text-xs text-gray-500">SA&apos;s leading payment gateway. EFT, cards & instant pay.</p>
            </div>
          </div>

          {/* ── Verification Card ─────────────────────── */}
          <div className={`rounded-xl border-2 p-4 ${
            vendor?.verified
              ? 'border-blue-300 bg-blue-50'
              : vendor?.verification_status === 'paid_pending_review'
              ? 'border-amber-300 bg-amber-50'
              : 'border-gray-200 bg-white'
          }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-bold text-lg text-gray-900">Business Verification</p>
                <p className="text-sm text-gray-600 mt-0.5">R499 one-time fee</p>
              </div>
              {vendor?.verified && (
                <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full self-start">
                  ✓ Verified
                </span>
              )}
              {vendor?.verification_status === 'paid_pending_review' && (
                <span className="bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full self-start">
                  ⏳ Reviewing
                </span>
              )}
            </div>

            <ul className="space-y-1.5 mb-4">
              {[
                'Manual review by the uMshado team',
                'Blue ✓ Verified badge on your profile',
                'Higher trust & conversion from couples',
                'Priority placement in search results',
                'One-time payment — badge is permanent',
              ].map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {vendor?.verified ? (
              <div className="text-center py-2 text-sm text-blue-700 font-semibold">
                ✓ Your business is verified
              </div>
            ) : vendor?.verification_status === 'paid_pending_review' ? (
              <div className="bg-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800 text-center">
                Payment received. The uMshado team is reviewing your profile — usually within 48 hours.
              </div>
            ) : (
              <button
                onClick={handleRequestVerification}
                disabled={requestingVerify || paying !== null}
                className="w-full py-2.5 rounded-lg font-semibold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {requestingVerify ? 'Redirecting to PayFast...' : 'Apply for Verification — R499'}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 pb-4">
            Cancel anytime. Plans renew monthly. No hidden fees.
          </p>
        </div>
      </div>
      <VendorBottomNav />
    </div>
  );
}
