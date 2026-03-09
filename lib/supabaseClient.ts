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
  try {
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    
    // For mobile: on HTTP, omit SameSite to allow default browser behavior
    // On HTTPS, use SameSite=Lax with Secure for security
    let cookieOptions: string;
    if (isSecure) {
      cookieOptions = `path=/; max-age=${maxAge}; samesite=lax; secure`;
    } else {
      // HTTP: no SameSite or Secure (for local dev on mobile)
      cookieOptions = `path=/; max-age=${maxAge}`;
    }
    
    // Set multiple cookie names for compatibility with different scenarios
    document.cookie = `sb-access-token=${accessToken}; ${cookieOptions}`;
    document.cookie = `sb-refresh-token=${refreshToken}; ${cookieOptions}`;
    document.cookie = `supabase.auth.token=${accessToken}; ${cookieOptions}`;
    
    // Store in localStorage as backup (primary storage for mobile)
    try {
      localStorage.setItem('sb-access-token', accessToken);
      localStorage.setItem('sb-refresh-token', refreshToken);
    } catch (e) {
      // Ignore localStorage errors (might be disabled)
    }
  } catch (error) {
    console.warn('[supabaseClient] Failed to set auth cookies:', error);
  }
}

// Helper function to clear auth cookies
function clearAuthCookies() {
  document.cookie = 'sb-access-token=; path=/; max-age=0';
  document.cookie = 'sb-refresh-token=; path=/; max-age=0';
  document.cookie = 'supabase.auth.token=; path=/; max-age=0';
  
  // Also clear localStorage
  try {
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
  } catch (e) {
    // Ignore
  }
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


