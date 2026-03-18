import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BETA_INVITE_ONLY = process.env.NEXT_PUBLIC_BETA_INVITE_ONLY === 'true';

async function fetchProfileState(userId: string, accessToken: string) {
  if (!SUPABASE_URL) return null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?select=role,active_role,has_couple,has_vendor&id=eq.${userId}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    return Array.isArray(arr) && arr[0] ? arr[0] : null;
  } catch { return null; }
}

async function updateActiveRole(userId: string, accessToken: string, activeRole: 'couple' | 'vendor') {
  if (!SUPABASE_URL) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ active_role: activeRole }),
    });
    return res.ok;
  } catch { return false; }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── PUBLIC ROUTES: never gate ──────────────────────────────────────────────
  const publicPaths = ['/', '/auth', '/request-access', '/debug'];
  const isPublic =
    publicPaths.some(p => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api');

  // ── BETA GATE ──────────────────────────────────────────────────────────────
  if (BETA_INVITE_ONLY) {
    if (pathname === '/auth/sign-up' || pathname === '/auth/register') {
      const inviteToken = req.nextUrl.searchParams.get('invite');
      if (!inviteToken) return NextResponse.redirect(new URL('/request-access', req.url));
      return NextResponse.next();
    }
  }

  // ── Only enforce auth + role for /vendor/*, /couple/*, /admin/* ──────────
  const needsAuth =
    pathname.startsWith('/vendor') ||
    pathname.startsWith('/couple') ||
    pathname.startsWith('/admin');
  if (!needsAuth) return NextResponse.next();

  // Onboarding pages: no auth check (avoid redirect loops)
  if (pathname === '/vendor/onboarding' || pathname === '/couple/onboarding') {
    return NextResponse.next();
  }

  // ── SESSION REFRESH ────────────────────────────────────────────────────────
  // Create an SSR Supabase client that reads the session from request cookies
  // and writes the refreshed session back to response cookies.
  // This is the key: every protected-route request automatically refreshes
  // the access token server-side so client JS always sees a valid token.
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // req.cookies.set only accepts (name, value) — options go on the response
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          // Enforce SameSite=Lax on all Supabase session cookies for CSRF resistance.
          // Note: httpOnly is intentionally NOT forced here — createBrowserClient needs
          // to read auth token cookies from document.cookie on the client side.
          response.cookies.set(name, value, { ...options, sameSite: 'lax' })
        );
      },
    },
  });

  // getUser() validates AND refreshes the token — never use getSession() here
  // as it can return stale tokens that bypass Row Level Security.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // No valid session — pass through; client-side will handle redirect if needed.
    return response;
  }

  // ── ROLE-BASED ROUTING ─────────────────────────────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  const profile = await fetchProfileState(user.id, accessToken);

  // ── ADMIN GATE ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return response;
  }

  if (!profile) {
    if (pathname.startsWith('/vendor')) return NextResponse.redirect(new URL('/vendor/onboarding', req.url));
    if (pathname.startsWith('/couple')) return NextResponse.redirect(new URL('/couple/onboarding', req.url));
  }

  const activeRole  = profile?.active_role || profile?.role || null;
  const hasCouple   = !!profile?.has_couple;
  const hasVendor   = !!profile?.has_vendor;
  const targetRole: 'couple' | 'vendor' = pathname.startsWith('/vendor') ? 'vendor' : 'couple';

  if (activeRole && activeRole !== targetRole) {
    const onlyHasCouple = hasCouple && !hasVendor;
    const onlyHasVendor = hasVendor && !hasCouple;
    if (onlyHasCouple || onlyHasVendor) {
      const nextRole = onlyHasCouple ? 'couple' : 'vendor';
      await updateActiveRole(user.id, accessToken, nextRole);
      return NextResponse.redirect(
        new URL(nextRole === 'couple' ? '/couple/dashboard' : '/vendor/dashboard', req.url)
      );
    }
    const switchUrl = new URL('/switch-role', req.url);
    switchUrl.searchParams.set('target', targetRole);
    return NextResponse.redirect(switchUrl);
  }

  return response;
}

export const config = {
  matcher: ['/vendor/:path*', '/couple/:path*', '/auth/sign-up', '/auth/register', '/admin/:path*'],
};
