import { supabase } from './supabaseClient';

export type CoupleDisplay = {
  displayName: string;
  avatarUrl?: string | null;
  location?: string | null;
};

export async function getCoupleDisplayName(coupleId: string): Promise<CoupleDisplay> {
  if (!coupleId) return { displayName: 'Couple (unknown)', avatarUrl: null, location: null };

  try {
    // 1) Try the couples table first (partner_name + avatar_url + location)
    const { data: coupleRow, error: coupleErr } = await supabase
      .from('couples')
      .select('partner_name, avatar_url, location')
      .eq('id', coupleId)
      .maybeSingle();

    if (coupleErr) {
      console.warn('getCoupleDisplayName: couples lookup failed', coupleErr);
    }

    const partnerName = (coupleRow?.partner_name || '').toString().trim();
    if (partnerName) {
      return {
        displayName: partnerName,
        avatarUrl: coupleRow?.avatar_url || null,
        location: coupleRow?.location || null,
      };
    }

    // 2) If no partner_name, fallback to profiles.full_name for the same id
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', coupleId)
      .maybeSingle();

    if (profileErr) {
      console.warn('getCoupleDisplayName: profiles lookup failed', profileErr);
    }

    const fullName = (profileRow as any)?.full_name?.toString().trim?.();
    if (fullName) {
      return {
        displayName: fullName,
        avatarUrl: coupleRow?.avatar_url || null,
        location: coupleRow?.location || null,
      };
    }

    // 3) Final fallback: use avatar/location from couples if present, but display name "Couple"
    return {
      displayName: 'Couple',
      avatarUrl: coupleRow?.avatar_url || null,
      location: coupleRow?.location || null,
    };
  } catch (err) {
    console.warn('getCoupleDisplayName error', err);
    return { displayName: 'Couple', avatarUrl: null, location: null };
  }
}
