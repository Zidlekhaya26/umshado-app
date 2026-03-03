import React from 'react';
import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function uuidValid(id?: string | null) {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guestId');
    const token   = searchParams.get('t') ?? '';

    if (!uuidValid(guestId)) return new Response('Not found', { status: 404 });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return new Response('Misconfigured', { status: 500 });

    const h = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    };

    // Fetch guest
    const gRes = await fetch(`${SUPABASE_URL}/rest/v1/couple_guests?id=eq.${guestId}&select=*`, { headers: h });
    if (!gRes.ok) return new Response('Not found', { status: 404 });
    const [guest] = await gRes.json();
    if (!guest) return new Response('Not found', { status: 404 });
    if (!token || guest.rsvp_token !== token) return new Response('Unauthorized', { status: 401 });

    // Fetch couple data
    let coupleName = '', avatarUrl = '', weddingDate = '', weddingVenue = '';
    if (guest.couple_id) {
      try {
        const cRes = await fetch(`${SUPABASE_URL}/rest/v1/couples?id=eq.${guest.couple_id}&select=partner_name,avatar_url,wedding_date,location`, { headers: h });
        if (cRes.ok) {
          const [c] = await cRes.json();
          if (c) { coupleName = c.partner_name ?? ''; avatarUrl = c.avatar_url ?? ''; weddingDate = c.wedding_date ?? ''; weddingVenue = c.location ?? ''; }
        }
      } catch (_) {}
      try {
        if (!coupleName || !avatarUrl || !weddingDate) {
          const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${guest.couple_id}&select=full_name,avatar_url,wedding_date,wedding_venue`, { headers: h });
          if (pRes.ok) {
            const [p] = await pRes.json();
            if (p) {
              if (!coupleName) coupleName = p.full_name ?? '';
              if (!avatarUrl) avatarUrl = p.avatar_url ?? '';
              if (!weddingDate) weddingDate = p.wedding_date ?? '';
              if (!weddingVenue) weddingVenue = p.wedding_venue ?? '';
            }
          }
        }
      } catch (_) {}
    }

    // Format date
    let dateStr = 'To be announced';
    try {
      if (weddingDate) {
        const d = new Date(weddingDate);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (_) {}

    const guestName    = guest.full_name ?? 'Guest';
    const coupleDisplay = coupleName || 'The Wedding';
    const venue        = weddingVenue || 'To be announced';
    const origin       = new URL(request.url).origin;

    // Proxy the avatar through our image-proxy to avoid CORS/fetch issues in edge
    const avatarSrc = avatarUrl
      ? `${origin}/api/image-proxy?url=${encodeURIComponent(avatarUrl)}`
      : null;

    // Card width/height — portrait A5-ish at 2x
    const W = 800;
    const H = 1120;
    const GOLD  = '#c9a860';
    const DARK  = '#1e110a';
    const MID   = '#6b4d34';
    const LIGHT = '#9a7c58';
    const BG    = '#fdfaf6';

    return new ImageResponse(
      (
        <div style={{
          width: W, height: H,
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          fontFamily: 'Georgia, serif',
          overflow: 'hidden',
        }}>

          {/* Gold top bar */}
          <div style={{ height: 8, background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)', flexShrink: 0 }} />

          {/* Photo */}
          <div style={{ width: '100%', height: 380, overflow: 'hidden', flexShrink: 0, background: '#ede3d8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {avatarSrc
              ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ fontSize: 64, display: 'flex' }}>💍</div>
            }
            {/* Fade to body */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to top, ' + BG + ', transparent)', display: 'flex' }} />
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 64px 40px', textAlign: 'center', background: BG }}>

            {/* Ornament */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12, marginBottom: 24 }}>
              <div style={{ flex: 1, height: 1, background: GOLD }} />
              <div style={{ color: GOLD, fontSize: 16, lineHeight: '1' }}>✦</div>
              <div style={{ flex: 1, height: 1, background: GOLD }} />
            </div>

            {/* Dear */}
            <div style={{ fontSize: 12, letterSpacing: 6, textTransform: 'uppercase', color: LIGHT, marginBottom: 6, display: 'flex' }}>D E A R</div>

            {/* Guest name */}
            <div style={{ fontSize: 32, fontWeight: 700, color: DARK, letterSpacing: 1, marginBottom: 20, display: 'flex' }}>{guestName}</div>

            {/* Prose */}
            <div style={{ fontSize: 16, color: MID, fontStyle: 'italic', marginBottom: 4, display: 'flex' }}>with love in our hearts, we invite you to</div>
            <div style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: LIGHT, marginBottom: 18, display: 'flex' }}>celebrate the marriage of</div>

            {/* Couple name */}
            <div style={{ fontSize: 52, fontWeight: 400, fontStyle: 'italic', color: DARK, lineHeight: 1.2, marginBottom: 28, display: 'flex' }}>{coupleDisplay}</div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12, marginBottom: 28 }}>
              <div style={{ flex: 1, height: 1, background: GOLD }} />
              <div style={{ color: GOLD, fontSize: 12, lineHeight: '1' }}>♦</div>
              <div style={{ flex: 1, height: 1, background: GOLD }} />
            </div>

            {/* Date + Venue tiles */}
            <div style={{ display: 'flex', width: '100%', gap: 12, marginBottom: 32 }}>
              {[
                { label: 'Date',  value: dateStr },
                { label: 'Venue', value: venue   },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1,
                  background: 'rgba(201,168,96,0.08)',
                  borderTop: '2px solid ' + GOLD,
                  padding: '18px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: GOLD, marginBottom: 8, display: 'flex' }}>{label}</div>
                  <div style={{ fontSize: 16, color: DARK, fontWeight: 600, lineHeight: 1.5, display: 'flex' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ fontSize: 14, fontStyle: 'italic', color: GOLD, display: 'flex' }}>Black tie · Kindly RSVP</div>

          </div>

          {/* Gold bottom bar */}
          <div style={{ height: 8, background: 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)', flexShrink: 0 }} />

        </div>
      ),
      { width: W, height: H }
    );
  } catch (err) {
    console.error('invite-image error:', err);
    return new Response('Server error', { status: 500 });
  }
}
