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
    console.error('.env.local not found'); process.exit(1);
  }
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const base = env.NEXT_PUBLIC_APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://umshado-app.vercel.app');
  if (!url || !key) { console.error('Missing supabase env'); process.exit(1); }

    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    // Create the test guest via the server-side helper so production can read it
    const createRes = await fetch(base.replace(/\/$/,'') + '/api/test/create-guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (!createRes.ok) { console.error('Failed to create test guest via server', createRes.status); process.exit(1); }
    const createJson = await createRes.json();
    const guestId = createJson.id;
    const token = createJson.token;
    console.log('Created guest', guestId);

  // pick a couple profile
  const { data: profile } = await supabase.from('profiles').select('id, full_name, wedding_date, wedding_venue').limit(1).maybeSingle();
  if (!profile) { console.error('No profiles found'); process.exit(1); }

  // Fetch the created guest record so we can check for name and phone
  const { data: createdGuest } = await supabase.from('couple_guests').select('*').eq('id', guestId).maybeSingle();
  if (!createdGuest) { console.error('Created guest not found in DB'); process.exit(1); }
  const guestName = createdGuest.full_name;
  const guestPhone = createdGuest.phone;

  // Prefer path-based token URL to avoid query param stripping by proxies
  // Prefer the API-based invite HTML endpoint (resilient fallback)
  const rsvpUrl = `${base.replace(/\/$/, '')}/api/invite-card/${guestId}/${encodeURIComponent(token)}`;
  const waLink = `https://wa.me/${guestPhone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent('Hi '+guestName+'\n\n'+(profile.full_name||'The Couple')+' invites you to their wedding \nView your invite & RSVP:\n'+rsvpUrl)}`;

  console.log('RSVP URL:', rsvpUrl);
  console.log('WhatsApp link:', waLink);

  // Fetch card HTML
  console.log('Fetching invite card...');
  const res = await fetch(rsvpUrl, { headers: { 'User-Agent': 'e2e-checker/1.0' } });
  if (!res.ok) { console.error('Failed to fetch card', res.status); process.exit(1); }
  const html = await res.text();

  const checks = [];
  checks.push({ name: 'guestName', ok: html.includes(guestName) });
  checks.push({ name: 'identity', ok: html.includes('I confirm this invite') || html.includes('uniquely issued') });
  checks.push({ name: 'downloadBtn', ok: html.includes('Download Invite') });
  if (profile.avatar_url) checks.push({ name: 'avatarProxy', ok: html.includes('/api/image-proxy?url=') });
  checks.push({ name: 'coupleName', ok: profile.full_name ? html.includes(profile.full_name) : true });
  if (profile.wedding_date) {
    const d = new Date(profile.wedding_date).toLocaleString(undefined, { dateStyle: 'long' });
    checks.push({ name: 'dateDisplay', ok: html.includes(d) });
  }
  if (profile.wedding_venue) checks.push({ name: 'venue', ok: html.includes(profile.wedding_venue) });

  console.log('UI checks:');
  for (const c of checks) console.log('-', c.name, c.ok ? 'OK' : 'MISSING');

  // Extract avatar proxy src
  const m = html.match(/src="(\/api\/image-proxy\?url=[^"\s]+)"/i);
  if (!m) { console.error('No avatar proxy src found'); process.exit(1); }
  const avatarProxyPath = m[1];
  const avatarUrl = base.replace(/\/$/,'') + avatarProxyPath;
  console.log('Avatar proxy URL:', avatarUrl);

  const imgRes = await fetch(avatarUrl, { headers: { 'User-Agent': 'e2e-checker/1.0' } });
  console.log('Avatar proxy status:', imgRes.status, 'content-type:', imgRes.headers.get('content-type'));
  if (!imgRes.ok || !imgRes.headers.get('content-type')?.startsWith('image')) { console.error('Avatar proxy failed'); process.exit(1); }

  // Simulate RSVP via API
  console.log('Posting RSVP accept to /api/rsvp');
  const apiRes = await fetch(base.replace(/\/$/,'') + '/api/rsvp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, status: 'accepted', token }) });
  const apiJson = await apiRes.json().catch(()=>null);
  console.log('API response:', apiRes.status, apiJson);
  if (!apiRes.ok) { console.error('RSVP API failed'); process.exit(1); }

  // Confirm DB
  const { data: final } = await supabase.from('couple_guests').select('rsvp_status').eq('id', guestId).maybeSingle();
  console.log('DB rsvp_status:', final?.rsvp_status);

  const passed = checks.every(c=>c.ok) && imgRes.ok && apiRes.ok && final?.rsvp_status==='accepted';
  console.log('\nE2E result:', passed ? 'PASS' : 'FAIL');
  process.exit(passed?0:2);
}

main().catch(err=>{ console.error(err); process.exit(1); });
