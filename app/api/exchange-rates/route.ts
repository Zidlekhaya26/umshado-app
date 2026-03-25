import { NextResponse } from 'next/server';

type CacheEntry = { rates: Record<string, number> | null; ts: number };
let cache: CacheEntry = { rates: null, ts: 0 };
const TTL = 1000 * 60 * 30; // 30 min

/** Parse ZAR-based rates from fawazahmed0 CDN (jsdelivr) */
async function fetchFawaz(): Promise<Record<string, number>> {
  const res = await fetch(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/zar.json',
    { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`fawaz ${res.status}`);
  const json = await res.json();
  // shape: { date: "...", zar: { usd: 0.054, bwp: 0.071, ... } }
  const zar = json?.zar ?? {};
  return {
    USD: Number(zar.usd) || 0,
    BWP: Number(zar.bwp) || 0,
    ZWL: Number(zar.zwl) || 0,
    GBP: Number(zar.gbp) || 0,
    EUR: Number(zar.eur) || 0,
  };
}

/** Fallback: frankfurter.app (ECB data, very reliable TLS) */
async function fetchFrankfurter(): Promise<Record<string, number>> {
  // Frankfurter doesn't support ZAR as base — get USD base then invert
  const res = await fetch(
    'https://api.frankfurter.app/latest?from=USD&to=ZAR,BWP,GBP,EUR',
    { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const json = await res.json();
  // json.rates: { ZAR: 18.5, BWP: 13.8, ... } — these are USD→X rates
  // We need ZAR→X: ZAR→USD = 1/ZAR_per_USD
  const zarPerUsd = Number(json?.rates?.ZAR) || 18.5;
  const rates: Record<string, number> = {};
  rates.USD = 1 / zarPerUsd;
  if (json?.rates?.BWP) rates.BWP = Number(json.rates.BWP) / zarPerUsd;
  if (json?.rates?.GBP) rates.GBP = Number(json.rates.GBP) / zarPerUsd;
  if (json?.rates?.EUR) rates.EUR = Number(json.rates.EUR) / zarPerUsd;
  return rates;
}

export async function GET() {
  const now = Date.now();
  if (cache.rates && now - cache.ts < TTL) {
    return NextResponse.json({ rates: cache.rates, cached: true });
  }

  let rates: Record<string, number> | null = null;
  let source = 'none';

  // Primary: fawazahmed0 via jsdelivr CDN (no SSL issues, always free)
  try {
    rates = await fetchFawaz();
    source = 'fawaz';
  } catch (e1) {
    console.warn('exchange-rates: fawaz failed, trying frankfurter', e1);
    // Fallback: frankfurter (ECB, very stable TLS)
    try {
      rates = await fetchFrankfurter();
      source = 'frankfurter';
    } catch (e2) {
      console.warn('exchange-rates: both sources failed', e2);
    }
  }

  if (rates) {
    cache = { rates, ts: now };
    return NextResponse.json({ rates, cached: false, source });
  }

  // Both failed — return stale cache or safe fallback
  const fallback = cache.rates ?? {
    USD: 0.054,  // ~R18.5 per $1
    BWP: 0.071,  // ~R14 per P1
    GBP: 0.043,
    EUR: 0.050,
  };
  return NextResponse.json({ rates: fallback, cached: true, source: 'fallback' });
}
