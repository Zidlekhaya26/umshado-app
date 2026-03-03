#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
const id = process.argv[2];
if (!id) { console.error('Usage: node scripts/query_guest.mjs <guestId>'); process.exit(1); }
function loadEnv(file) { const content = fs.readFileSync(file,'utf8'); const vars = {}; for (const line of content.split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/i); if (m) vars[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''; } return vars; }
const env = loadEnv(path.join(process.cwd(), '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async ()=>{
  const { data, error } = await supabase.from('couple_guests').select('*').eq('id', id).maybeSingle();
  if (error) { console.error('Error', error); process.exit(1); }
  console.log(data);
})();
