import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Custom storage that writes to both localStorage AND cookies
// This ensures: 1) session persists on reload, 2) middleware can read auth state
const dualStorage: SupportedStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    // Write to localStorage for persistence
    window.localStorage.setItem(key, value);
    
    // Also write access token to cookie for middleware
    try {
      const data = JSON.parse(value);
      if (data?.access_token) {
        document.cookie = `sb-access-token=${data.access_token}; path=/; max-age=31536000; SameSite=Lax; Secure`;
      }
    } catch {
      // Not JSON or no access_token, skip cookie
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    // Clear the cookie too
    document.cookie = 'sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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


