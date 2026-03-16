import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

// createBrowserClient stores the session in cookies (not localStorage).
// Cookies are sent with every request and are far more reliable than
// localStorage in PWAs — they survive app close/reopen on iOS and Android.
// The middleware refreshes the access token server-side before pages run,
// so getUser() in any page always sees a fresh, valid token.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
