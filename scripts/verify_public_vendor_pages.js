const fs = require('fs');
const path = require('path');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

function parseEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return text.split(/\r?\n/).reduce((acc, line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return acc;
    const m = line.match(/^([^=]+)=(?:"([\s\S]*)"|(.*))$/);
    if (m) acc[m[1]] = m[2] || m[3];
    return acc;
  }, {});
}

(async () => {
  try {
    const env = parseEnv(path.resolve(__dirname, '..', '.env.local'));
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
      process.exit(2);
    }

    const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await sup.from('marketplace_vendors').select('vendor_id,business_name').limit(10);
    if (error) {
      console.error('Supabase error:', error);
      process.exit(3);
    }
    const ids = (data || []).map(r => ({ id: r.vendor_id, name: r.business_name }));
    if (ids.length === 0) {
      console.log('No vendors returned from marketplace_vendors view.');
      process.exit(0);
    }

    for (const v of ids) {
      await new Promise((resolve) => {
        const url = `http://localhost:3001/v/${v.id}`;
        http.get(url, (res) => {
          let d = '';
          res.on('data', (c) => d += c);
          res.on('end', () => {
            const notFound = d.includes('Vendor not found') || d.includes('Vendor not found');
            console.log(`${v.id} — ${v.name ?? '<no name>'} — status=${res.statusCode} — ${notFound ? 'NOT FOUND' : 'OK'}`);
            resolve();
          });
        }).on('error', (e) => { console.error('Request error for', v.id, e.message); resolve(); });
      });
    }
  } catch (e) {
    console.error('exception', e);
    process.exit(1);
  }
})();
