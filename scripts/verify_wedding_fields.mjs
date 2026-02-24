#!/usr/bin/env node
// Simple verification script — queries /profiles for wedding_date and wedding_venue
// Usage:
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_KEY=<service_role_or_anon> node scripts/verify_wedding_fields.mjs

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment.');
  process.exit(1);
}

const fetchProfiles = async () => {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/profiles?select=id,full_name,wedding_date,wedding_venue&limit=5`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (!res.ok) {
        console.error('Request failed:', res.status, res.statusText);
        console.error('Response:', JSON.stringify(data, null, 2));
        process.exit(2);
      }
      console.log('Profiles sample (max 5):');
      console.table(data.map(d => ({ id: d.id, full_name: d.full_name, wedding_date: d.wedding_date, wedding_venue: d.wedding_venue })));
      process.exit(0);
    } catch (e) {
      console.error('Failed to parse response as JSON:');
      console.error(text);
      process.exit(3);
    }
  } catch (err) {
    console.error('Fetch failed:', err);
    process.exit(4);
  }
};

fetchProfiles();
