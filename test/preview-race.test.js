/**
 * 家長端預覽 is an iframe that opens alongside the teacher portal, so its first
 * getSession() can legitimately return null. It used to replace the whole .wrap
 * with a "please sign in" card and never retry — destroying the markup, so the
 * preview stayed blank for the rest of the session.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

const STUDENTS = [{ id: 's1', name: '桓安', default_rate: 1200 }];
const LESSONS = [
  { id: 'l1', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-04',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'attended',
    topic: '高三物理', progress: '', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
];
const SESSION = { access_token: 'x', refresh_token: 'y', user: { id: 'u1' } };

const rows = n => n === 'students' ? STUDENTS : n === 'lessons' ? LESSONS
  : n === 'issued_invoices' ? [...new Set(LESSONS.map(l => l.lesson_date.slice(0, 7)))].map(m => ({ month: m }))
  : [];
const q = n => { const o = {
  select: () => o, order: () => o, eq: () => o, in: () => o, limit: () => o,
  insert: () => Promise.resolve({ data: null, error: null }), update: () => o, delete: () => o,
  single: () => Promise.resolve({ data: { role: 'teacher' }, error: null }),
  then: r => Promise.resolve({ data: rows(n), error: null }).then(r) }; return o; };

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

(async () => {
  console.log('=== session 較晚抵達（iframe 常見時序）===');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  let listener = null, ready = false;
  const client = () => ({
    from: q, rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'blob:x' }, error: null }),
      upload: () => Promise.resolve({ error: null }), remove: () => Promise.resolve({ error: null }) }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: ready ? SESSION : null } }),
      setSession: () => Promise.resolve({ data: { session: SESSION } }),
      refreshSession: () => Promise.resolve({ data: { session: SESSION } }),
      signOut: () => Promise.resolve({}), updateUser: () => Promise.resolve({ error: null }),
      signInWithPassword: () => Promise.resolve({ error: null }),
      onAuthStateChange: (cb) => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    },
  });

  let src = fs.readFileSync(path.join(DIR, 'parent-preview.html'), 'utf8');
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) =>
    /\bsrc=/.test(attrs) ? '' : '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>');
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, { runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://example.test/parent-preview.html', virtualConsole: vc,
    beforeParse(win) {
      win.SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'k' };
      win.supabase = { createClient: client }; win.BOSSFU_DB = client();
      win.alert = m => errors.push('alert(): ' + m);
      win.confirm = () => true; win.print = () => {}; win.scrollTo = () => {};
      Object.defineProperty(win.HTMLElement.prototype, 'scrollIntoView', { value() {}, writable: true });
    } });
  const doc = dom.window.document;
  await new Promise(r => setTimeout(r, 400));

  check('尚未取得登入狀態時仍保留頁面結構',
        !!doc.querySelector('.tabs') && !!doc.getElementById('invoicePreview'));
  check('顯示等待中的提示', !!doc.getElementById('previewSignIn'));

  ready = true;                       // the session lands a moment later
  if (listener) listener('SIGNED_IN', SESSION);
  await new Promise(r => setTimeout(r, 500));

  check('session 抵達後自動重試', !doc.getElementById('previewSignIn'));
  check('學生下拉已填入', doc.getElementById('student').options.length === 1,
        `${doc.getElementById('student').options.length} 筆`);
  check('學費單已算出', doc.getElementById('invoicePreview').textContent.includes('2,400'),
        doc.getElementById('invoicePreview').textContent.replace(/\s+/g, ' ').slice(0, 90));
  check('全程沒有執行期錯誤', errors.length === 0, errors[0] || '');

  dom.window.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
