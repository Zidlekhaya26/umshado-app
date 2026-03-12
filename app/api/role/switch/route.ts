import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getAdminSupabase } from '@/lib/supabaseAdminClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is authenticated
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role } = await req.json();
    if (role !== 'couple' && role !== 'vendor') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Use service-role client to bypass RLS — safe because we verified
    // the caller owns this row (auth.uid() === user.id check above).
    const admin = getAdminSupabase();
    const { error: updateError } = await admin
      .from('profiles')
      .update({ active_role: role })
      .eq('id', user.id);

    if (updateError) {
      console.error('[role/switch] update error:', updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, active_role: role });
  } catch (err: any) {
    console.error('[role/switch] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
