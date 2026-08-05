const {createClient}=window.supabase;

const db = (window.BOSSFU_DB ||= createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey));
const field = id => document.getElementById(id);

async function fillRate() {
  const box = field('studentDefaultRate');
  if (!box) return;
  const id = field('workStudent')?.value;
  if (!id) { box.value = ''; return; }
  const { data } = await db.from('students').select('default_rate').eq('id', id).single();
  box.value = data?.default_rate ?? '';
}

function setup() {
  if (field('studentDefaultRate')) return true;      // already installed
  const name = field('studentName');
  if (!name) return false;                            // panel not built yet
  const grid = name.closest('.formgrid');
  if (!grid) return false;
  grid.insertAdjacentHTML('beforeend', '<label>預設鐘點費（每小時）<input id="studentDefaultRate" type="number" min="0" step="50" placeholder="例如：1000"></label>');
  field('workStudent')?.addEventListener('change', () => setTimeout(fillRate, 0));
  field('newStudent')?.addEventListener('click', () => { const box = field('studentDefaultRate'); if (box) box.value = ''; });
  field('saveStudentProfile')?.addEventListener('click', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const id = field('workStudent').value;
    const payload = {
      name: field('studentName').value.trim(), grade: field('studentGrade').value.trim(),
      subjects: field('studentSubjects').value.trim(), parent_name: field('studentParentName').value.trim(),
      parent_contact: field('studentParentContact').value.trim(), default_rate: Number(field('studentDefaultRate').value || 0),
    };
    const notice = field('studentGradeNotice');
    if (!payload.name) { notice.textContent = '請先填寫學生姓名。'; return; }
    const { error } = await (id ? db.from('students').update(payload).eq('id', id) : db.from('students').insert(payload));
    if (error) { notice.textContent = '儲存失敗，請稍後再試。'; return; }
    notice.textContent = '已儲存學生資料與預設鐘點費。';
    setTimeout(() => location.reload(), 600);
  }, true);
  fillRate();
  return true;
}

// The student panel is injected by a later module, so a single attempt races
// with it — on a slow device the rate field would simply never appear. Watch
// for the panel instead, and stop as soon as the field is in place.
if (!setup()) {
  const observer = new MutationObserver(() => { if (setup()) observer.disconnect(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // belt and braces: give up watching once the page has settled
  setTimeout(() => observer.disconnect(), 15000);
}
