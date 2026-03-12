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
// Updates active_role using the service-role client so it is never
// blocked by RLS policies on the profiles table.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { role } = await req.json();
  if (role !== 'couple' && role !== 'vendor') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('profiles')
    .update({ active_role: role })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, active_role: role });
}
