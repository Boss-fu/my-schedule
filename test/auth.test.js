/**
 * Auth behaviour that the portals depend on.
 *
 * Two failures motivated these: the teacher portal reloaded itself on every
 * SIGNED_IN, guarded only by sessionStorage, so a browser that blocks storage
 * reloaded forever — rendered, unresponsive, hot. And a signed-in teacher
 * opening the parent portal was redirected away before it could be looked at.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');
const AUTH = fs.readFileSync(path.join(DIR, 'auth.js'), 'utf8');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

console.log('=== 不得在 auth 事件中重新載入頁面 ===');
// Supabase re-emits SIGNED_IN on tab focus and token refresh.
// Strip comments first — they legitimately mention the call they warn against.
const code = AUTH.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const handler = code.slice(code.indexOf('onAuthStateChange'));
check('onAuthStateChange 內沒有 location.reload', !/location\.reload/.test(handler),
      handler.match(/location\.reload[^\n]*/)?.[0] || '');
check('不再依賴 sessionStorage 當重載防護',
      !/bossfu-teacher-session-ready/.test(AUTH));

console.log('\n=== 教師開啟家長端不得被強制導走 ===');
check('保留家長端而非 location.replace', /role === 'teacher' && isParentPage/.test(AUTH));
check('提供回教師後台的提示', /showTeacherNotice/.test(AUTH));

console.log('\n=== 重複的 auth 事件不得重複查詢 profiles ===');
check('有快取 profile', /profileCache/.test(AUTH));
check('有記錄已套用的 session', /appliedKey/.test(AUTH));

(async () => {
  console.log('\n=== 實際跑一次：storage 被封鎖時也不可重載 ===');
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body></body></html>',
    { runScripts: 'dangerously', url: 'https://example.test/teacher.html', virtualConsole: vc });
  const win = dom.window;

  let reloads = 0;
  delete win.location;
  win.location = { pathname: '/teacher.html', search: '', href: 'https://example.test/teacher.html',
                   reload: () => { reloads++; }, replace: () => { reloads++; } };
  // a browser that refuses session storage
  Object.defineProperty(win, 'sessionStorage', {
    value: { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} },
    configurable: true,
  });

  let profileQueries = 0;
  const listeners = [];
  const q = () => { const o = {
    select: () => o, eq: () => o, order: () => o,
    single: () => { profileQueries++; return Promise.resolve({ data: { role: 'teacher', display_name: 'T', is_active: true, must_change_password: false }, error: null }); },
    then: r => Promise.resolve({ data: [], error: null }).then(r) }; return o; };
  const SESSION = { access_token: 'a', refresh_token: 'b', user: { id: 'u1' } };
  win.supabase = { createClient: () => ({
    from: q,
    auth: {
      getSession: () => Promise.resolve({ data: { session: SESSION } }),
      setSession: () => Promise.resolve({ data: { session: SESSION } }),
      refreshSession: () => Promise.resolve({ data: { session: SESSION } }),
      signOut: () => Promise.resolve({}),
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    },
  }) };
  win.SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'k' };

  const s = win.document.createElement('script');
  s.type = 'module';
  s.textContent = AUTH;
  // jsdom won't run modules; execute the body directly instead
  const body = AUTH.replace(/^import[^;]*;$/gm, '');
  win.eval('(async()=>{' + body + '})()');
  await new Promise(r => setTimeout(r, 120));

  // Supabase fires these repeatedly in real use
  for (const ev of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_IN', 'TOKEN_REFRESHED']) {
    listeners.forEach(cb => cb(ev, SESSION));
    await new Promise(r => setTimeout(r, 30));
  }

  check('連續 5 次 auth 事件後仍未重載', reloads === 0, `reloads=${reloads}`);
  check('profiles 只查一次', profileQueries <= 1, `queries=${profileQueries}`);

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
