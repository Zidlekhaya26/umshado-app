import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/vendor',
  '/couple',
  '/messages',
  '/notifications',
  '/settings',
  '/switch-role',
  '/admin',
  '/live',
];

// Routes that are always public
const PUBLIC_PREFIXES = [
  '/auth',
  '/api',
  '/marketplace',
  '/_next',
  '/favicon',
  '/logo',
  '/apple-touch',
  '/manifest',
  '/sw.js',
  '/default-avatar',
];

// Vendor-only routes
const VENDOR_PREFIXES = ['/vendor'];
// Couple-only routes
const COUPLE_PREFIXES = ['/couple'];
// Admin-only routes
const ADMIN_PREFIXES = ['/admin'];

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/v/')) return true; // public vendor profiles
  return PUBLIC_PREFIXES.some(p => pathname.startsWith(p));
}

function requiresAuth(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes bypass all checks
  if (isPublic(pathname)) return NextResponse.next();

  // Auth-required route — check session
  if (requiresAuth(pathname)) {
    const response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const loginUrl = new URL('/auth/sign-in', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin gate
    if (ADMIN_PREFIXES.some(p => pathname.startsWith(p))) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile?.is_admin) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next internals.
     * This pattern skips: _next/static, _next/image, favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
