/**
 * The 預設鐘點費 field is added to a student panel that a *later* module
 * injects. A single setTimeout attempt raced with that injection, so on a slow
 * device the field could simply never appear. It must survive a late panel.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(DIR, 'student-rate.js'), 'utf8');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

const q = () => { const o = {
  select: () => o, eq: () => o, order: () => o,
  single: () => Promise.resolve({ data: { default_rate: 1200 }, error: null }),
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  update: () => o, insert: () => Promise.resolve({ error: null }),
  then: r => Promise.resolve({ data: [], error: null }).then(r) }; return o; };

function makeDom() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM('<!doctype html><html><body><div id="coursework"></div></body></html>',
    { runScripts: 'dangerously', url: 'https://example.test/teacher.html', virtualConsole: vc });
  dom.window.SUPABASE_CONFIG = { url: 'https://x.supabase.co', publishableKey: 'k' };
  dom.window.supabase = { createClient: () => ({ from: q, auth: { onAuthStateChange: () => ({}) } }) };
  return { dom, errors };
}

const PANEL = '<div class="formgrid">'
  + '<label>姓名<input id="studentName"></label>'
  + '<label>年級<input id="studentGrade"></label>'
  + '<label>科目<input id="studentSubjects"></label>'
  + '<label>家長<input id="studentParentName"></label>'
  + '<label>聯絡<input id="studentParentContact"></label>'
  + '</div><select id="workStudent"><option value=""></option></select>'
  + '<button id="saveStudentProfile"></button><button id="newStudent"></button>'
  + '<span id="studentGradeNotice"></span>';

(async () => {
  console.log('=== 面板比腳本先出現 ===');
  {
    const { dom, errors } = makeDom();
    dom.window.document.getElementById('coursework').innerHTML = PANEL;
    dom.window.eval('(async()=>{' + SRC + '})()');
    await new Promise(r => setTimeout(r, 120));
    check('鐘點費欄位已加入', !!dom.window.document.getElementById('studentDefaultRate'));
    check('沒有執行期錯誤', errors.length === 0, errors[0] || '');
    dom.window.close();
  }

  console.log('\n=== 面板比腳本晚出現（先前會永遠失敗）===');
  {
    const { dom, errors } = makeDom();
    dom.window.eval('(async()=>{' + SRC + '})()');
    await new Promise(r => setTimeout(r, 60));
    check('面板還沒出現時不應崩潰', errors.length === 0, errors[0] || '');
    // the other module injects the panel only now
    dom.window.document.getElementById('coursework').innerHTML = PANEL;
    await new Promise(r => setTimeout(r, 150));
    check('面板出現後仍會補上鐘點費欄位', !!dom.window.document.getElementById('studentDefaultRate'));
    const box = dom.window.document.getElementById('studentDefaultRate');
    if (box) check('級距為 50 元', box.getAttribute('step') === '50', box.getAttribute('step'));
    check('全程沒有執行期錯誤', errors.length === 0, errors[0] || '');
    dom.window.close();
  }

  console.log('\n=== 沒有選學生時不可崩潰 ===');
  {
    const { dom, errors } = makeDom();
    dom.window.document.getElementById('coursework').innerHTML = PANEL;
    dom.window.eval('(async()=>{' + SRC + '})()');
    await new Promise(r => setTimeout(r, 120));
    const sel = dom.window.document.getElementById('workStudent');
    sel.value = '';
    sel.dispatchEvent(new dom.window.Event('change'));
    await new Promise(r => setTimeout(r, 80));
    check('切換到未選取狀態不報錯', errors.length === 0, errors[0] || '');
    dom.window.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
