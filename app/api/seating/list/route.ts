import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // --- Auth: require admin Bearer token ---
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL!}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authedUser = await userRes.json();
  const userId: string | undefined = authedUser?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { getAdminSupabase } = await import('../../../../lib/supabaseAdminClient');
  const admin = getAdminSupabase();

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .limit(1)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    console.log(JSON.stringify({ event: 'seating_list_forbidden', userId }));
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // --- Fetch seating list ---
  try {
    const { data, error } = await admin
      .from('seatings')
      .select('id,name,payload,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
