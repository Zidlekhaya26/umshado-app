import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import RSVPClient from '../../RSVPClient';

type Props = { params: { guestId: string; token: string } };

export default async function RSVPPathTokenPage({ params }: Props) {
  // `params` may be a Promise in the App Router — await it
  const p = await params as { guestId: string; token: string };
  const { guestId } = p;
  // Defensive: token may sometimes arrive with appended query fragments due to
  // fronting/proxy behavior (e.g. "<token>?view=card"). Decode then strip
  // anything after a `?` or `&` to recover the raw token value.
  const rawToken = p.token ?? '';
  const decodedToken = (() => {
    try { return decodeURIComponent(rawToken); } catch (e) { return rawToken; }
  })();
  const token = decodedToken.split('?')[0].split('&')[0];

  // Instrumentation: log incoming headers and reconstructed full URL to aid
  // debugging of query parameter loss across proxies/aliases. These logs will
  // appear in Vercel deployment logs when this page is requested.
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host') || 'unknown-host';
    const proto = h.get('x-forwarded-proto') || 'https';
    const fullUrl = `${proto}://${host}/rsvp/${guestId}/t/${token}`;
    // instrumentation retained as comments for future debugging
    // headers and reconstructed URL available in server logs if needed
  } catch (e) {
    // ignore instrumentation errors
  }

  const supabase = createServiceClient();

  // Basic validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return notFound();

  let { data: guest, error: guestErr } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) {
    // Debug: log guest lookup failure to server logs to aid e2e troubleshooting
    // eslint-disable-next-line no-console
    console.error('[rsvp] guest lookup missing (path-token)', { guestId, guestErr });
    return notFound();
  }

  // token must match — but be forgiving: if mismatch, try to re-query by token
  if (!token || guest.rsvp_token !== token) {
    // Log token mismatch for debugging
    // eslint-disable-next-line no-console
    console.error('[rsvp] token mismatch (path-token)', { guestId, expected: guest.rsvp_token, received: token });

    try {
      const { data: guestByToken } = await supabase.from('couple_guests').select('*').eq('rsvp_token', token).maybeSingle();
      if (guestByToken && guestByToken.id === guestId) {
        guest = guestByToken;
      } else {
        return notFound();
      }
    } catch (e) {
      return notFound();
    }
  }

  // Fetch couple data
  let coupleName: string | null = null;
  let partnerName: string | null = null;
  let avatarUrl: string | null = null;
  let weddingDate: string | null = null;
  let weddingVenue: string | null = null;

  // Primary: couples table
  try {
    const { data: couple } = await supabase
      .from('couples')
      .select('partner_name, avatar_url, wedding_date, location')
      .eq('id', guest.couple_id).maybeSingle();
    if (couple) {
      partnerName  = couple.partner_name ?? null;
      avatarUrl    = couple.avatar_url   ?? null;
      weddingDate  = couple.wedding_date ?? null;
      weddingVenue = couple.location     ?? null;
    }
  } catch (_) {}

  // Fallback: profiles table for user's own name
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, wedding_date, wedding_venue')
      .eq('id', guest.couple_id).maybeSingle();
    if (profile) {
      coupleName   = (profile as any).full_name     ?? null;
      if (!avatarUrl)    avatarUrl    = (profile as any).avatar_url    ?? null;
      if (!weddingDate)  weddingDate  = (profile as any).wedding_date  ?? null;
      if (!weddingVenue) weddingVenue = (profile as any).wedding_venue ?? null;
    }
  } catch (_) {}

  return (
    <RSVPClient
      guestId={guestId}
      token={token}
      guestName={guest.full_name}
      coupleName={coupleName}
      partnerName={partnerName}
      avatarUrl={avatarUrl}
      weddingDate={weddingDate}
      weddingVenue={weddingVenue}
    />
  );
}
