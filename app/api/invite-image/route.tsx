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

    const gRes = await fetch(`${SUPABASE_URL}/rest/v1/couple_guests?id=eq.${guestId}&select=*`, { headers: h });
    if (!gRes.ok) return new Response('Not found', { status: 404 });
    const [guest] = await gRes.json();
    if (!guest) return new Response('Not found', { status: 404 });
    if (!token || guest.rsvp_token !== token) return new Response('Unauthorized', { status: 401 });

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

    let dateStr = 'To be announced';
    try {
      if (weddingDate) {
        const d = new Date(weddingDate);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch (_) {}

    const guestName     = guest.full_name ?? 'Guest';
    const coupleDisplay = coupleName || 'The Wedding';
    const venue         = weddingVenue || 'To be announced';
    const origin        = new URL(request.url).origin;
    const avatarSrc     = avatarUrl ? `${origin}/api/image-proxy?url=${encodeURIComponent(avatarUrl)}` : null;

    const W    = 800;
    const H    = 1100;
    const GOLD = '#c9a860';
    const DARK = '#1e110a';
    const MID  = '#6b4d34';
    const LITE = '#9a7c58';
    const BG   = '#fdfaf6';
    const GOLD_GRAD = 'linear-gradient(90deg, #8a6e3a 0%, #d4aa60 30%, #f2d98a 50%, #d4aa60 70%, #8a6e3a 100%)';

    return new ImageResponse(
      (
        <div style={{
          width: W, height: H,
          display: 'flex', flexDirection: 'column',
          background: BG,
          overflow: 'hidden',
        }}>

          {/* ── Gold top bar ── */}
          <div style={{ width: '100%', height: 8, background: GOLD_GRAD, flexShrink: 0, display: 'flex' }} />

          {/* ── Photo ── */}
          <div style={{
            width: '100%', height: 340, flexShrink: 0,
            background: '#ede3d8', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {avatarSrc
              ? <img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
              : <div style={{ fontSize: 64, display: 'flex' }}>💍</div>
            }
            {/* Fade vignette */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
              background: 'linear-gradient(to bottom, transparent 0%, ' + BG + ' 100%)',
              display: 'flex',
            }} />
          </div>

          {/* ── Card body ── */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start',
            padding: '0 72px 48px', textAlign: 'center',
            background: BG,
          }}>

            {/* Ornamental rule — drawn as coloured boxes, not unicode */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0, marginBottom: 28 }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, ' + GOLD + ')' }} />
              {/* Diamond shape made of rotated box */}
              <div style={{
                width: 10, height: 10,
                background: GOLD,
                transform: 'rotate(45deg)',
                margin: '0 12px',
                flexShrink: 0,
                display: 'flex',
              }} />
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, ' + GOLD + ')' }} />
            </div>

            {/* DEAR */}
            <div style={{ fontSize: 13, letterSpacing: 8, color: LITE, marginBottom: 8, display: 'flex' }}>DEAR</div>

            {/* Guest name */}
            <div style={{ fontSize: 34, fontWeight: 700, color: DARK, letterSpacing: 1, marginBottom: 20, lineHeight: 1.2, display: 'flex' }}>
              {guestName}
            </div>

            {/* Prose */}
            <div style={{ fontSize: 16, color: MID, fontStyle: 'italic', marginBottom: 6, display: 'flex' }}>
              with love in our hearts, we invite you to
            </div>
            <div style={{ fontSize: 12, letterSpacing: 5, color: LITE, marginBottom: 20, display: 'flex' }}>
              CELEBRATE THE MARRIAGE OF
            </div>

            {/* Couple name */}
            <div style={{
              fontSize: 54, fontWeight: 400, fontStyle: 'italic',
              color: DARK, lineHeight: 1.2, marginBottom: 32,
              display: 'flex', textAlign: 'center',
            }}>
              {coupleDisplay}
            </div>

            {/* Middle rule */}
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 28 }}>
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, ' + GOLD + ')' }} />
              <div style={{ width: 8, height: 8, background: GOLD, transform: 'rotate(45deg)', margin: '0 12px', flexShrink: 0, display: 'flex' }} />
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, ' + GOLD + ')' }} />
            </div>

            {/* Date + Venue */}
            <div style={{ display: 'flex', width: '100%', gap: 16, marginBottom: 36 }}>
              {[{ label: 'DATE', value: dateStr }, { label: 'VENUE', value: venue }].map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '20px 16px',
                  background: 'rgba(201,168,96,0.08)',
                  borderTop: '2px solid ' + GOLD,
                }}>
                  <div style={{ fontSize: 11, letterSpacing: 5, color: GOLD, marginBottom: 10, display: 'flex' }}>{label}</div>
                  <div style={{ fontSize: 18, color: DARK, fontWeight: 600, lineHeight: 1.5, textAlign: 'center', display: 'flex' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ fontSize: 15, fontStyle: 'italic', color: GOLD, display: 'flex' }}>
              Black tie &nbsp;·&nbsp; Kindly RSVP
            </div>

          </div>

          {/* ── Gold bottom bar ── */}
          <div style={{ width: '100%', height: 8, background: GOLD_GRAD, flexShrink: 0, display: 'flex' }} />

        </div>
      ),
      { width: W, height: H }
    );
  } catch (err) {
    console.error('invite-image error:', err);
    return new Response('Server error', { status: 500 });
  }
}
