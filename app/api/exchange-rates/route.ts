import { NextResponse } from 'next/server';

type CacheEntry = { rates: Record<string, number> | null; ts: number };

// Simple in-memory cache for the serverless function lifetime
let cache: CacheEntry = { rates: null, ts: 0 };

export async function GET() {
  const now = Date.now();
  // serve cached for 30 minutes
  if (cache.rates && now - cache.ts < 1000 * 60 * 30) {
    return NextResponse.json({ rates: cache.rates, cached: true });
  }

  try {
    // Use exchangerate-api (open.er-api.com) which provides free rates without a key
    const resp = await fetch('https://open.er-api.com/v6/latest/ZAR');
    if (!resp.ok) throw new Error('Failed to fetch rates');
    const json = await resp.json();
    const rates: Record<string, number> = {};
    if (json && json.rates) {
      rates['USD'] = Number(json.rates['USD']) || 0;
      // add BWP (Pula) rate when provided
      rates['BWP'] = Number(json.rates['BWP'] ?? 0) || 0;
    }
    cache = { rates, ts: now };
    return NextResponse.json({ rates, cached: false });
  } catch (err) {
    console.warn('exchange-rates: fetch failed', err);
    return NextResponse.json({ rates: cache.rates, cached: true, error: String(err) });
  }
}
