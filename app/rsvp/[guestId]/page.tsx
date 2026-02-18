import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import RSVPClient from './RSVPClient';

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

  // Try to fetch couple profile name if available
  let coupleName: string | null = null;
  try {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', guest.couple_id).maybeSingle();
    if (profile?.full_name) coupleName = profile.full_name;
  } catch (e) {
    // ignore
  }

  // Render a small client-side form for RSVP
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
