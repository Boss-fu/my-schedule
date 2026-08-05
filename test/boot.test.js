/**
 * The portals bind every control inside module scripts that need the Supabase
 * client. When that library is unavailable the page still renders, so the
 * failure used to be invisible — the app just ignored every click.
 * These tests pin down both halves of the fix: the library is served from the
 * repo (no third-party CDN at runtime), and a missing library is announced.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

console.log('=== 執行期不得依賴第三方 CDN ===');
const PAGES = ['teacher.html', 'parent-preview.html', 'parent.html', 'index.html'];
const SCRIPTS = ['auth.js', 'finance-profile.js', 'student-rate.js', 'teacher-preview-labels.js',
                 'parent-finance-profile.js', 'parent-invoice-payment.js', 'parent-rate-display.js'];
for (const name of [...PAGES, ...SCRIPTS]) {
  const p = path.join(DIR, name);
  if (!fs.existsSync(p)) continue;
  const c = fs.readFileSync(p, 'utf8');
  check(`${name} 不含 esm.sh`, !c.includes('esm.sh'));
}

console.log('\n=== 函式庫由本專案提供 ===');
const vendor = path.join(DIR, 'vendor', 'supabase.js');
check('vendor/supabase.js 存在', fs.existsSync(vendor));
if (fs.existsSync(vendor)) {
  const v = fs.readFileSync(vendor, 'utf8');
  check('是完整 bundle，無外部 import', !/from\s*['"]https?:/.test(v));
  check('檔案大小合理 (>100KB)', v.length > 100_000, `${(v.length / 1024).toFixed(0)}KB`);
}
for (const name of PAGES) {
  const c = fs.readFileSync(path.join(DIR, name), 'utf8');
  const vi = c.indexOf('vendor/supabase.js');
  const ci = c.indexOf('supabase-config.js');
  check(`${name} 先載入 vendor 再載入設定`, vi > -1 && ci > -1 && vi < ci);
}

console.log('\n=== 函式庫缺失時必須明確告知，不可靜默 ===');
(async () => {
  const vc = new VirtualConsole();
  const dom = new JSDOM(
    '<!doctype html><html><body><button id="x">按鈕</button></body></html>',
    { runScripts: 'dangerously', virtualConsole: vc });
  // deliberately do NOT define window.supabase
  const s = dom.window.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(DIR, 'boot-check.js'), 'utf8');
  dom.window.document.body.appendChild(s);
  await new Promise(r => setTimeout(r, 60));

  const banner = dom.window.document.getElementById('bootError');
  check('顯示錯誤橫幅', !!banner);
  if (banner) {
    check('說明按鈕沒有反應的原因', /沒有反應|沒有載入完整/.test(banner.textContent));
    check('提供重新整理的動作', !!banner.querySelector('button'));
    check('橫幅蓋在最上層', banner.style.zIndex === '10000', `z-index=${banner.style.zIndex}`);
    check('橫幅固定在畫面上', banner.style.position === 'fixed', banner.style.position);
  }
  dom.window.close();

  // and stays quiet when the library IS present
  const ok = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', virtualConsole: new VirtualConsole() });
  ok.window.supabase = { createClient: () => ({}) };
  const s2 = ok.window.document.createElement('script');
  s2.textContent = fs.readFileSync(path.join(DIR, 'boot-check.js'), 'utf8');
  ok.window.document.body.appendChild(s2);
  await new Promise(r => setTimeout(r, 60));
  check('函式庫正常時不顯示橫幅', !ok.window.document.getElementById('bootError'));
  ok.window.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
