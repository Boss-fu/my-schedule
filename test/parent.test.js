/**
 * Parent portal: the invoice a parent sees must charge only attended lessons,
 * so it always agrees with the invoice the teacher prints.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

const STUDENTS = [{ id: 's1', name: '桓安', default_rate: 1200 }];
const LESSONS = [
  // 8月：實到 2h*1200 = 2400
  { id: 'l1', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-04',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'attended',
    topic: '高三物理', progress: '電磁感應', homework: '', quiz_scope: '', quiz_score: '92',
    teacher_observation: '', next_exam: '' },
  // 請假：不可計費
  { id: 'l2', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-06',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'leave',
    topic: '高三物理', progress: '', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
  // 缺席：不可計費
  { id: 'l3', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-08',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'absent',
    topic: '高三物理', progress: '', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
];
const SESSION = { access_token: 'x', refresh_token: 'y', user: { id: 'u1' } };

const data = n => n === 'students' ? STUDENTS : n === 'lessons' ? LESSONS
  : n === 'issued_invoices' ? [...new Set(LESSONS.map(l => l.lesson_date.slice(0, 7)))].map(m => ({ month: m }))
  : [];
const q = n => { const o = {
  select: () => o, order: () => o, eq: () => o, in: () => o, limit: () => o,
  insert: () => Promise.resolve({ data: null, error: null }), update: () => o, delete: () => o,
  single: () => Promise.resolve({ data: { role:'parent', display_name:'P', is_active:true, must_change_password:false }, error:null }),
  then: r => Promise.resolve({ data: data(n), error: null }).then(r) }; return o; };
const client = () => ({
  from: q, rpc: () => Promise.resolve({ data:null, error:null }),
  functions: { invoke: () => Promise.resolve({ data:null, error:null }) },
  storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data:{signedUrl:'blob:x'}, error:null }),
    upload: () => Promise.resolve({error:null}), remove: () => Promise.resolve({error:null}) }) },
  auth: { getSession: () => Promise.resolve({ data:{session:SESSION} }),
    setSession: () => Promise.resolve({ data:{session:SESSION} }),
    refreshSession: () => Promise.resolve({ data:{session:SESSION} }),
    signOut: () => Promise.resolve({}), updateUser: () => Promise.resolve({error:null}),
    signInWithPassword: () => Promise.resolve({error:null}),
    onAuthStateChange: () => ({ data:{subscription:{unsubscribe(){}}} }) },
});

let pass = 0, fail = 0;
const check = (name, cond, extra='') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  ('+extra+')' : ''}`); }
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  let src = fs.readFileSync(path.join(DIR, 'parent-preview.html'), 'utf8');
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
    if (/\bsrc=/.test(attrs)) return '';
    // module scripts each have their own scope; keep that when downgrading them
    return '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>';
  });
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, { runScripts:'dangerously', pretendToBeVisual:true,
    url:'https://example.test/parent-preview.html', virtualConsole: vc,
    beforeParse(win){
      win.SUPABASE_CONFIG = { url:'https://x.supabase.co', publishableKey:'k' };
      win.supabase = { createClient: client }; win.BOSSFU_DB = client();
      win.alert = m => errors.push('alert(): ' + m);
      win.confirm = () => true; win.print = () => {}; win.scrollTo = () => {};
      Object.defineProperty(win.HTMLElement.prototype,'scrollIntoView',{value(){},writable:true});
    }});
  const win = dom.window, doc = win.document;
  const $ = id => doc.getElementById(id);
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n=== 家長端學費單 ===');
  const invoice = $('invoicePreview').textContent;
  check('只計實到，金額為 2,400', invoice.includes('2,400'), invoice.replace(/\s+/g,' ').slice(0,140));
  check('不得出現含請假的 7,200', !invoice.includes('7,200'));
  check('不得出現含一筆請假的 4,800', !invoice.includes('4,800'));
  check('標示為實到課堂數', invoice.includes('實到課堂數'));
  check('未開立的月份顯示「老師尚未開立」', $('invoiceChoices').textContent.includes('老師尚未開立'));

  console.log('\n=== 家長端課務表 ===');
  const cw = $('courseworkList').textContent;
  check('課務表仍列出全部課次（含請假）', cw.includes('請假'), cw.replace(/\s+/g,' ').slice(0,120));

  console.log('\n=== 執行期錯誤 ===');
  check('無 runtime error / alert', errors.length === 0, errors.slice(0,3).join(' | '));

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
