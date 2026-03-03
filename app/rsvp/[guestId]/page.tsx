import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import RSVPClient from './RSVPClient';
import InviteCard from '@/components/InviteCard';

type Props = {
  params: Promise<{ guestId: string }>;
  searchParams?: Promise<{ t?: string; view?: string }>;
};

export default async function RSVPPage({ params, searchParams }: Props) {
  const { guestId } = await params;
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams?.t ?? null;
  const view  = resolvedSearchParams?.view ?? null;
  const supabase = createServiceClient();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return notFound();

  const { data: guest } = await supabase
    .from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) return notFound();
  if (!token || guest.rsvp_token !== token) return notFound();

  let coupleName: string | null = null;
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
      coupleName   = couple.partner_name ?? null;
      avatarUrl    = couple.avatar_url   ?? null;
      weddingDate  = couple.wedding_date ?? null;
      weddingVenue = couple.location     ?? null;
    }
  } catch (_) {}

  // Fallback: profiles table
  try {
    if (!coupleName || !avatarUrl || !weddingDate || !weddingVenue) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, wedding_date, wedding_venue')
        .eq('id', guest.couple_id).maybeSingle();
      if (profile) {
        if (!coupleName)   coupleName   = (profile as any).full_name     ?? null;
        if (!avatarUrl)    avatarUrl    = (profile as any).avatar_url    ?? null;
        if (!weddingDate)  weddingDate  = (profile as any).wedding_date  ?? null;
        if (!weddingVenue) weddingVenue = (profile as any).wedding_venue ?? null;
      }
    }
  } catch (_) {}

  // Format date
  let dateStr: string | null = null;
  try {
    if (weddingDate) {
      const d = new Date(weddingDate);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
      }
    }
  } catch (_) {}

  if (view === 'card') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #f5ede4 0%, #ede0d4 50%, #e8d5c4 100%)' }}>
        <InviteCard
          guestName={guest.full_name}
          coupleName={coupleName}
          date={dateStr}
          venue={weddingVenue}
          avatarUrl={avatarUrl}
          guestId={guestId}
          token={token}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f5ede4 0%, #ede0d4 50%, #e8d5c4 100%)' }}>
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <p className="text-xs tracking-widest text-amber-700 uppercase mb-3">Wedding Invitation</p>
        <h1 className="font-serif text-2xl text-stone-800 mb-1">{coupleName ?? 'You are invited'}</h1>
        <p className="text-sm text-stone-500 mb-6">{guest.full_name}</p>
        <RSVPClient guestId={guestId} token={token} />
      </div>
    </div>
  );
}
