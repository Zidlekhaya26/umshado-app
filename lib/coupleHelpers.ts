import { supabase } from './supabaseClient';

export type CoupleDisplay = {
  displayName: string;
  avatarUrl?: string | null;
  location?: string | null;
};

export async function getCoupleDisplayName(coupleId: string): Promise<CoupleDisplay> {
  if (!coupleId) return { displayName: 'Couple (unknown)', avatarUrl: null, location: null };

  try {
    // Call the server-side RPC which encapsulates RLS-safe logic
    const { data, error } = await supabase.rpc('get_couple_display_name', { p_couple_id: coupleId });

    if (error) {
      console.warn('getCoupleDisplayName RPC failed', error);
      return { displayName: 'Couple', avatarUrl: null, location: null };
    }

    const name = typeof data === 'string' ? (data as string).trim() : '';
    return { displayName: name || 'Couple', avatarUrl: null, location: null };
  } catch (err) {
    console.warn('getCoupleDisplayName unexpected error', err);
    return { displayName: 'Couple', avatarUrl: null, location: null };
  }
}
