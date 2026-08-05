/**
 * A working fix means nothing to a browser that never refetches the file it
 * lives in. auth.js kept the same ?v= across several real bug fixes, and
 * supabase-config.js / boot-check.js / pwa.js / index.html's own auth.js tag
 * carried no version string at all — meaning a cached copy from before any
 * of those fixes could keep running indefinitely regardless of what the
 * repository actually contains, which is exactly the kind of thing that
 * makes "I pushed a fix" and "the user sees the fix" two different facts.
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const PAGES = ['index.html', 'teacher.html', 'parent.html', 'parent-preview.html'];

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

console.log('=== 每個本地 JS/CSS 引用、以及每個 iframe 載入的 HTML 都必須帶版本號 ===');
// href="*.html" is a navigation link (e.g. "回教師後台"), not a resource fetch
// — it doesn't need cache-busting. src="*.html" is an iframe load, which does.
const versions = new Set();
const refRe = /(?:src="((?!https?:|\/\/)[\w./-]+\.(?:js|css|html))|href="((?!https?:|\/\/)[\w./-]+\.(?:js|css)))(\?[^"]*)?"/g;

for (const page of PAGES) {
  const content = fs.readFileSync(path.join(DIR, page), 'utf8');
  let m;
  while ((m = refRe.exec(content))) {
    const file = m[1] || m[2];
    const query = m[3];
    const hasVersion = !!query && /\bv=/.test(query);
    check(`${page}: ${file}${query || ''} 有版本號`, hasVersion, query || '(無查詢字串)');
    if (hasVersion) versions.add(query.match(/v=([^&]*)/)[1]);
  }
}

console.log('\n=== 所有版本號必須一致，否則某些檔案會停留在舊版 ===');
check('全站只使用同一組版本號', versions.size <= 1, `發現 ${versions.size} 組：${[...versions].join(', ')}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
