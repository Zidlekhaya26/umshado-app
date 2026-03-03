const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  const content = fs.readFileSync(file, 'utf8');
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(?:"([^"]*)"|'([^']*)'|(.*))\s*$/i);
    if (m) vars[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return vars;
}

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('Usage: node scripts/check_couple.js <coupleId>');
  process.exit(1);
}
const id = args[0];
const env = loadEnv(path.join(process.cwd(), '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }});

(async ()=>{
  try{
    const { data, error } = await supabase.from('couples').select('*').eq('id', id).maybeSingle();
    if (error) { console.error('Error', error); process.exit(1); }
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected', e);
    process.exit(1);
  }
})();
