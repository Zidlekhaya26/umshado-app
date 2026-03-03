#!/usr/bin/env node
import fs from 'fs';
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

const env = loadEnv('.env.local');
const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const id = process.argv[2];
if (!id) { console.error('Usage: node scripts/inspect_profile.mjs <profileId>'); process.exit(1); }
(async ()=>{
  const { data, error } = await sup.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) { console.error('error', error); process.exit(1); }
  console.log(data);
})();
