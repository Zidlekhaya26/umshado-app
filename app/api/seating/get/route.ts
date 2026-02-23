import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    try {
      const { getAdminSupabase } = await import('../../../../lib/supabaseAdminClient');
      const admin = getAdminSupabase();
      const { data, error } = await admin.from('seatings').select('id,name,payload,created_at').eq('id', id).limit(1).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    } catch (e) {
      const { supabase } = await import('../../../../lib/supabaseClient');
      const { data, error } = await supabase.from('seatings').select('id,name,payload,created_at').eq('id', id).limit(1).single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
