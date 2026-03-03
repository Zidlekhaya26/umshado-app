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
if (!args[0]) { console.error('Usage: node scripts/inspect_invite_data.js <guestId> [token]'); process.exit(1); }
const guestId = args[0];
const token = args[1] || null;

const env = loadEnv(path.join(process.cwd(), '.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

(async ()=>{
  const { data: guest } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  console.log('guest:', guest);
  if (!guest) return;
  if (token && guest.rsvp_token !== token) {
    console.log('token mismatch; attempting lookup by token');
    const { data: byToken } = await supabase.from('couple_guests').select('*').eq('rsvp_token', token).maybeSingle();
    console.log('byToken:', byToken);
  }

  let coupleName = '';
  let avatar_url = '';
  let wedding_date = '';
  let wedding_venue = '';

  const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, wedding_date, wedding_venue').eq('id', guest.couple_id).maybeSingle();
  console.log('profile row:', profile);
  if (profile) {
    coupleName = profile.full_name ?? '';
    avatar_url = profile.avatar_url ?? '';
    wedding_date = profile.wedding_date ?? '';
    wedding_venue = profile.wedding_venue ?? '';
  }

  if ((!avatar_url || !wedding_date || !wedding_venue)) {
    const { data: coupleRow } = await supabase.from('couples').select('partner_name, avatar_url, wedding_date, location').eq('id', guest.couple_id).maybeSingle();
    console.log('couples row:', coupleRow);
    if (coupleRow) {
      if (!coupleName) coupleName = coupleRow.partner_name ?? '';
      if (!avatar_url) avatar_url = coupleRow.avatar_url ?? '';
      if (!wedding_date) wedding_date = coupleRow.wedding_date ?? '';
      if (!wedding_venue) wedding_venue = coupleRow.location ?? '';
    }
  }

  console.log({ coupleName, avatar_url, wedding_date, wedding_venue });
})();
