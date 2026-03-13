import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Helper: read a single cookie value by name
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// Custom storage that writes to both localStorage AND cookies.
// Cookies are the fallback: if localStorage is cleared when the user
// reopens the app, we restore the session from the cookie instead of
// forcing a re-login.
const dualStorage: SupportedStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    // Primary source: localStorage (fastest, no size limit)
    const local = window.localStorage.getItem(key);
    if (local) return local;
    // Fallback: cookie mirror (survives browser-close/app-reopen when
    // localStorage is evicted or cleared by the OS/browser)
    const cookieVal = readCookie('sb-session-store');
    if (cookieVal) {
      // Restore into localStorage so future reads are fast
      try { window.localStorage.setItem(key, cookieVal); } catch {}
      return cookieVal;
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);

    const maxAge = 60 * 60 * 24 * 365; // 1 year
    const secure = window.location.protocol === 'https:';
    const opts = `path=/; max-age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;

    // Mirror the full session value so we can restore on app reopen.
    // We encode it because the JWT contains characters invalid in cookies.
    document.cookie = `sb-session-store=${encodeURIComponent(value)}; ${opts}`;

    // Also keep the bare access-token cookie for middleware reads
    try {
      const data = JSON.parse(value);
      if (data?.access_token) {
        document.cookie = `sb-access-token=${data.access_token}; ${opts}`;
      }
      if (data?.refresh_token) {
        document.cookie = `sb-refresh-token=${data.refresh_token}; ${opts}`;
      }
    } catch {
      // value isn't JSON (e.g. a code verifier string) — skip
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    const expired = 'path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `sb-session-store=; ${expired}`;
    document.cookie = `sb-access-token=; ${expired}`;
    document.cookie = `sb-refresh-token=; ${expired}`;
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? dualStorage : undefined,
  },
});


