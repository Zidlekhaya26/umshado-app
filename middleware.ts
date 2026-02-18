import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BETA_INVITE_ONLY = process.env.NEXT_PUBLIC_BETA_INVITE_ONLY === 'true';

async function fetchUserFromToken(token: string) {
  if (!SUPABASE_URL) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON || ''
      }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

async function fetchProfileState(userId: string, accessToken: string) {
  if (!SUPABASE_URL) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?select=role,active_role,has_couple,has_vendor&id=eq.${userId}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON || '',
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (!res.ok) return null;
    const arr = await res.json();
    return Array.isArray(arr) && arr[0] ? arr[0] : null;
  } catch (err) {
    return null;
  }
}

async function updateActiveRole(userId: string, accessToken: string, activeRole: 'couple' | 'vendor') {
  if (!SUPABASE_URL) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ active_role: activeRole })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Explicit public vendor profile route: always allow access to /v/*
  if (pathname.startsWith('/v')) {
    return NextResponse.next();
  }

  // ── PUBLIC ROUTES: never gate these ──
  const publicPaths = ['/', '/auth', '/request-access', '/debug'];
  const isPublic =
    publicPaths.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api');

  // ── BETA GATE: block sign-up routes when invite-only ──
  // Allow through if the user has an invite token in the URL
  if (BETA_INVITE_ONLY) {
    if (pathname === '/auth/sign-up' || pathname === '/auth/register') {
      const inviteToken = req.nextUrl.searchParams.get('invite');
      if (!inviteToken) {
        return NextResponse.redirect(new URL('/request-access', req.url));
      }
      // Has invite token — let them through to the sign-up page
      // (the page itself will validate the token)
      return NextResponse.next();
    }
  }

  // ── ADMIN ROUTES ──
  // Let /admin pages load — auth + admin-email checks are enforced
  // inside the API route (server-side) and the page itself (client-side).
  // This avoids cookie-format mismatches in edge middleware.
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Only enforce role checking for vendor and couple routes
  if (!pathname.startsWith('/vendor') && !pathname.startsWith('/couple')) {
    return NextResponse.next();
  }

  // Allow onboarding pages without authentication checks to prevent redirect loops
  if (pathname === '/vendor/onboarding' || pathname === '/couple/onboarding') {
    return NextResponse.next();
  }

  // Try to locate an access token cookie commonly used by Supabase clients
  const cookieNames = ['sb-access-token', 'sb:token', 'supabase-auth-token', 'sb-session'];
  let accessToken: string | null = null;
  for (const name of cookieNames) {
    const c = req.cookies.get(name);
    if (c?.value) {
      accessToken = c.value;
      break;
    }
  }

  // If no token, redirect to sign-in preserving intended path
  if (!accessToken) {
    const signInUrl = new URL('/auth/sign-in', req.url);
    signInUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  const user = await fetchUserFromToken(accessToken);
  if (!user || !user.id) {
    const signInUrl = new URL('/auth/sign-in', req.url);
    signInUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  const profile = await fetchProfileState(user.id, accessToken);
  if (!profile) {
    // If no role/profile found, send to onboarding depending on path
    if (pathname.startsWith('/vendor')) return NextResponse.redirect(new URL('/vendor/onboarding', req.url));
    if (pathname.startsWith('/couple')) return NextResponse.redirect(new URL('/couple/onboarding', req.url));
  }

  const activeRole = profile?.active_role || profile?.role || null;
  const hasCouple = !!profile?.has_couple;
  const hasVendor = !!profile?.has_vendor;

  const targetRole: 'couple' | 'vendor' = pathname.startsWith('/vendor') ? 'vendor' : 'couple';

  if (activeRole && activeRole !== targetRole) {
    const onlyHasCouple = hasCouple && !hasVendor;
    const onlyHasVendor = hasVendor && !hasCouple;
    if (onlyHasCouple || onlyHasVendor) {
      const nextRole = onlyHasCouple ? 'couple' : 'vendor';
      await updateActiveRole(user.id, accessToken, nextRole);
      const dashboardUrl = new URL(nextRole === 'couple' ? '/couple/dashboard' : '/vendor/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }

    const settingsUrl = new URL('/settings', req.url);
    settingsUrl.searchParams.set('target', targetRole);
    return NextResponse.redirect(settingsUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/vendor/:path*', '/couple/:path*', '/auth/sign-up', '/auth/register', '/admin/:path*']
};
