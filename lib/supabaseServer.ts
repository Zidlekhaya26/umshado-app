import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using SERVICE_ROLE key.
 * This bypasses RLS — use ONLY in API routes, NEVER in client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE env vars for service client');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
