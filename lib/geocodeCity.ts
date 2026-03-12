/**
 * lib/geocodeCity.ts
 *
 * Forward-geocodes a "City, Country" string to lat/lng using
 * OpenStreetMap Nominatim (free, no API key required).
 *
 * Used in vendor onboarding to store lat/lng for proximity search.
 */

export interface GeoPoint { lat: number; lng: number; }

const CACHE = new Map<string, GeoPoint | null>();

export async function geocodeCity(city: string, country?: string): Promise<GeoPoint | null> {
  if (!city) return null;
  const q = [city, country].filter(Boolean).join(', ');
  const key = q.toLowerCase().trim();
  if (CACHE.has(key)) return CACHE.get(key) ?? null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'uMshado-App' },
    });
    if (!res.ok) { CACHE.set(key, null); return null; }
    const data = await res.json();
    if (!data || data.length === 0) { CACHE.set(key, null); return null; }
    const point: GeoPoint = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    CACHE.set(key, point);
    return point;
  } catch {
    CACHE.set(key, null);
    return null;
  }
}
