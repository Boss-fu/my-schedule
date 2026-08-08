/**
 * Loads each portal page in jsdom with Supabase stubbed out, so page scripts
 * really execute and runtime errors surface. Network is never touched.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

// Minimal Supabase double: every query resolves with fixture rows.
const STUDENTS = [
  { id: 's1', name: '桓安', default_rate: 1200 },
  { id: 's2', name: '禹安', default_rate: 1000 },
];
const LESSONS = [
  { id: 'l1', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-04',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'attended',
    topic: '高三物理', progress: '電磁感應', homework: 'p.32', quiz_scope: '', quiz_score: '92',
    teacher_observation: '穩定', next_exam: '動量' },
  { id: 'l2', student_id: 's2', students: { name: '禹安' }, lesson_date: '2026-08-03',
    start_time: '18:30:00', end_time: '20:30:00', hours: 2, rate: 1000, status: 'leave',
    topic: '國八理化', progress: '', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
];

function tableData(name) {
  if (name === 'students') return STUDENTS;
  if (name === 'lessons') return LESSONS;
  return [];
}

function makeQuery(name) {
  const q = {
    select: () => q, order: () => q, eq: () => q, in: () => q, limit: () => q,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => q, delete: () => q,
    single: () => Promise.resolve({ data: { role: 'teacher', display_name: 'T', is_active: true, must_change_password: false }, error: null }),
    maybeSingle: () => Promise.resolve({ data: tableData(name)[0] || null, error: null }),
    then: (res) => Promise.resolve({ data: tableData(name), error: null }).then(res),
  };
  return q;
}

const SESSION = { access_token: 'x', refresh_token: 'y', user: { id: 'u1' } };
function makeClient() {
  return {
    from: (name) => makeQuery(name),
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    storage: { from: () => ({
      createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'blob:x' }, error: null }),
      upload: () => Promise.resolve({ error: null }),
      remove: () => Promise.resolve({ error: null }),
    }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: SESSION } }),
      setSession: () => Promise.resolve({ data: { session: SESSION } }),
      refreshSession: () => Promise.resolve({ data: { session: SESSION } }),
      signInWithPassword: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({}),
      updateUser: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}

async function run(file) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    // module scripts aren't executed by jsdom; that's expected, not a page bug
    if (/Cannot find module|not implemented|Could not load/i.test(e.message)) return;
    errors.push(e.message + (e.detail ? ' :: ' + e.detail : ''));
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  let src = fs.readFileSync(path.join(DIR, file), 'utf8');
  // jsdom can't run ESM <script type="module">; downgrade them to classic
  // scripts, wrapping each so it keeps the module scope it has in a browser.
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
    if (/\bsrc=/.test(attrs)) return '';                 // external module: skip
    return '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>';
  });
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.test/' + file,
    virtualConsole: vc,
    beforeParse(win) {
      win.SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'k' };
      win.supabase = { createClient: makeClient };
      win.BOSSFU_DB = makeClient();
      win.alert = (m) => errors.push('alert(): ' + m);
      win.confirm = () => true;
      win.print = () => {};
      win.scrollTo = () => {};
      win.matchMedia = win.matchMedia || (() => ({ matches: false, addEventListener(){}, addListener(){} }));
      Object.defineProperty(win.HTMLElement.prototype, 'scrollIntoView', { value(){}, writable: true });
    },
  });

  await new Promise(r => setTimeout(r, 1200));   // let timers/promises settle
  return { dom, errors };
}

(async () => {
  let fail = 0;
  for (const file of ['teacher.html', 'parent-preview.html', 'index.html']) {
    const { dom, errors } = await run(file);
    const doc = dom.window.document;
    console.log(`\n=== ${file} ===`);
    if (errors.length) {
      fail++;
      errors.slice(0, 8).forEach(e => console.log('  RUNTIME ERROR: ' + e));
    } else {
      console.log('  no runtime errors');
    }

    if (file === 'teacher.html') {
      const nav = doc.querySelectorAll('.nav button[data-view]');
      console.log(`  nav tabs: ${nav.length}`);
      const cta = doc.getElementById('openLesson');
      console.log(`  新增課次 button present: ${!!cta}, hidden: ${cta && cta.hidden}`);
      if (cta && cta.hidden) { console.log('  ^ BUG: CTA hidden on default view'); fail++; }
      const status = doc.getElementById('formStatus');
      console.log(`  出席狀態欄位: ${status ? status.tagName + ' with ' + status.options.length + ' options' : 'MISSING'}`);
      if (!status || status.tagName !== 'SELECT') { console.log('  ^ BUG'); fail++; }
      const dash = doc.getElementById('dashboard');
      console.log(`  儀表板已渲染: ${dash && dash.children.length > 0}`);
      const cal = doc.getElementById('calendar');
      console.log(`  月曆格數: ${cal ? cal.children.length : 0}`);
      dom.window.close();
    } else {
      dom.window.close();
    }
  }
  console.log(fail ? `\n${fail} problem(s) found` : '\nall pages loaded clean');
  process.exit(fail ? 1 : 0);
})();
