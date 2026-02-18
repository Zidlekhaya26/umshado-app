const fs = require('fs');
const path = require('path');
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
    const sup = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await sup.from('marketplace_vendors').select('vendor_id,business_name').limit(50);
    console.log('error:', error);
    console.log('rows:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('exception', e);
  }
})();
