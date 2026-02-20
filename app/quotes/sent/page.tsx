'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

function QuoteSentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const vendorId = searchParams.get('vendorId') || '';

  const [quoteRef] = useState('UMQ-2026-094772');
  const [vendor, setVendor] = useState<{ id: string; name: string } | null>(null);
  const [packageName] = useState('Premium Package');

  useEffect(() => {
    (async () => {
      if (!vendorId) return;
      const uuidStrict = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
      if (!uuidStrict.test(vendorId)) return;
      try {
        const { data, error } = await supabase.from('vendors').select('id, business_name').eq('id', vendorId).maybeSingle();
        if (error) {
          console.error('Error fetching vendor for quote sent:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
          setVendor(null);
        } else if (data) {
          setVendor({ id: data.id, name: data.business_name || '' });
        }
      } catch (err) {
        console.error('Unexpected error fetching vendor for quote sent:', err);
      }
    })();
  }, [vendorId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first container wrapper */}
      <div className="w-full max-w-none md:max-w-screen-xl md:mx-auto min-h-[100svh] flex flex-col pb-[calc(env(safe-area-inset-bottom)+80px)] px-4">
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Title and Subtitle */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Quote Sent!</h1>
          <p className="text-sm text-gray-600 text-center max-w-sm mb-8">
            The vendor has received your request. You can now chat and share details, documents, and images.
          </p>

          {/* Quote Reference Card */}
          <div className="w-full bg-purple-50 border-2 border-purple-200 rounded-xl px-4 py-4 mb-6">
            <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">Quote Reference</p>
            <p className="text-lg font-bold text-gray-900 font-mono">{quoteRef}</p>
            <div className="mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs text-gray-600 mb-1">Vendor: <span className="font-semibold text-gray-900">{vendor ? vendor.name : 'Vendor not found'}</span></p>
              <p className="text-xs text-gray-600">Package: <span className="font-semibold text-gray-900">{packageName}</span></p>
            </div>
          </div>

          {/* CTAs */}
          <div className="w-full space-y-3 mb-6">
            <Link
              href={vendor ? `/messages/new?vendorId=${vendor.id}` : '/messages/new'}
              className="block w-full px-4 py-3.5 bg-purple-600 text-white rounded-xl font-semibold text-base text-center hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200"
            >
              Message Vendor
            </Link>
            <Link
              href="/marketplace"
              className="block w-full px-4 py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-base text-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Back to Marketplace
            </Link>
          </div>

          {/* Tip Card */}
          <div className="w-full bg-blue-50 border border-blue-200 rounded-xl px-4 py-3.5">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-900 mb-1">💡 Tip</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Keep all communication on uMshado for quick quoting and easy file sharing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuoteSent() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <QuoteSentContent />
    </Suspense>
  );
}
