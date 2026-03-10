import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import RSVPClient from './RSVPClient';

type Props = {
  params: Promise<{ guestId: string }>;
  searchParams?: Promise<{ t?: string }>;
};

export default async function RSVPPage({ params, searchParams }: Props) {
  const { guestId } = await params;
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams?.t ?? null;
  const supabase = createServiceClient();

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(guestId)) return notFound();

  const { data: guest } = await supabase
    .from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!guest) return notFound();
  if (!token || guest.rsvp_token !== token) return notFound();

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
  );
}
