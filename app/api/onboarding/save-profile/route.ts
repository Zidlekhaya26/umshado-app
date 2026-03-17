import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import getAdminSupabase from '@/lib/supabaseAdminClient';

// userId / user_id are intentionally excluded — ownership is derived from the auth token.
const SaveProfileSchema = z.object({
  wedding_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'wedding_date must be YYYY-MM-DD').nullable().optional(),
  wedding_venue: z.string().max(500).nullable().optional(),
});

/**
 * POST /api/onboarding/save-profile
 * Auth: Bearer token required. Ownership resolved from token — body userId is ignored.
 * Body: { wedding_date?: string|null, wedding_venue?: string|null }
 * Upserts the authenticated user's profile record.
 */
export async function POST(req: NextRequest) {
  // --- Auth: resolve user from Bearer token ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.log(JSON.stringify({ event: 'save_profile_unauthorized', reason: 'missing_bearer' }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
  });

  if (!userRes.ok) {
    console.log(JSON.stringify({ event: 'save_profile_unauthorized', reason: 'invalid_token' }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authedUser = await userRes.json();
  const userId = authedUser?.id;
  if (!userId) {
    console.log(JSON.stringify({ event: 'save_profile_unauthorized', reason: 'no_user_id' }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Parse body (profile fields only — userId comes from token above) ---
  const { data: body, error: bodyError } = await validateBody(req, SaveProfileSchema);
  if (bodyError) return bodyError;

  const wedding_date = body.wedding_date ?? null;
  const wedding_venue = body.wedding_venue ?? null;

  try {
    const supabase = getAdminSupabase();
    const res = await supabase
      .from('profiles')
      .upsert(
        { id: userId, wedding_date: wedding_date || null, wedding_venue: wedding_venue || null },
        { onConflict: 'id' }
      );

    if ((res as any).error) {
      console.error('Failed to upsert profile:', (res as any).error);
      return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 });
    }

    console.log(JSON.stringify({ event: 'save_profile_success', userId }));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Onboarding save-profile error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
