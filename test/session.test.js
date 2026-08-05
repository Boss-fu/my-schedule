/**
 * Both portals live on one origin. Supabase stores a session per storage key,
 * so sharing a key meant signing into one portal silently evicted the other —
 * the two could not be open in the same browser at the same time.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');
const CONFIG = fs.readFileSync(path.join(DIR, 'supabase-config.js'), 'utf8');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

function keyFor(pathname, parentPathname) {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', url: 'https://example.test' + pathname, virtualConsole: vc });
  const win = dom.window;
  let captured = null;
  win.supabase = { createClient: (u, k, opts) => { captured = opts?.auth?.storageKey; return { auth: {}, from: () => ({}) }; } };
  if (parentPathname) {
    // pretend we are an iframe inside the given page
    Object.defineProperty(win, 'parent', {
      value: { location: { pathname: parentPathname } }, configurable: true,
    });
  }
  win.eval(CONFIG);
  const result = { storageKey: captured, portal: win.BOSSFU_PORTAL, hasClient: !!win.BOSSFU_DB };
  win.close();
  return result;
}

console.log('=== 每個入口使用各自的 session 儲存空間 ===');
const teacher = keyFor('/teacher.html');
const parent = keyFor('/parent.html');
check('教師端有自己的 storageKey', !!teacher.storageKey, String(teacher.storageKey));
check('家長端有自己的 storageKey', !!parent.storageKey, String(parent.storageKey));
check('兩者不同（可同時登入）', teacher.storageKey !== parent.storageKey,
      `${teacher.storageKey} vs ${parent.storageKey}`);
check('教師端 portal 標記正確', teacher.portal === 'teacher', teacher.portal);
check('家長端 portal 標記正確', parent.portal === 'parent', parent.portal);
check('都建立了共用 client', teacher.hasClient && parent.hasClient);

console.log('\n=== Vercel 的無副檔名路徑 ===');
check('/teacher 視為教師端', keyFor('/teacher').portal === 'teacher');
check('/parent 視為家長端', keyFor('/parent').portal === 'parent');

console.log('\n=== 內嵌的家長端預覽沿用開啟它的入口 ===');
check('教師後台內的預覽用教師 session',
      keyFor('/parent-preview.html', '/teacher.html').portal === 'teacher');
check('家長頁內的預覽用家長 session',
      keyFor('/parent-preview.html', '/parent.html').portal === 'parent');

console.log('\n=== 個人課表（內嵌於教師後台）===');
check('index.html 視為教師端', keyFor('/index.html').portal === 'teacher');

console.log('\n=== 函式庫缺失時不可再拋錯 ===');
{
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', url: 'https://example.test/teacher.html', virtualConsole: vc });
  let threw = false;
  try { dom.window.eval(CONFIG); } catch (e) { threw = true; }
  check('window.supabase 不存在時不丟例外', !threw);
  check('仍會標記 portal', dom.window.BOSSFU_PORTAL === 'teacher', dom.window.BOSSFU_PORTAL);
  dom.window.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
