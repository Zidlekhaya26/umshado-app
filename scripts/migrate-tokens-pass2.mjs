/**
 * Pass 2: Replace raw hex values in inline-style strings with CSS var() references.
 * Run: node scripts/migrate-tokens-pass2.mjs
 */
import fs from 'fs';
import path from 'path';

const replacements = [
  // Order matters — do longer/more-specific first
  [/#9A2143/gi,  'var(--um-crimson)'],
  [/#731832/gi,  'var(--um-crimson-dark)'],
  [/#4d0f21/gi,  'var(--um-crimson-deep)'],
  [/#b8315a/gi,  'var(--um-crimson-mid)'],
  [/#BD983F/gi,  'var(--um-gold)'],
  [/#8a6010/gi,  'var(--um-gold-dark)'],
  [/#1a0d12/gi,  'var(--um-dark)'],
  [/#7a5060/gi,  'var(--um-muted)'],
  [/#faf8f5/gi,  'var(--um-ivory)'],
  [/#e8d5d0/gi,  'var(--um-border-rose)'],
];

// Files still containing raw hex after pass 1
const files = [
  'app/auth/sign-in/page.tsx',
  'app/auth/sign-up/page.tsx',
  'app/couple/bookings/page.tsx',
  'app/couple/dashboard/page.tsx',
  'app/couple/menu/page.tsx',
  'app/couple/playlist/page.tsx',
  'app/live/guest/page.tsx',
  'app/live/page.tsx',
  'app/messages/page.tsx',
  'app/messages/thread/[threadId]/page.tsx',
  'app/notifications/page.tsx',
  'app/page.tsx',
  'app/playlist/[coupleId]/request/page.tsx',
  'app/settings/page.tsx',
  'app/switch-role/page.tsx',
  'app/vendor/availability/page.tsx',
  'app/vendor/billing/page.tsx',
  'app/vendor/bookings/page.tsx',
  'app/vendor/dashboard/page.tsx',
  'app/vendor/inbox/page.tsx',
  'app/vendor/insights/page.tsx',
  'components/AvailabilityCalendar.tsx',
  'components/BottomNav.tsx',
  'components/ErrorBoundary.tsx',
  'components/RateVendorSheet.tsx',
  'components/RoleGate.tsx',
  'components/SeatingPlanner.tsx',
  'components/VendorBottomNav.tsx',
];

for (const relPath of files) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) { console.warn(`SKIP (not found): ${relPath}`); continue; }

  let src = fs.readFileSync(fullPath, 'utf8');
  let changed = 0;

  for (const [pattern, replacement] of replacements) {
    const before = src;
    src = src.replace(pattern, replacement);
    if (src !== before) changed++;
  }

  if (changed > 0) {
    fs.writeFileSync(fullPath, src, 'utf8');
    console.log(`  OK (${changed} patterns): ${relPath}`);
  } else {
    console.log(`  NO CHANGE: ${relPath}`);
  }
}
console.log('\nPass 2 done.');
