'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

const ADMIN_VENDOR_ID = process.env.NEXT_PUBLIC_ADMIN_VENDOR_ID || '';

type VendorPlan = {
  plan?: string | null;
  plan_until?: string | null;
  featured?: boolean | null;
  featured_until?: string | null;
  business_name?: string | null;
};

export default function VendorBilling() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorPlan | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push('/auth/sign-in');
          return;
        }

        const { data: vendorByUser } = await supabase
          .from('vendors')
          .select('plan,plan_until,featured,featured_until,business_name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: vendorById } = await supabase
          .from('vendors')
          .select('plan,plan_until,featured,featured_until,business_name')
          .eq('id', user.id)
          .maybeSingle();

        setVendor(vendorByUser || vendorById || null);
      } catch (err) {
        console.error('Failed to load vendor plan:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleRequestFeatured = () => {
    const message = `Hi uMshado Admin, I'd like to request Featured status for my vendor profile.${vendor?.business_name ? `\n\nBusiness: ${vendor.business_name}` : ''}`;
    if (!ADMIN_VENDOR_ID) {
      alert('Admin vendor ID is not configured. Please set NEXT_PUBLIC_ADMIN_VENDOR_ID.');
      return;
    }
    router.push(`/messages/new?vendorId=${ADMIN_VENDOR_ID}&message=${encodeURIComponent(message)}`);
  };

  const planLabel = (vendor?.plan || 'free').toString();
  const planUntil = vendor?.plan_until ? new Date(vendor.plan_until).toLocaleDateString('en-ZA') : null;
  const featuredUntil = vendor?.featured_until ? new Date(vendor.featured_until).toLocaleDateString('en-ZA') : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-16 pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        <div className="bg-white border-b border-gray-200 px-4 py-5">
          <h1 className="text-xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your vendor plan and featured status</p>
        </div>

        <div className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          <div className="rounded-xl border-2 border-gray-200 p-4">
            <p className="text-xs text-gray-500">Current plan</p>
            <p className="text-lg font-bold text-gray-900 capitalize">{planLabel}</p>
            {planUntil && (
              <p className="text-xs text-gray-500 mt-1">Plan ends: {planUntil}</p>
            )}
            {vendor?.featured && featuredUntil && (
              <p className="text-xs text-purple-600 mt-1">Featured until: {featuredUntil}</p>
            )}
          </div>

          <div className="rounded-xl border-2 border-gray-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Featured benefits</h2>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Boosted visibility in Marketplace</li>
              <li>Priority placement in recommended results</li>
              <li>Highlighted badge on your profile</li>
            </ul>
          </div>

          <div className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
            <p className="text-sm text-purple-800 font-semibold">Request Featured</p>
            <p className="text-xs text-purple-700 mt-1">
              No payments yet. Send a request to uMshado Admin and we’ll activate your featured status.
            </p>
            <button
              onClick={handleRequestFeatured}
              className="mt-3 w-full bg-purple-600 text-white py-2.5 rounded-lg font-semibold hover:bg-purple-700"
            >
              Request Featured
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
