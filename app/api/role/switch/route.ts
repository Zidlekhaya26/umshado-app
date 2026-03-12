import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabaseAdminClient';

export const dynamic = 'force-dynamic';

async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? user : null;
}

// POST /api/role/switch
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = await req.json();
  if (role !== 'couple' && role !== 'vendor') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Check that the user actually has this role before switching
  const { data: profile } = await admin
    .from('profiles')
    .select('has_couple, has_vendor, active_role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Verify the target role exists for this user
  if (role === 'couple' && !profile.has_couple) {
    // Verify by checking couples table directly (in case flag is stale)
    const { data: coupleRow } = await admin
      .from('couples')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!coupleRow) {
      return NextResponse.json({ error: 'No couple account found' }, { status: 400 });
    }
    // Backfill the flag if missing
    await admin.from('profiles').update({ has_couple: true }).eq('id', user.id);
  }

  if (role === 'vendor' && !profile.has_vendor) {
    // Verify by checking vendors table directly
    const { data: vendorRow } = await admin
      .from('vendors')
      .select('id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(1)
      .maybeSingle();

    if (!vendorRow) {
      return NextResponse.json({ error: 'No vendor account found' }, { status: 400 });
    }
    // Backfill the flag if missing
    await admin.from('profiles').update({ has_vendor: true }).eq('id', user.id);
  }

  // Perform the switch
  const { error } = await admin
    .from('profiles')
    .update({ active_role: role })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, active_role: role });
}
