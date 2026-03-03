const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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
if (args.length < 2) { console.error('Usage: node scripts/fetch_invite.js <guestId> <token>'); process.exit(1); }
const [guestId, token] = args;
const env = loadEnv(path.join(process.cwd(), '.env.local'));
const base = env.NEXT_PUBLIC_APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://umshado-app.vercel.app');
const url = `${base.replace(/\/$/,'')}/api/invite-card/${guestId}/${encodeURIComponent(token)}`;
(async ()=>{
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'debug-fetch/1.0' } });
    const txt = await res.text();
    console.log(txt);
  }catch(e){ console.error(e); process.exit(1); }
})();
