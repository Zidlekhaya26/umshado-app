import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { isDevOnly } from '@/lib/devOnly';

export async function POST(request: Request) {
  if (!isDevOnly) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = createServiceClient();
  // Pick first profile as couple
  const { data: profile } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 500 });

  const body = await request.json().catch(()=>({}));
  const guestName = body.full_name || `E2E Guest ${Date.now()%10000}`;
  const guestPhone = body.phone || '+27830000001';
  const token = body.token || crypto.randomUUID?.() || ('tok-'+Date.now());

  const { data: inserted, error } = await supabase.from('couple_guests').insert({ couple_id: profile.id, full_name: guestName, phone: guestPhone, rsvp_token: token, invited_via: 'whatsapp' }).select().maybeSingle();
  if (error || !inserted) return NextResponse.json({ error: 'insert failed', details: error }, { status: 500 });

  // Ensure the couple row and profile have basic display fields so invite HTML renders fully in tests
  try {
    const combined = `Mthabisi & Sthabiso`;
    await supabase.from('couples').upsert({ id: profile.id, partner_name: combined, avatar_url: 'https://via.placeholder.com/600x600.png?text=Couple', wedding_date: '2026-03-15', location: 'Sample Venue' });
    await supabase.from('profiles').update({ full_name: combined }).eq('id', profile.id);
  } catch (e) {
    // ignore errors in test helper
  }

  return NextResponse.json({ id: inserted.id, token }, { status: 201 });
}
