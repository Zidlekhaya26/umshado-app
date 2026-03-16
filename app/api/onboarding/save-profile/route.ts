import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateBody } from '@/lib/apiValidate';
import getAdminSupabase from '@/lib/supabaseAdminClient';

const SaveProfileSchema = z.object({
  userId:        z.string().uuid().optional(),
  user_id:       z.string().uuid().optional(),
  wedding_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'wedding_date must be YYYY-MM-DD').nullable().optional(),
  wedding_venue: z.string().max(500).nullable().optional(),
}).refine(d => d.userId || d.user_id, { message: 'userId is required' });

/**
 * POST /api/onboarding/save-profile
 * Body: { userId: string, wedding_date?: string|null, wedding_venue?: string|null }
 * Upserts the profile record using the service role key.
 */
export async function POST(req: NextRequest) {
  const { data: body, error: bodyError } = await validateBody(req, SaveProfileSchema);
  if (bodyError) return bodyError;

  const userId = body.userId || body.user_id;
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Onboarding save-profile error:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
