export type CoupleDisplay = {
  displayName: string;
  avatarUrl?: string | null;
  location?: string | null;
};

export async function getCoupleDisplayName(coupleId: string): Promise<CoupleDisplay> {
  // Lightweight placeholder resolver. In production this should query the DB.
  if (!coupleId) return { displayName: 'Couple (unknown)', avatarUrl: null, location: null };
  return { displayName: `Couple ${coupleId.slice(0, 6)}`, avatarUrl: null, location: null };
}
