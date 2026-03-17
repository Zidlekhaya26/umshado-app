/**
 * Replaces local token const declarations with a single import from @/lib/tokens.
 * Run: node scripts/migrate-tokens.mjs
 */
import fs from 'fs';
import path from 'path';

const TOKEN_NAMES = ['CR', 'CR2', 'CRX', 'GD', 'GD2', 'DK', 'MUT', 'BOR', 'BG', 'GR', 'BL'];

// Regex to detect a line that is purely a token constant declaration
// Handles both multi-token lines and individual ones
const TOKEN_LINE_RE = new RegExp(
  // Must start (possibly with whitespace) with "const" followed by one of our tokens
  `^\\s*const\\s+(${TOKEN_NAMES.join('|')})\\s*[=,]`,
);

const files = [
  'app/auth/sign-in/page.tsx',
  'app/auth/sign-up/page.tsx',
  'app/couple/bookings/page.tsx',
  'app/couple/menu/page.tsx',
  'app/couple/onboarding/page.tsx',
  'app/couple/playlist/page.tsx',
  'app/live/guest/page.tsx',
  'app/live/page.tsx',
  'app/notifications/page.tsx',
  'app/page.tsx',
  'app/playlist/[coupleId]/request/page.tsx',
  'app/switch-role/page.tsx',
  'app/v/[vendorId]/VendorPublicClient.tsx',
  'app/vendor/availability/page.tsx',
  'app/vendor/bookings/page.tsx',
  'app/vendor/dashboard/page.tsx',
  'app/vendor/inbox/page.tsx',
  'app/vendor/insights/page.tsx',
  'app/vendor/media/page.tsx',
  'app/vendor/onboarding/page.tsx',
  'app/vendor/packages/page.tsx',
  'app/vendor/profile/edit/page.tsx',
  'app/vendor/review/page.tsx',
  'app/vendor/services/page.tsx',
  'components/AvailabilityCalendar.tsx',
  'components/BottomNav.tsx',
  'components/VendorBottomNav.tsx',
  'components/VendorOnboardingProgress.tsx',
];

// Lines that are ONLY token declarations (no other meaningful code on the line)
function isTokenDeclarationLine(line) {
  // Check if the line is a standalone token block (all assignments on this line are token vars)
  const stripped = line.trim();
  if (!stripped.startsWith('const ')) return false;

  // Remove "const " prefix and trailing semicolons/whitespace
  const body = stripped.replace(/^const\s+/, '').replace(/;?\s*$/, '');

  // Split by comma to get individual assignments
  const parts = body.split(',').map(p => p.trim());

  // Each part should be "TOKEN = 'value'" where TOKEN is one of our tokens
  const tokenSet = new Set(TOKEN_NAMES);
  return parts.every(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return false;
    const name = part.slice(0, eqIdx).trim();
    return tokenSet.has(name);
  });
}

// Extract which tokens are used in the file (after stripping declaration lines)
function usedTokens(lines, declarationLineNums) {
  const declarationSet = new Set(declarationLineNums);
  const used = new Set();

  lines.forEach((line, idx) => {
    if (declarationSet.has(idx)) return;
    for (const t of TOKEN_NAMES) {
      // Match as a standalone word (not part of a longer identifier)
      if (new RegExp(`\\b${t}\\b`).test(line)) {
        used.add(t);
      }
    }
  });

  return used;
}

function processFile(relPath) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  SKIP (not found): ${relPath}`);
    return;
  }

  const src = fs.readFileSync(fullPath, 'utf8');
  const lines = src.split('\n');

  // Find all token declaration lines
  const declarationLineNums = [];
  lines.forEach((line, idx) => {
    if (isTokenDeclarationLine(line)) {
      declarationLineNums.push(idx);
    }
  });

  if (declarationLineNums.length === 0) {
    console.log(`  SKIP (no token decls): ${relPath}`);
    return;
  }

  // Determine which tokens are actually used elsewhere in the file
  const used = usedTokens(lines, declarationLineNums);

  if (used.size === 0) {
    console.log(`  SKIP (tokens declared but unused): ${relPath}`);
    return;
  }

  // Build import line (sorted for consistency)
  const sortedUsed = TOKEN_NAMES.filter(t => used.has(t));
  const importLine = `import { ${sortedUsed.join(', ')} } from '@/lib/tokens';`;

  // Check if import already exists
  const alreadyImported = lines.some(l => l.includes("from '@/lib/tokens'"));

  // Remove declaration lines (filter them out)
  const newLines = lines.filter((_, idx) => !declarationLineNums.includes(idx));

  // Find where to insert import — after the last existing import line
  let lastImportIdx = -1;
  newLines.forEach((line, idx) => {
    if (/^import\s/.test(line.trim())) lastImportIdx = idx;
  });

  if (!alreadyImported) {
    newLines.splice(lastImportIdx + 1, 0, importLine);
  }

  // Clean up consecutive blank lines that might result from removing decl blocks
  const cleaned = newLines.join('\n').replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(fullPath, cleaned, 'utf8');
  console.log(`  OK: ${relPath}  (removed ${declarationLineNums.length} lines, import: ${importLine})`);
}

console.log('Migrating token declarations...\n');
for (const f of files) {
  processFile(f);
}
console.log('\nDone.');
