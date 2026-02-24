import { NextRequest, NextResponse } from 'next/server';
import getAdminSupabase from '@/lib/supabaseAdminClient';

/**
 * POST /api/onboarding/save-profile
 * Body: { userId: string, wedding_date?: string|null, wedding_venue?: string|null }
 * Upserts the profile record using the service role key.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = body?.userId || body?.user_id;
  const wedding_date = body?.wedding_date ?? null;
  const wedding_venue = body?.wedding_venue ?? null;

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Missing userId' }, { status: 400 });
  }

  try {
    const supabase = getAdminSupabase();
    const res = await supabase
      .from('profiles')
      .upsert(
        { id: userId, wedding_date: wedding_date || null, wedding_venue: wedding_venue || null },
        { onConflict: 'id', returning: 'minimal' }
      );

    if ((res as any).error) {
      console.error('Failed to upsert profile:', (res as any).error);
      return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Onboarding save-profile error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
