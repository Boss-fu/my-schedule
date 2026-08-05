/**
 * Every other test starts from an already-valid session. None of them actually
 * submit the login form and check that the app becomes interactive afterwards
 * — which is exactly the flow being reported as broken ("登入後全部點不了").
 * This drives that flow end to end.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

const STUDENTS = [{ id: 's1', name: '桓安', default_rate: 1200 }];
const LESSONS = [];
const SESSION = { access_token: 'tok', refresh_token: 'ref', user: { id: 'u1' } };

const rows = n => n === 'students' ? STUDENTS : n === 'lessons' ? LESSONS : [];
const q = () => { const o = {
  select: () => o, order: () => o, eq: () => o, in: () => o, limit: () => o,
  insert: () => Promise.resolve({ data: null, error: null }), update: () => o, delete: () => o,
  single: () => Promise.resolve({ data: { role: 'teacher', display_name: 'T', is_active: true, must_change_password: false }, error: null }),
  then: r => Promise.resolve({ data: [], error: null }).then(r) }; return o; };

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

(async () => {
  console.log('=== 從空白狀態實際登入，並確認登入後可操作 ===');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  let signedIn = false;
  let listeners = [];
  const client = () => ({
    from: q, rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'blob:x' }, error: null }),
      upload: () => Promise.resolve({ error: null }), remove: () => Promise.resolve({ error: null }) }) },
    auth: {
      // no session until sign-in actually happens — the real first-load case
      getSession: () => Promise.resolve({ data: { session: signedIn ? SESSION : null } }),
      setSession: () => Promise.resolve({ data: { session: SESSION } }),
      refreshSession: () => Promise.resolve({ data: { session: SESSION } }),
      signOut: () => Promise.resolve({}),
      updateUser: () => Promise.resolve({ error: null }),
      signInWithPassword: ({ password }) => {
        if (password !== 'correct-password') return Promise.resolve({ error: { message: 'bad credentials' } });
        signedIn = true;
        // Supabase actually fires this once the credentials check out
        setTimeout(() => listeners.forEach(cb => cb('SIGNED_IN', SESSION)), 0);
        return Promise.resolve({ error: null });
      },
      onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    },
  });

  let src = fs.readFileSync(path.join(DIR, 'teacher.html'), 'utf8');
  // auth.js is what shows/hides the login gate — it must actually run, not be
  // dropped like a script jsdom can't execute. Inline the real file in its place.
  const authSrc = fs.readFileSync(path.join(DIR, 'auth.js'), 'utf8')
    .replace(/^import[^;]*;$/gm, '');
  src = src.replace(/<script type="module" src="auth\.js[^"]*"><\/script>/,
    '<scr' + 'ipt>(async()=>{' + authSrc + '})();</scr' + 'ipt>');
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) =>
    /\bsrc=/.test(attrs) ? '' : '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>');
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://example.test/teacher.html', virtualConsole: vc,
    beforeParse(win) {
      win.SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'k' };
      win.supabase = { createClient: client }; win.BOSSFU_DB = client();
      win.alert = m => errors.push('alert(): ' + m);
      win.confirm = () => true; win.print = () => {}; win.scrollTo = () => {};
      Object.defineProperty(win.HTMLElement.prototype, 'scrollIntoView', { value() {}, writable: true });
    } });
  const win = dom.window, doc = win.document;
  await new Promise(r => setTimeout(r, 600));

  console.log('\n=== 登入畫面 ===');
  const gate = doc.getElementById('authGate');
  check('未登入時顯示登入表單', !!gate);
  const form = doc.getElementById('authForm');
  check('表單存在', !!form);
  if (!form) { console.log(`\n${pass} passed, ${++fail} failed`); process.exit(1); }

  console.log('\n=== 密碼錯誤時不應卡住 ===');
  doc.getElementById('authPhone').value = '0912345678';
  doc.getElementById('authPassword').value = 'wrong';
  form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));
  check('顯示密碼錯誤訊息', doc.getElementById('authError')?.textContent.includes('不正確'));
  check('登入表單仍在（沒有卡死）', !!doc.getElementById('authForm'));

  console.log('\n=== 正確登入 ===');
  doc.getElementById('authPassword').value = 'correct-password';
  doc.getElementById('authForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 700));   // profile lookup + applySession settle

  check('登入遮罩已移除', !doc.getElementById('authGate'));
  check('body 不再標記 auth-open', !doc.body.classList.contains('auth-open'));

  console.log('\n=== 登入後畫面必須真的可以點擊 ===');
  const financeBtn = doc.querySelector('[data-view="finance"]');
  check('找得到分頁按鈕', !!financeBtn);
  if (financeBtn) {
    financeBtn.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    check('點擊分頁後確實切換', doc.getElementById('finance')?.classList.contains('active'));
  }
  const openLesson = doc.getElementById('openLesson');
  if (openLesson) {
    doc.querySelector('[data-view="lessons"]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    openLesson.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    check('新增課次也能正常展開', !doc.getElementById('lessonEditor')?.classList.contains('hide'));
  }

  console.log('\n=== 執行期錯誤 ===');
  check('全程沒有 runtime error / alert', errors.length === 0, errors.slice(0, 3).join(' | '));

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
