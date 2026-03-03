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

  // Find a couple profile to attach to
  const { data: profile, error: pErr } = await supabase.from('profiles').select('id, full_name, wedding_date, wedding_venue').limit(1).maybeSingle();
  if (pErr) {
    console.error('Error querying profiles:', pErr.message || pErr);
    process.exit(1);
  }
  if (!profile) {
    console.error('No profile rows found. Create a couple account first.');
    process.exit(1);
  }

  const guestName = 'Test Guest';
  const guestPhone = '+27831234567';
  const token = crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=> (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

  const insert = await supabase.from('couple_guests').insert({
    couple_id: profile.id,
    full_name: guestName,
    phone: guestPhone,
    rsvp_token: token,
    invited_via: 'whatsapp'
  }).select().maybeSingle();

  if (insert.error) {
    console.error('Error inserting guest:', insert.error.message || insert.error);
    process.exit(1);
  }

  const guest = insert.data;
  console.log('Created guest:', guest.id);

  const base = env.NEXT_PUBLIC_APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://umshado-app.vercel.app');
  const rsvpUrl = `${base.replace(/\/$/, '')}/rsvp/${guest.id}?t=${encodeURIComponent(token)}&view=card`;

  const coupleName = profile.full_name || 'You';
  let eventLine = '';
  if (profile.wedding_date) {
    try { eventLine += `When: ${new Date(profile.wedding_date).toLocaleString(undefined, { dateStyle: 'long' })}`; } catch(e){}
  }
  if (profile.wedding_venue) eventLine += (eventLine ? ' — ' : '') + `Where: ${profile.wedding_venue}`;

  const message = `Hi ${guestName},\n\n${coupleName} invites you to their wedding 💍${eventLine ? `\n${eventLine}` : ''}\nView your invite & RSVP:\n${rsvpUrl}`.trim();
  const waPhone = guestPhone.replace(/[^0-9]/g, '');
  const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

  console.log('\nRSVP card URL:');
  console.log(rsvpUrl);
  console.log('\nWhatsApp link (open on phone):');
  console.log(waLink);

  // Now simulate an RSVP update (accept)
  const upd = await supabase.from('couple_guests').update({ rsvp_status: 'accepted' }).eq('id', guest.id).select().maybeSingle();
  if (upd.error) {
    console.error('Error updating RSVP status:', upd.error.message || upd.error);
    process.exit(1);
  }
  console.log('\nUpdated RSVP status to accepted. Row:');
  console.log(upd.data);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
