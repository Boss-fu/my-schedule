/**
 * Teachers manage several families, so each parent row carries its own
 * "預覽家長畫面" button. It must open the preview tab, name whose view is on
 * screen, and tell the embedded portal which student to show — and it must say
 * something useful when a parent has no student assigned yet.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIR = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? '  (' + extra + ')' : ''}`); }
};

const HTML = fs.readFileSync(path.join(DIR, 'teacher.html'), 'utf8');

console.log('=== 家長清單提供每位家長的預覽入口 ===');
check('每列有預覽按鈕', /data-preview-parent=/.test(HTML));
check('帶上該家長的學生', /data-preview-student=/.test(HTML));
check('未指派學生時會提示', /尚未指派學生/.test(HTML));
check('預覽區會標示目前是誰的畫面', /previewWho/.test(HTML));
check('通知中心與清單共用同一個入口',
      (HTML.match(/BossfuPreviewParent/g) || []).length >= 3,
      `${(HTML.match(/BossfuPreviewParent/g) || []).length} 處`);

(async () => {
  console.log('\n=== 實際點擊預覽 ===');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/not implemented|Could not load/i.test(e.message)) errors.push(e.message); });

  const dom = new JSDOM(
    `<!doctype html><html><body>
       <section class="view" id="parentPreview">
         <p id="previewWho" hidden></p>
         <iframe title="家長頁面預覽"></iframe>
       </section>
       <button data-view="parentPreview"></button>
     </body></html>`,
    { runScripts: 'dangerously', url: 'https://example.test/teacher.html', virtualConsole: vc });
  const win = dom.window, doc = win.document;

  // install the shared entry point exactly as the page defines it
  const at = HTML.indexOf('window.BossfuPreviewParent = function');
  const open = HTML.lastIndexOf('<script>', at);
  const close = HTML.indexOf('</script>', at);
  const helper = HTML.slice(HTML.indexOf('>', open) + 1, close);
  let clicked = false;
  doc.querySelector('[data-view="parentPreview"]').addEventListener('click', () => { clicked = true; });
  const posted = [];
  const frame = doc.querySelector('iframe');
  Object.defineProperty(frame, 'contentWindow', {
    value: { postMessage: (msg) => posted.push(msg) }, configurable: true,
  });
  win.eval(helper);

  win.BossfuPreviewParent('s1', '桓安媽媽');
  await new Promise(r => setTimeout(r, 300));

  check('切換到家長端預覽分頁', clicked);
  const who = doc.getElementById('previewWho');
  check('標示目前顯示誰的畫面', !who.hidden && who.textContent.includes('桓安媽媽'), who.textContent);
  check('已通知內嵌頁面要顯示的學生',
        posted.some(m => m.type === 'bossfu-open-parent-communication' && m.studentId === 's1'),
        JSON.stringify(posted[0] || null));
  check('沒有執行期錯誤', errors.length === 0, errors[0] || '');

  win.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
