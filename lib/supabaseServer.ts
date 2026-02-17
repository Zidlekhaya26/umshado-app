import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using SERVICE_ROLE key.
 * This bypasses RLS — use ONLY in API routes, NEVER in client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL env var');
  }

  // Prefer service role key for privileged server operations. If it's missing
  // fall back to the anon/public key for local development only and log a
  // warning so developers know to configure the service key for full tests.
  const keyToUse = serviceKey || anonKey;

  if (!keyToUse) {
    throw new Error('Missing SUPABASE env vars for service client');
  }

  if (!serviceKey && anonKey) {
    // eslint-disable-next-line no-console
    console.warn('[supabaseServer] SUPABASE_SERVICE_ROLE_KEY is missing; falling back to anon key for local development. This is less privileged — do not use in production.');
  }

  return createClient(url, keyToUse, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
