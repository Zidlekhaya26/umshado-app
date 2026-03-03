import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

export async function GET(request: Request, context: any) {
  // `context.params` may be a Promise in some Next.js runtimes — await if needed
  const rawParams = context?.params;
  const params = rawParams && typeof rawParams.then === 'function' ? await rawParams : (rawParams ?? {});
  const { guestId } = params;
  const rawToken = params?.token ?? '';
  const decodedToken = (() => { try { return decodeURIComponent(rawToken); } catch (e) { return rawToken; } })();
  const token = decodedToken.split('?')[0].split('&')[0];

  const supabase = createServiceClient();

  // Validate guest id format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: guest } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (!token || guest.rsvp_token !== token) {
    // Try fallback lookup by token
    const { data: guestByToken } = await supabase.from('couple_guests').select('*').eq('rsvp_token', token).maybeSingle();
    if (!guestByToken || guestByToken.id !== guestId) return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // fetch couple profile
  let coupleName = '';
  let avatar_url = '';
  let wedding_date = '';
  let wedding_venue = '';
  try {
    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, wedding_date, wedding_venue').eq('id', guest.couple_id).maybeSingle();
    if (profile) {
      coupleName = profile.full_name ?? '';
      avatar_url = (profile as any).avatar_url ?? '';
      wedding_date = (profile as any).wedding_date ?? '';
      wedding_venue = (profile as any).wedding_venue ?? '';
    }
  } catch (e) {
    // ignore
  }

  // If profiles table doesn't contain avatar/wedding fields in this environment, fall back to `couples` table
  if ((!avatar_url || !wedding_date || !wedding_venue) ) {
    try {
      const { data: coupleRow } = await supabase.from('couples').select('partner_name, avatar_url, wedding_date, location').eq('id', guest.couple_id).maybeSingle();
      if (coupleRow) {
        if (!coupleName) coupleName = (coupleRow as any).partner_name ?? '';
        if (!avatar_url) avatar_url = (coupleRow as any).avatar_url ?? '';
        if (!wedding_date) wedding_date = (coupleRow as any).wedding_date ?? '';
        if (!wedding_venue) wedding_venue = (coupleRow as any).location ?? '';
      }
    } catch (e) {
      // ignore
    }
  }

  const dateStr = wedding_date ? (() => { try { const d = new Date(wedding_date); return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'long' }); } catch { return ''; } })() : '';

  const avatarProxy = avatar_url ? `/api/image-proxy?url=${encodeURIComponent(avatar_url)}` : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invite</title></head><body style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#F7F0EA;padding:24px"><div style="max-width:420px;margin:0 auto;background:#fff;padding:20px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.08)"><h2 style="margin:0 0 8px">${escapeHtml(guest.full_name)}</h2><p style="margin:0 0 12px;color:#444">${escapeHtml(coupleName || 'You')} invites you to their wedding</p>${avatarProxy?`<img src="${avatarProxy}" alt="avatar" style="width:96px;height:96px;border-radius:8px;object-fit:cover;margin-bottom:12px"/>`:''}${dateStr?`<p style="margin:0 0 6px"><strong>When:</strong> ${escapeHtml(dateStr)}</p>`:''}${wedding_venue?`<p style="margin:0 0 12px"><strong>Where:</strong> ${escapeHtml(wedding_venue)}</p>`:''}<p style="margin:12px 0;color:#666">I confirm this invite is to me and I will RSVP below.</p><button style="display:inline-block;padding:10px 14px;background:#0b0;border-radius:8px;color:#fff;border:none">Download Invite</button></div></body></html>`;

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: any) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
