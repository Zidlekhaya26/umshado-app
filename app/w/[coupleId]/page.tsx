import { createServiceClient } from '@/lib/supabaseServer';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import WeddingWebsite from './WeddingWebsite';

type Props = { params: { coupleId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { coupleId } = await params;
  const supabase = createServiceClient();

  const [profileRes, coupleRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', coupleId).maybeSingle(),
    supabase.from('couples').select('partner_name, wedding_date, location').eq('id', coupleId).maybeSingle(),
  ]);

  const name1 = profileRes.data?.full_name;
  const name2 = coupleRes.data?.partner_name;
  const title = name1 && name2 ? `${name1} & ${name2}'s Wedding` : name1 ? `${name1}'s Wedding` : 'Our Wedding';

  return {
    title,
    description: `Join us to celebrate our special day${coupleRes.data?.location ? ` in ${coupleRes.data.location}` : ''}.`,
    openGraph: { title, type: 'website' },
  };
}

export default async function WeddingPage({ params }: Props) {
  const { coupleId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(coupleId)) return notFound();

  const supabase = createServiceClient();

  // Fetch all couple data in parallel
  const [profileRes, coupleRes, scheduleRes, wishesRes, momentsRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', coupleId).maybeSingle(),
    supabase.from('couples')
      .select('partner_name, wedding_date, location, avatar_url, wedding_theme, gift_enabled, gift_message, gift_items')
      .eq('id', coupleId).maybeSingle(),
    supabase.from('live_events').select('*').eq('couple_id', coupleId).order('sort_order'),
    supabase.from('live_well_wishes').select('id, guest_name, message, created_at').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(50),
    supabase.from('live_moments').select('id, guest_name, caption, media_url, created_at').eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(24),
  ]);

  // 404 if couple doesn't exist at all
  if (!profileRes.data && !coupleRes.data) return notFound();

  return (
    <WeddingWebsite
      coupleId={coupleId}
      coupleName={profileRes.data?.full_name ?? null}
      partnerName={coupleRes.data?.partner_name ?? null}
      weddingDate={coupleRes.data?.wedding_date ?? null}
      location={coupleRes.data?.location ?? null}
      avatarUrl={coupleRes.data?.avatar_url ?? null}
      weddingTheme={coupleRes.data?.wedding_theme ?? 'champagne'}
      giftEnabled={coupleRes.data?.gift_enabled ?? false}
      giftMessage={coupleRes.data?.gift_message ?? null}
      giftItems={coupleRes.data?.gift_items ?? []}
      schedule={scheduleRes.data ?? []}
      wishes={wishesRes.data ?? []}
      moments={momentsRes.data ?? []}
    />
  );
}
