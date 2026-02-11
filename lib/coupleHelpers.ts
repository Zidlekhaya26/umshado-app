import { supabase } from './supabaseClient';

export interface CoupleDisplay {
  displayName: string;
  avatarUrl?: string | null;
  location?: string | null;
}

/**
 * Resolve a friendly couple display name and avatar.
 * Preference order:
 * 1) partner1_name & partner2_name (joined with &)
 * 2) partner_name
 * 3) profiles.full_name
 * 4) email (only if no name available)
 * If nothing found, returns 'Couple (unknown)'.
 */
export async function getCoupleDisplayName(coupleId: string): Promise<CoupleDisplay> {
  try {
    if (!coupleId) return { displayName: 'Couple (unknown)' };

    // Try public couples row first
    const { data: couple, error: coupleErr } = await supabase
      .from('couples')
      .select('partner1_name, partner2_name, partner_name, avatar_url, location')
      .eq('id', coupleId)
      .maybeSingle();

    if (!coupleErr && couple) {
      const p1 = (couple.partner1_name || '').trim();
      const p2 = (couple.partner2_name || '').trim();
      const partnerName = (couple.partner_name || '').trim();
      const names = [p1, p2].filter(Boolean);
      if (names.length === 2) {
        return { displayName: `${names[0]} & ${names[1]}`, avatarUrl: couple.avatar_url || null, location: couple.location || null };
      }
      if (partnerName) return { displayName: partnerName, avatarUrl: couple.avatar_url || null, location: couple.location || null };
      if (names.length === 1) return { displayName: names[0], avatarUrl: couple.avatar_url || null, location: couple.location || null };
    }

    // Fallback to profiles row
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('full_name, display_name, email')
      .eq('id', coupleId)
      .maybeSingle();

    if (!profileErr && profile) {
      const full = (profile.full_name || profile.display_name || '').trim();
      if (full) return { displayName: full };
      if (profile.email) return { displayName: profile.email };
    }

    return { displayName: 'Couple (unknown)' };
  } catch (err) {
    console.warn('getCoupleDisplayName error', err);
    return { displayName: 'Couple (unknown)' };
  }
}
