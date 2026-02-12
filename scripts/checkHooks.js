const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (/\.tsx?$/.test(file)) {
      results.push(filePath);
    }
  });
  return results;
}

const root = process.cwd();
const files = walk(root);
let bad = [];
files.forEach(f => {
  if (f.includes('node_modules') || f.includes('.next') || f.includes('scripts')) return;
  try {
    const txt = fs.readFileSync(f,'utf8');
    if (/use(State|Effect|Ref|Context|Reducer)\(/.test(txt) || /use[A-Z]/.test(txt)) {
      // find first non-empty line
      const lines = txt.split(/\r?\n/);
      const first = lines.find(l => l.trim() !== '');
      if (!first || !/^['\"]use client['\"]/.test(first.trim())) {
        bad.push(f);
      }
    }
  } catch (e) {}
});

if (bad.length === 0) {
  console.log('OK: all hook-using files are client components');
  process.exit(0);
}
console.log('Files using hooks without "use client":');
bad.forEach(f => console.log(f));
process.exit(0);
