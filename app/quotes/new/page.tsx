'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams?.toString() || '';
    router.replace(params ? '/quotes/summary?' + params : '/marketplace');
  }, [router, searchParams]);

  return null;
}

export default function QuotesNewRedirect() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="mx-auto w-full max-w-md lg:max-w-6xl lg:px-6 bg-white shadow-lg rounded-xl p-8 text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Redirecting...</p>
        <Suspense>
          <RedirectHandler />
        </Suspense>
      </div>
    </div>
  );
}
