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

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found in repo root');
    process.exit(1);
  }
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // pick first profile row
  const { data: profile, error: pErr } = await supabase.from('profiles').select('id, full_name').limit(1).maybeSingle();
  if (pErr) {
    console.error('Error querying profiles:', pErr.message || pErr);
    process.exit(1);
  }
  if (!profile) {
    console.error('No profile rows found. Create a couple account first.');
    process.exit(1);
  }

  const avatar = 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800&h=800&fit=crop';

  // Update the couples table (couples.avatar_url exists in migrations) as a
  // practical test target. We also added a migration to add `profiles.avatar_url`
  // above so the schema can be aligned for future deployments.
  const upd = await supabase.from('couples').update({ avatar_url: avatar }).eq('id', profile.id).select().maybeSingle();
  if (upd.error) {
    console.error('Error updating couples.avatar_url:', upd.error.message || upd.error);
    process.exit(1);
  }
  console.log('Updated couples', profile.id, 'avatar_url ->', avatar);

  const base = env.NEXT_PUBLIC_APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://umshado-app.vercel.app');
  const proxyUrl = `${base.replace(/\/$/, '')}/api/image-proxy?url=${encodeURIComponent(avatar)}`;

  console.log('\nTesting proxy URL:');
  console.log(proxyUrl);

  try {
    const res = await fetch(proxyUrl);
    console.log('Proxy status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const buf = await res.arrayBuffer();
    console.log('Bytes received:', buf.byteLength);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Proxy returned error body:', txt);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error fetching proxy URL:', err);
    process.exit(1);
  }

  console.log('\nProxy test succeeded (deployment must be live for this to pass).');
}

main().catch((err) => { console.error(err); process.exit(1); });
