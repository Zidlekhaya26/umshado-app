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

      // Redeem invite token if present (Google OAuth flow passes it via redirect URL)
      const inviteToken = searchParams?.get('invite_token');
      if (inviteToken && session.access_token) {
        try {
          await fetch('/api/invite/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ token: inviteToken }),
          });
        } catch { /* non-fatal */ }
      }

      // Read role from URL param → localStorage → user_metadata (survives Safari ITP)
      const role = searchParams?.get('role');
      let intendedRole: 'vendor' | 'couple' | null = role === 'vendor' ? 'vendor' : role === 'couple' ? 'couple' : null;
      if (!intendedRole) {
        try {
          const stored = localStorage.getItem('umshado_intended_role');
          if (stored === 'vendor' || stored === 'couple') intendedRole = stored;
        } catch {}
      }
      if (!intendedRole) {
        const meta = session.user?.user_metadata?.intended_role;
        if (meta === 'vendor' || meta === 'couple') intendedRole = meta;
      }
      // Clear localStorage after consuming so it doesn't affect future sign-ins
      try { localStorage.removeItem('umshado_intended_role'); } catch {}

      // For Google OAuth users, persist intended role to user_metadata so it
      // survives across browsers (email confirmation opening in Safari etc.)
      if (intendedRole && !session.user?.user_metadata?.intended_role) {
        try { await supabase.auth.updateUser({ data: { intended_role: intendedRole } }); } catch {}
      }

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
        let intendedRole: 'vendor' | 'couple' | null = role === 'vendor' ? 'vendor' : role === 'couple' ? 'couple' : null;
        if (!intendedRole) {
          try {
            const stored = localStorage.getItem('umshado_intended_role');
            if (stored === 'vendor' || stored === 'couple') intendedRole = stored;
          } catch {}
        }
        if (!intendedRole) {
          const meta = session.user?.user_metadata?.intended_role;
          if (meta === 'vendor' || meta === 'couple') intendedRole = meta;
        }
        try { localStorage.removeItem('umshado_intended_role'); } catch {}

        if (intendedRole && !session.user?.user_metadata?.intended_role) {
          try { await supabase.auth.updateUser({ data: { intended_role: intendedRole } }); } catch {}
        }

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
