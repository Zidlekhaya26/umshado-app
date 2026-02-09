import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/live/link
 * Authenticated couple → returns or creates their guest link token.
 */
export async function GET(req: NextRequest) {
  // Extract the user's access token from Authorization header or cookie
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Create a Supabase client authenticated as this user
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const coupleId = user.id;

  // Try to find existing link
  const { data: existing } = await supabase
    .from('live_guest_links')
    .select('token')
    .eq('couple_id', coupleId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ token: existing.token });
  }

  // Create new link
  const { data: created, error: insertErr } = await supabase
    .from('live_guest_links')
    .insert({ couple_id: coupleId })
    .select('token')
    .single();

  if (insertErr) {
    // Conflict — race condition, re-fetch
    if (insertErr.code === '23505') {
      const { data: refetch } = await supabase
        .from('live_guest_links')
        .select('token')
        .eq('couple_id', coupleId)
        .single();
      if (refetch) return NextResponse.json({ token: refetch.token });
    }
    console.error('Error creating guest link:', insertErr);
    return NextResponse.json({ error: 'Failed to create guest link' }, { status: 500 });
  }

  return NextResponse.json({ token: created.token });
}
