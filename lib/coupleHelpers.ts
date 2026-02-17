import { supabase } from './supabaseClient';

export type CoupleDisplay = {
  displayName: string;
  avatarUrl?: string | null;
  location?: string | null;
};

export async function getCoupleDisplayName(coupleId: string): Promise<CoupleDisplay> {
  if (!coupleId) return { displayName: 'Couple (unknown)', avatarUrl: null, location: null };

  try {
    // Prefer the couples table (partner_name + avatar_url)
    const { data: coupleRow } = await supabase
      .from('couples')
      .select('partner_name, avatar_url, location')
      .eq('id', coupleId)
      .maybeSingle();

    if (coupleRow && (coupleRow.partner_name || coupleRow.avatar_url || coupleRow.location)) {
      return {
        displayName: coupleRow.partner_name || 'Couple',
        avatarUrl: coupleRow.avatar_url || null,
        location: coupleRow.location || null,
      };
    }

    // Fallback to profiles.full_name
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', coupleId)
      .maybeSingle();

    return {
      displayName: profileRow?.full_name || 'Couple',
      avatarUrl: null,
      location: null,
    };
  } catch (err) {
    console.warn('getCoupleDisplayName error', err);
    return { displayName: 'Couple', avatarUrl: null, location: null };
  }
}
