'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface UserLocation {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  label: string; // "Sandton, Johannesburg"
}

const LS_KEY = 'umshado_location';
const LS_TTL = 1000 * 60 * 60 * 6; // 6 hours — refresh if stale

function loadCached(): UserLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) { localStorage.removeItem(LS_KEY); return null; }
    return data as UserLocation;
  } catch { return null; }
}

function saveCache(loc: UserLocation) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data: loc })); } catch {}
}

export function clearLocationCache() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

/* ─── Reverse geocode via OpenStreetMap Nominatim (free, no key) ─── */
async function reverseGeocode(lat: number, lng: number): Promise<UserLocation | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'uMshado-App' } }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const addr = j.address || {};

    const city =
      addr.city || addr.town || addr.village || addr.suburb ||
      addr.county || addr.state_district || addr.state || '';
    const country = addr.country || '';
    const countryCode = (addr.country_code || '').toUpperCase();

    // Build nice label like "Sandton, Johannesburg" or "Cape Town"
    const suburb = addr.suburb || addr.neighbourhood || '';
    const label = suburb && suburb !== city
      ? `${suburb}, ${city}`.replace(/^,\s*/, '').replace(/,\s*$/, '')
      : city;

    if (!city && !country) return null;
    return { city, country, countryCode, lat, lng, label: label || city };
  } catch { return null; }
}

/* ─── Persist to Supabase profile ─── */
async function persistToProfile(loc: UserLocation) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').update({
      location_city: loc.city,
      location_country: loc.country,
      location_country_code: loc.countryCode,
      location_lat: loc.lat,
      location_lng: loc.lng,
      location_updated_at: new Date().toISOString(),
    }).eq('id', user.id);
  } catch { /* non-fatal */ }
}

/* ─── Main hook ─── */
export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(() => loadCached());
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [permission, setPermission] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const detect = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadCached();
      if (cached) { setLocation(cached); return; }
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setLoading(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPermission('granted');
        const loc = await reverseGeocode(lat, lng);
        if (loc) {
          setLocation(loc);
          saveCache(loc);
          persistToProfile(loc); // fire-and-forget
        } else {
          setError('Could not determine location');
        }
        setLoading(false);
      },
      (err) => {
        setPermission(err.code === 1 ? 'denied' : 'prompt');
        setError(err.code === 1 ? 'Location access denied' : 'Location unavailable');
        setLoading(false);
      },
      { timeout: 8000, maximumAge: 1000 * 60 * 30 }
    );
  }, []);

  // Check permission status on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(r => {
        setPermission(r.state as any);
        r.onchange = () => setPermission(r.state as any);
      }).catch(() => {});
    }
    // Auto-detect from cache
    const cached = loadCached();
    if (cached) setLocation(cached);
  }, []);

  return { location, loading, error, permission, detect };
}

/* ─── Distance helper (Haversine, km) ─── */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
