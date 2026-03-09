import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

// Configure Supabase client to use cookies for better SSR/middleware compatibility
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Store session in localStorage (default) but also manually sync to cookies
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Storage for client-side - will use localStorage by default
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// Helper function to set auth cookies
function setAuthCookies(accessToken: string, refreshToken: string) {
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const secure = window.location.protocol === 'https:';
  const cookieOptions = `path=/; max-age=${maxAge}; samesite=lax${secure ? '; secure' : ''}`;
  
  document.cookie = `sb-access-token=${accessToken}; ${cookieOptions}`;
  document.cookie = `sb-refresh-token=${refreshToken}; ${cookieOptions}`;
}

// Helper function to clear auth cookies
function clearAuthCookies() {
  document.cookie = 'sb-access-token=; path=/; max-age=0';
  document.cookie = 'sb-refresh-token=; path=/; max-age=0';
}

// Sync auth state to cookies whenever it changes (for middleware compatibility)
if (typeof window !== 'undefined') {
  // Sync existing session to cookies on page load
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token && session?.refresh_token) {
      setAuthCookies(session.access_token, session.refresh_token);
    }
  });

  // Keep cookies in sync with auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token && session?.refresh_token) {
      setAuthCookies(session.access_token, session.refresh_token);
    } else if (event === 'SIGNED_OUT') {
      clearAuthCookies();
    }
  });
}


