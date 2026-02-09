'use client';
export const dynamic = 'force-dynamic';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SwitchRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target = searchParams?.get('target');
    const url = target ? `/settings?target=${encodeURIComponent(target)}` : '/settings';
    router.replace(url);
  }, [router, searchParams]);

  return <div className="p-6">Redirecting…</div>;
}

export default function SwitchRolePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div></div>}>
      <SwitchRoleContent />
    </Suspense>
  );
}
