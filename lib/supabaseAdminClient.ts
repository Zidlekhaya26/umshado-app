import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Factory to obtain a server-only Supabase client using the service role key.
// This avoids creating the client at module import time so tests or environments
// without service keys won't fail just by importing the module.
export function getAdminSupabase(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL environment variable for admin client');
  }
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable for admin client');
  }

  return createClient(supabaseUrl, serviceKey);
}

export default getAdminSupabase;
