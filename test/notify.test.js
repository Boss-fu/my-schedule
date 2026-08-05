/**
 * The notification centre had two implementations bound to the same bell. The
 * later one replaced the handler that marked notices read, so the badge kept
 * insisting there were new ones no matter how often you opened the panel.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

const STUDENTS = [{ id: 's1', name: '桓安', default_rate: 1200 }];
const LESSONS = [];
const MESSAGES = [
  { id: 'm1', body: '這週作業有點多', created_at: '2026-08-04T10:00:00Z', student_id: 's1', students: { name: '桓安' } },
];
const FILES = [
  { id: 'f1', file_name: '第二次段考卷.jpg', created_at: '2026-08-03T09:00:00Z', student_id: 's1', students: { name: '桓安' } },
];
const SESSION = { access_token: 'x', refresh_token: 'y', user: { id: 'u1' } };

const rows = n => n === 'students' ? STUDENTS
  : n === 'lessons' ? LESSONS
  : n === 'messages' ? MESSAGES
  : n === 'student_files' ? FILES : [];

const q = n => { const o = {
  select: () => o, order: () => o, eq: () => o, in: () => o, limit: () => o,
  insert: () => Promise.resolve({ data: null, error: null }), update: () => o, delete: () => o,
  single: () => Promise.resolve({ data: { role:'teacher', display_name:'T', is_active:true, must_change_password:false }, error:null }),
  then: r => Promise.resolve({ data: rows(n), error: null }).then(r) }; return o; };
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
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  let src = fs.readFileSync(path.join(DIR, 'teacher.html'), 'utf8');
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) =>
    /\bsrc=/.test(attrs) ? '' : '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>');
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, { runScripts:'dangerously', pretendToBeVisual:true,
    url:'https://example.test/teacher.html', virtualConsole: vc,
    beforeParse(win){
      win.SUPABASE_CONFIG={url:'https://x.supabase.co',publishableKey:'k'};
      win.supabase={createClient:client}; win.BOSSFU_DB=client();
      win.alert=m=>errors.push('alert(): '+m); win.confirm=()=>true; win.print=()=>{}; win.scrollTo=()=>{};
      Object.defineProperty(win.HTMLElement.prototype,'scrollIntoView',{value(){},writable:true});
    }});
  const win = dom.window, doc = win.document;
  const $ = id => doc.getElementById(id);
  win.localStorage.clear();
  await new Promise(r => setTimeout(r, 1600));   // bell installs at ~1200ms

  console.log('=== 通知中心 ===');
  const bell = $('teacherBell');
  check('鈴鐺已建立', !!bell);
  if (!bell) { console.log(`\n${pass} passed, ${++fail} failed`); process.exit(1); }

  const badge = $('bellCount');
  check('尚未讀取時顯示未讀數 2', badge.textContent === '2' && badge.style.display !== 'none',
        `text=${badge.textContent} display=${badge.style.display}`);

  bell.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  check('面板已開啟', $('bellPanel').style.display === 'block');
  check('列出兩則通知', doc.querySelectorAll('[data-notice]').length === 2,
        `${doc.querySelectorAll('[data-notice]').length} 則`);
  check('看過後徽章歸零', badge.style.display === 'none', `display=${badge.style.display}`);

  // close, reopen: still zero — this is the behaviour that used to be lost
  bell.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 80));
  bell.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  check('重新開啟後仍不顯示未讀', badge.style.display === 'none', `display=${badge.style.display}`);

  console.log('\n=== 點擊通知的跳轉 ===');
  const items = [...doc.querySelectorAll('[data-notice]')];
  const fileItem = items.find(b => b.textContent.includes('段考卷上傳'));
  check('找得到檔案通知', !!fileItem);
  if (fileItem) {
    fileItem.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    check('跳到檔案中心', $('files').classList.contains('active'));
    check('面板已收起', $('bellPanel').style.display === 'none');
  }

  bell.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  const msgItem = [...doc.querySelectorAll('[data-notice]')].find(b => b.textContent.includes('家長回饋'));
  check('找得到家長回饋通知', !!msgItem);
  if (msgItem) {
    msgItem.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 250));
    check('跳到家長端預覽', $('parentPreview').classList.contains('active'));
  }

  console.log('\n=== 執行期錯誤 ===');
  check('無 runtime error / alert', errors.length === 0, errors.slice(0,2).join(' | '));

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
