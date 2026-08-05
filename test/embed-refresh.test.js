/**
 * teacher.html embeds index.html twice as hidden iframes (個人課表 /
 * 新增與管理行程). Each one used to build its own Supabase client on the same
 * storage key as the parent frame, giving three concurrent GoTrueClient
 * instances that each auto-refresh the same session and react to each
 * other's storage events — a documented Supabase footgun, and a plausible
 * source of the CPU pinning / hang reported after the first click.
 * The embedded frames must still see the parent's session, but must not
 * also try to refresh it themselves.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const DIR = path.join(__dirname, '..');
const CONFIG = fs.readFileSync(path.join(DIR, 'supabase-config.js'), 'utf8');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

function autoRefreshFor(pathname, search) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', url: 'https://example.test' + pathname + search });
  const win = dom.window;
  let captured = null;
  win.supabase = { createClient: (u, k, opts) => { captured = opts?.auth?.autoRefreshToken; return { auth: {}, from: () => ({}) }; } };
  win.eval(CONFIG);
  const result = captured;
  win.close();
  return result;
}

console.log('=== 內嵌的個人課表／管理行程 iframe 不可自己搶著刷新 token ===');
check('個人課表 iframe (embed=teacher) 關閉自動刷新',
      autoRefreshFor('/index.html', '?embed=teacher') === false);
check('管理行程 iframe (embed=teacher&tools=1) 關閉自動刷新',
      autoRefreshFor('/index.html', '?embed=teacher&tools=1&view=manage') === false);

console.log('\n=== 真正的入口頁面必須維持自動刷新 ===');
check('老師端主頁面照常自動刷新', autoRefreshFor('/teacher.html', '') === true);
check('家長端主頁面照常自動刷新', autoRefreshFor('/parent.html', '') === true);
check('獨立開啟的個人行程頁（沒有 embed 參數）照常自動刷新',
      autoRefreshFor('/index.html', '') === true);
check('家長端預覽照常自動刷新', autoRefreshFor('/parent-preview.html', '') === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
