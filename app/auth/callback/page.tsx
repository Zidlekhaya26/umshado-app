'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getPostAuthRedirect, setAuthCookies } from '@/lib/authRouting';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    // Use onAuthStateChange to reliably catch the session after OAuth redirect
    // This avoids the race condition where getSession() returns null before
    // the Supabase client has processed the URL hash fragment.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle SIGNED_IN or INITIAL_SESSION events, and only once
      if (handled.current) return;
      if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
      if (!session) return;

      handled.current = true;

      setAuthCookies(session);

      const role = searchParams?.get('role');
      const intendedRole = role === 'vendor' ? 'vendor' : role === 'couple' ? 'couple' : null;

      // Check if there's a specific redirect path from sign-in
      const redirectParam = searchParams?.get('redirect');
      if (redirectParam && (redirectParam.startsWith('/couple') || redirectParam.startsWith('/vendor'))) {
        router.push(redirectParam);
        return;
      }

      const redirect = await getPostAuthRedirect(intendedRole);
      router.push(redirect);
    });

    // Fallback: if no auth event fires within 5 seconds, try getSession directly
    const timeout = setTimeout(async () => {
      if (handled.current) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        handled.current = true;
        setAuthCookies(session);

        const role = searchParams?.get('role');
        const intendedRole = role === 'vendor' ? 'vendor' : role === 'couple' ? 'couple' : null;

        const redirectParam = searchParams?.get('redirect');
        if (redirectParam && (redirectParam.startsWith('/couple') || redirectParam.startsWith('/vendor'))) {
          router.push(redirectParam);
          return;
        }

        const redirect = await getPostAuthRedirect(intendedRole);
        router.push(redirect);
      } else {
        // No session at all — send back to sign-in
        router.push('/auth/sign-in');
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, searchParams]);

  return null;
}

export default function AuthCallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Setting up your account...</p>
        <Suspense>
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
