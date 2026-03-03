import React from 'react';
import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function uuidValid(id?: string | null) {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const token = searchParams.get('t') ?? '';

    if (!uuidValid(guestId)) return new Response('Not found', { status: 404 });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Server misconfigured', { status: 500 });

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    };

    // Fetch guest
    const guestRes = await fetch(`${SUPABASE_URL}/rest/v1/couple_guests?id=eq.${guestId}&select=*`, { headers });
    if (!guestRes.ok) return new Response('Not found', { status: 404 });
    const guests = await guestRes.json();
    const guest = Array.isArray(guests) && guests.length ? guests[0] : null;
    if (!guest) return new Response('Not found', { status: 404 });

    // Validate token
    if (!token || guest.rsvp_token !== token) {
      // try lookup by token
      const byTokenRes = await fetch(`${SUPABASE_URL}/rest/v1/couple_guests?rsvp_token=eq.${encodeURIComponent(token)}&select=*`, { headers });
      if (!byTokenRes.ok) return new Response('Not found', { status: 404 });
      const byToken = await byTokenRes.json();
      const hit = Array.isArray(byToken) && byToken.length ? byToken[0] : null;
      if (!hit || hit.id !== guest.id) return new Response('Not found', { status: 404 });
    }

    // Fetch couple/profile info
    let coupleName = '';
    let avatar_url = '';
    let wedding_date = '';
    let wedding_venue = '';
    if (guest.couple_id) {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${guest.couple_id}&select=full_name,avatar_url,wedding_date,wedding_venue`, { headers });
      if (pRes.ok) {
        const pdata = await pRes.json();
        const prof = Array.isArray(pdata) && pdata.length ? pdata[0] : null;
        if (prof) {
          coupleName = prof.full_name ?? '';
          avatar_url = prof.avatar_url ?? '';
          wedding_date = prof.wedding_date ?? '';
          wedding_venue = prof.wedding_venue ?? '';
        }
      }

      if ((!avatar_url || !wedding_date || !wedding_venue)) {
        const cRes = await fetch(`${SUPABASE_URL}/rest/v1/couples?id=eq.${guest.couple_id}&select=partner_name,avatar_url,wedding_date,location`, { headers });
        if (cRes.ok) {
          const cdata = await cRes.json();
          const crow = Array.isArray(cdata) && cdata.length ? cdata[0] : null;
          if (crow) {
            if (!coupleName) coupleName = crow.partner_name ?? '';
            if (!avatar_url) avatar_url = crow.avatar_url ?? '';
            if (!wedding_date) wedding_date = crow.wedding_date ?? '';
            if (!wedding_venue) wedding_venue = crow.location ?? '';
          }
        }
      }
    }

    const dateStr = wedding_date ? (() => { try { const d = new Date(wedding_date); return isNaN(d.getTime()) ? wedding_date : d.toLocaleString(undefined, { dateStyle: 'long' }); } catch { return wedding_date; } })() : '';

    const origin = new URL(request.url).origin;
    const avatarProxy = avatar_url ? `${origin}/api/image-proxy?url=${encodeURIComponent(avatar_url)}` : null;

    const guestName = guest.full_name ?? guest.name ?? 'Guest';
    const coupleDisplay = coupleName || 'The Couple';

    return new ImageResponse(
      (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          background: 'linear-gradient(180deg,#F7F0EA 0%, #FFF 40%)',
          padding: 48,
          boxSizing: 'border-box',
          color: '#2a1712',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
        }}>
          <div style={{ width: 720, height: 480, borderRadius: 16, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 24px 70px rgba(36,20,24,0.18)' }}>
            {avatarProxy ? <img src={avatarProxy} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#EEE' }} />}
          </div>
          <div style={{ marginTop: 36, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 2 }}>{guestName.toUpperCase()}</div>
            <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: '#7B1E3A' }}>{coupleDisplay}'s Wedding</div>
            <div style={{ marginTop: 18, fontSize: 16, fontWeight: 700 }}>{dateStr}</div>
            {wedding_venue ? <div style={{ marginTop: 6, fontSize: 14, color: '#444' }}>{wedding_venue}</div> : null}
          </div>
          <div style={{ marginTop: 40, fontSize: 14, color: '#444' }}>Show this invite at the entrance or save it to your device.</div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      }
    );
  } catch (err) {
    return new Response('Server error', { status: 500 });
  }
}
