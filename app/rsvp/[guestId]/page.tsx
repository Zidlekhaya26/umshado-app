import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import RSVPClient from './RSVPClient';
import InviteCard from '@/components/InviteCard';

type Props = { params: { guestId: string }, searchParams?: { t?: string } };

export default async function RSVPPage({ params, searchParams }: Props) {
  const { guestId } = await params;
  const token = searchParams?.t ?? null;

  const supabase = createServiceClient();

  // Basic validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return notFound();

  const { data: guest } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) return notFound();

  // token must match
  if (!token || guest.rsvp_token !== token) return notFound();

  // Try to fetch couple profile fields if available
  let coupleName: string | null = null;
  let avatar_url: string | null = null;
  let wedding_date: string | null = null;
  let wedding_venue: string | null = null;
  try {
    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, wedding_date, wedding_venue').eq('id', guest.couple_id).maybeSingle();
    if (profile) {
      coupleName = profile.full_name ?? null;
      avatar_url = (profile as any).avatar_url ?? null;
      wedding_date = (profile as any).wedding_date ?? null;
      wedding_venue = (profile as any).wedding_venue ?? null;
    }
  } catch (e) {
    // ignore
  }

  // Render either the designed invite card (view=card) or the plain RSVP form
  const view = searchParams?.view ?? null;
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
