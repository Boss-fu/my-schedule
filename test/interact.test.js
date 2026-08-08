/** Drives the teacher portal like a user would and asserts each view renders. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');
const STUDENTS = [
  { id: 's1', name: '桓安', default_rate: 1200 },
  { id: 's2', name: '禹安', default_rate: 1000 },
];
const LESSONS = [
  { id: 'l1', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-04',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'attended',
    topic: '高三物理', progress: '電磁感應', homework: 'p.32', quiz_scope: '第3章', quiz_score: '92',
    teacher_observation: '穩定', next_exam: '動量' },
  { id: 'l2', student_id: 's1', students: { name: '桓安' }, lesson_date: '2026-08-06',
    start_time: '19:00:00', end_time: '21:00:00', hours: 2, rate: 1200, status: 'leave',
    topic: '高三物理', progress: '', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
  { id: 'l3', student_id: 's2', students: { name: '禹安' }, lesson_date: '2026-08-03',
    start_time: '18:30:00', end_time: '20:30:00', hours: 2, rate: 1000, status: 'attended',
    topic: '國八理化', progress: '浮力', homework: '', quiz_scope: '', quiz_score: '',
    teacher_observation: '', next_exam: '' },
];
const SESSION = { access_token: 'x', refresh_token: 'y', user: { id: 'u1' } };

const data = n => n === 'students' ? STUDENTS : n === 'lessons' ? LESSONS : [];
const q = n => { const o = {
  select: () => o, order: () => o, eq: () => o, in: () => o, limit: () => o,
  insert: () => Promise.resolve({ data: null, error: null }), update: () => o, delete: () => o,
  single: () => Promise.resolve({ data: { role:'teacher', display_name:'T', is_active:true, must_change_password:false }, error:null }),
  maybeSingle: () => Promise.resolve({ data: (data(n)||[])[0] || null, error:null }),
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
  else { fail++; console.log(`  FAIL  ${name}${extra?'  ('+extra+')':''}`); }
};

(async () => {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  let src = fs.readFileSync(path.join(DIR, 'teacher.html'), 'utf8');
  src = src.replace(/<script type="module"([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
    if (/\bsrc=/.test(attrs)) return '';
    // module scripts each have their own scope; keep that when downgrading them
    return '<scr' + 'ipt>(async()=>{' + body + '})();</scr' + 'ipt>';
  });
  src = src.replace(/<script type="module" src="[^"]*"><\/script>/g, '');

  const dom = new JSDOM(src, { runScripts:'dangerously', pretendToBeVisual:true,
    url:'https://example.test/teacher.html', virtualConsole: vc,
    beforeParse(win){
      win.SUPABASE_CONFIG={url:'https://x.supabase.co',publishableKey:'k'};
      win.supabase={createClient:client}; win.BOSSFU_DB=client();
      win.alert=m=>errors.push('alert(): '+m); win.confirm=()=>true; win.print=()=>{};
      win.scrollTo=()=>{};
      Object.defineProperty(win.HTMLElement.prototype,'scrollIntoView',{value(){},writable:true});
    }});
  const win = dom.window, doc = win.document;
  const $ = id => doc.getElementById(id);
  await new Promise(r => setTimeout(r, 1200));

  console.log('\n=== 分頁切換 ===');
  const views = ['home','lessons','coursework','files','finance','service','parentPreview','schedule','scheduleTools'];
  for (const v of views) {
    const btn = doc.querySelector(`[data-view="${v}"]`);
    if (!btn) { check(`分頁 ${v} 有按鈕`, false); continue; }
    btn.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 60));
    const section = $(v);
    check(`切換到 ${v}`, section && section.classList.contains('active'));
  }

  console.log('\n=== CTA 按鈕在不適用分頁隱藏 ===');
  const cta = $('openLesson');
  doc.querySelector('[data-view="schedule"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  check('個人課表分頁：CTA 隱藏', cta.hidden === true, `hidden=${cta.hidden}`);
  doc.querySelector('[data-view="lessons"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  check('課次分頁：CTA 顯示', cta.hidden === false, `hidden=${cta.hidden}`);

  console.log('\n=== 課次編輯器 ===');
  cta.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 80));
  check('編輯器展開', !$('lessonEditor').classList.contains('hide'));
  check('出席狀態預設為實到', $('formStatus').value === 'attended', $('formStatus').value);
  check('日期預設為今天(本地)', /^\d{4}-\d{2}-\d{2}$/.test($('formDate').value), $('formDate').value);
  check('學生下拉已填入', $('formStudent').options.length === 2, `${$('formStudent').options.length} 筆`);
  check('時薪以 50 元為級距', $('formRate').step === '50', `step=${$('formRate').step}`);

  // open an existing lesson that is 請假 -> status must round-trip
  const editBtn = doc.querySelector('[data-id="l2"]');
  if (editBtn) {
    editBtn.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 80));
    check('編輯請假課次時帶出 leave', $('formStatus').value === 'leave', $('formStatus').value);
  } else check('找得到請假課次的修改鈕', false);

  console.log('\n=== 月份切換一次只能移動一個月 ===');
  // 兩段程式碼曾同時綁在同一顆按鈕上（其中一段跑在 capture 階段），一按就跳兩個月。
  const monthOf = () => $('calendarTitle').textContent.trim();
  doc.querySelector('[data-view="lessons"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 80));
  doc.querySelector('[data-month="current"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  const base = monthOf();
  doc.querySelector('[data-month="next"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  const after1 = monthOf();
  const num = s => { const m = s.match(/(\d{4})\D+(\d{1,2})/); return m ? Number(m[1]) * 12 + Number(m[2]) : NaN; };
  check('下個月只前進 1 個月', num(after1) - num(base) === 1, `${base} → ${after1}`);
  doc.querySelector('[data-month="prev"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  check('上個月退回原本月份', monthOf() === base, `${after1} → ${monthOf()}，原本 ${base}`);
  $('nextMonth').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  check('月曆上的 → 也只前進 1 個月', num(monthOf()) - num(base) === 1, `${base} → ${monthOf()}`);
  $('prevMonth').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  check('月曆上的 ← 也只後退 1 個月', monthOf() === base, `→ ${monthOf()}`);

  console.log('\n=== 課務列展開／收合 ===');
  // 若同一列被綁到兩個處理器，toggle 兩次等於沒反應。
  doc.querySelector('[data-view="coursework"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 80));
  $('workStudent').value = 's1';
  $('workStudent').dispatchEvent(new win.Event('change'));
  await new Promise(r => setTimeout(r, 120));
  const cwRow = doc.querySelector('.coursework-row');
  if (cwRow) {
    cwRow.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 60));
    check('點一下會展開', cwRow.nextElementSibling.classList.contains('open'));
    cwRow.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await new Promise(r => setTimeout(r, 60));
    check('再點一下會收合', !cwRow.nextElementSibling.classList.contains('open'));
  } else check('有課務列可測試', false);

  console.log('\n=== 刪除課次 ===');
  cta.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));   // 回到新增模式
  await new Promise(r => setTimeout(r, 80));
  check('新增模式不顯示刪除鈕', $('deleteLesson').hidden === true, `hidden=${$('deleteLesson').hidden}`);
  const editExisting = doc.querySelector('[data-id="l1"]');
  editExisting.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 80));
  check('修改既有課次時顯示刪除鈕', $('deleteLesson').hidden === false, `hidden=${$('deleteLesson').hidden}`);
  $('resetForm').dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 60));
  check('取消修改後刪除鈕收起', $('deleteLesson').hidden === true);

  console.log('\n=== 重新渲染不可清掉編輯中的選擇 ===');
  // Supabase 會定期更新 token 並觸發重新載入；切換月份也會。
  // 若下拉被重建卻沒保留選取值，課次就會存到錯誤的學生身上。
  doc.querySelector('[data-view="lessons"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 80));
  cta.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
  await new Promise(r => setTimeout(r, 80));
  $('formStudent').value = 's2';
  $('formStatus').value = 'leave';
  const beforeStudent = $('formStudent').value;
  doc.querySelector('[data-month="next"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 150));
  check('切換月份後仍保留所選學生', $('formStudent').value === beforeStudent,
        `切換前 ${beforeStudent} → 切換後 ${$('formStudent').value}`);
  check('切換月份後仍保留出席狀態', $('formStatus').value === 'leave', $('formStatus').value);

  console.log('\n=== 金額口徑一致 ===');
  doc.querySelector('[data-month="prev"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  doc.querySelector('[data-view="finance"]').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  const financeText = $('financeCards').textContent;
  // 8月實到: l1 (2*1200=2400) + l3 (2*1000=2000) = 4400；l2 請假不計
  check('財務卡片只計實到 4,400', financeText.includes('4,400'), financeText.replace(/\s+/g,' ').slice(0,120));
  const summaryText = $('financeSummary').textContent;
  check('彙總不含請假課次金額 2,400', summaryText.includes('2,400'), '');
  check('每堂明細顯示請假狀態', $('financeTable').textContent.includes('請假'));

  console.log('\n=== 執行期錯誤 ===');
  check('無 runtime error / alert', errors.length === 0, errors.slice(0,3).join(' | '));

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
