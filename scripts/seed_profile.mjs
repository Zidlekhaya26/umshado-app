#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  const content = fs.readFileSync(file, 'utf8');
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/i);
    if (m) vars[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return vars;
}

const root = process.cwd();
const envPath = path.join(root, '.env.local');
if (!fs.existsSync(envPath)) { console.error('.env.local not found'); process.exit(1); }
const env = loadEnv(envPath);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Missing SUPABASE env in .env.local'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// CLI args: [profileId] [partnerOne] [partnerTwo] [avatarUrl] [weddingDate] [weddingVenue]
const args = process.argv.slice(2);
const providedId = args[0] || null;
const partnerOne = args[1] || 'Mthabisi';
const partnerTwo = args[2] || 'Sthabiso';
const avatarUrl = args[3] || 'https://via.placeholder.com/600x600.png?text=Couple';
const weddingDate = args[4] || '2026-03-15';
const weddingVenue = args[5] || 'Sample Venue';

(async ()=>{
  try {
    let profileId = providedId;
    if (!profileId) {
      const { data: p } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
      if (!p || !p.id) { console.error('No profiles found to seed'); process.exit(1); }
      profileId = p.id;
    }

    const combinedName = `${partnerOne.trim()} & ${partnerTwo.trim()}`;

    console.log('Seeding profile', profileId);

    // Update profiles (full_name, avatar_url, wedding_date, wedding_venue)
    const { error: pErr } = await supabase.from('profiles').update({ full_name: combinedName, avatar_url: avatarUrl, wedding_date: weddingDate, wedding_venue: weddingVenue }).eq('id', profileId);
    if (pErr) console.error('profiles update error', pErr.message);

    // Update couples row (partner_name, avatar_url, wedding_date, location)
    const { error: cErr } = await supabase.from('couples').upsert({ id: profileId, partner_name: combinedName, avatar_url: avatarUrl, wedding_date: weddingDate, location: weddingVenue });
    if (cErr) console.error('couples upsert error', cErr.message);

    console.log('Seeded:', { profileId, combinedName, avatarUrl, weddingDate, weddingVenue });
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error', err);
    process.exit(1);
  }
})();
