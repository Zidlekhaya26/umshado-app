import type { NextRequest } from 'next/server';

export interface CallerUser {
  id: string;
  email: string | null;
}

/**
 * Extracts and validates the caller's JWT from an API request.
 * Returns the authenticated user, or null if the token is missing/invalid.
 *
 * Usage in API routes:
 *   const caller = await getCallerUser(req);
 *   if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */
export async function getCallerUser(req: NextRequest): Promise<CallerUser | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) return null;

  // 1. Authorization header (preferred)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  let token: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // 2. Fallback: Supabase SSR cookie (for server-rendered requests)
  if (!token) {
    const cookieNames = ['sb-access-token', 'sb:token'];
    for (const name of cookieNames) {
      const c = req.cookies.get(name);
      if (c?.value) { token = c.value; break; }
    }
  }

  if (!token) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return { id: user.id, email: user.email?.toLowerCase() ?? null };
  } catch {
    return null;
  }
}
