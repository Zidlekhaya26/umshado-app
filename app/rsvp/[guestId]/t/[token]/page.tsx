import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import RSVPClient from '../../RSVPClient';
import InviteCard from '@/components/InviteCard';

type Props = { params: { guestId: string; token: string }, searchParams?: { view?: string } };

export default async function RSVPPathTokenPage({ params, searchParams }: Props) {
  // `params` and `searchParams` may be Promises in the App Router — await them
  const p = await params as { guestId: string; token: string };
  const sp = searchParams ? await searchParams : undefined;
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
    const fullUrl = `${proto}://${host}/rsvp/${guestId}/t/${token}${sp?.view ? `?view=${sp.view}` : ''}`;
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

  // Try to fetch couple profile fields if available
  let coupleName: string | null = null;
  let avatar_url: string | null = null;
  let wedding_date: string | null = null;
  let wedding_venue: string | null = null;
  try {
    const { data: profile } = await supabase.from('profiles').select('partner_name, full_name, avatar_url, wedding_date, wedding_venue').eq('id', guest.couple_id).maybeSingle();
    if (profile) {
      coupleName = (profile as any).partner_name ?? profile.full_name ?? null;
      avatar_url = (profile as any).avatar_url ?? null;
      wedding_date = (profile as any).wedding_date ?? null;
      wedding_venue = (profile as any).wedding_venue ?? null;
    }

    // If couple display name or avatar missing on profiles row, try the public `couples` table
    if (!coupleName || !avatar_url) {
      try {
        const { data: coupleRow } = await supabase
          .from('couples')
          .select('partner_name, avatar_url, wedding_date, location')
          .eq('id', guest.couple_id)
          .maybeSingle();

        if (coupleRow) {
          coupleName = coupleName ?? (coupleRow as any).partner_name ?? null;
          avatar_url = avatar_url ?? (coupleRow as any).avatar_url ?? null;
          wedding_date = wedding_date ?? (coupleRow as any).wedding_date ?? null;
          wedding_venue = wedding_venue ?? (coupleRow as any).location ?? null;
        }
      } catch (err) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }

  // Render either the designed invite card (view=card) or the plain RSVP form
  const view = sp?.view ?? null;
  if (view === 'card') {
    // Format wedding date to human-friendly date-only string
    let dateStr: string | null = null;
    try {
      if (wedding_date) {
        const d = new Date(wedding_date);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleString(undefined, { dateStyle: 'long' });
      }
    } catch (e) { /* ignore */ }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <InviteCard
          guestName={guest.full_name}
          coupleName={coupleName}
          date={dateStr}
          venue={wedding_venue}
          avatarUrl={avatar_url}
          guestId={guestId}
          token={token}
          plusOne={guest.plus_one}
        />
      </div>
    );
  }

  // Default: Render a small client-side form for RSVP
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">You're invited</h1>
        <p className="text-sm text-gray-600 mb-4">{coupleName ? `${coupleName} invited you to their wedding.` : `You've been invited.`}</p>
        <p className="text-sm text-gray-700 font-semibold mb-4">{guest.full_name}</p>

        <RSVPClient guestId={guestId} token={token} />
      </div>
    </div>
  );
}
