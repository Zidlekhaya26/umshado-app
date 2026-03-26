/**
 * Ad deduplication tests
 *
 * Ensures the marketplace only shows one ad per vendor — no matter how many
 * active boosts they have. Prevents the same vendor from dominating ad slots.
 */

interface RawBoost {
  id: string;
  vendor_id: string | null;
  ad_headline: string;
  created_at: string;
}

// Extracted from app/api/ads/active/route.ts
function deduplicateBoosts(rawBoosts: RawBoost[]): RawBoost[] {
  const seenVendors = new Set<string>();
  return rawBoosts.filter((b) => {
    if (!b.vendor_id || seenVendors.has(b.vendor_id)) return false;
    seenVendors.add(b.vendor_id);
    return true;
  });
}

const makeBoost = (id: string, vendorId: string | null, createdAt: string): RawBoost => ({
  id,
  vendor_id: vendorId,
  ad_headline: `Ad ${id}`,
  created_at: createdAt,
});

describe('Ad deduplication', () => {
  it('returns a single boost when only one exists', () => {
    const boosts = [makeBoost('b1', 'vendor-A', '2026-03-25')];
    expect(deduplicateBoosts(boosts)).toHaveLength(1);
  });

  it('keeps one boost per vendor when vendor has multiple active boosts', () => {
    const boosts = [
      makeBoost('b1', 'vendor-A', '2026-03-25'), // newest (sorted DESC before calling)
      makeBoost('b2', 'vendor-A', '2026-03-17'), // older duplicate
    ];
    const result = deduplicateBoosts(boosts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b1'); // keeps first (newest) one
  });

  it('keeps one boost per vendor for multiple vendors', () => {
    const boosts = [
      makeBoost('b1', 'vendor-A', '2026-03-25'),
      makeBoost('b2', 'vendor-B', '2026-03-24'),
      makeBoost('b3', 'vendor-A', '2026-03-17'), // duplicate for vendor-A
    ];
    const result = deduplicateBoosts(boosts);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['b1', 'b2']);
  });

  it('filters out boosts with null vendor_id', () => {
    const boosts = [
      makeBoost('b1', null, '2026-03-25'),
      makeBoost('b2', 'vendor-A', '2026-03-24'),
    ];
    const result = deduplicateBoosts(boosts);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b2');
  });

  it('returns empty array for empty input', () => {
    expect(deduplicateBoosts([])).toHaveLength(0);
  });

  it('returns empty array when all boosts have null vendor_id', () => {
    const boosts = [
      makeBoost('b1', null, '2026-03-25'),
      makeBoost('b2', null, '2026-03-24'),
    ];
    expect(deduplicateBoosts(boosts)).toHaveLength(0);
  });
});
