const {createClient}=window.supabase;

const db = (window.BOSSFU_DB ||= createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey));

function applyTeacherPreviewLabels() {
  const frame = document.querySelector('iframe[title="家長頁面預覽"]');
  const doc = frame?.contentDocument;
  if (!doc) return;
  const tab = doc.querySelector('[data-view="feedback"]');
  const section = doc.getElementById('feedback');
  if (tab) tab.textContent = '親師溝通';
  if (!section) return;
  const title = section.querySelector('h2');
  const intro = section.querySelector('p.muted');
  const input = section.querySelector('#feedbackBody');
  const submit = section.querySelector('button');
  if (title) title.textContent = '老師回饋';
  if (intro) intro.textContent = '教師可在此留下給家長的課程提醒與回饋；家長登入後可在自己的頁面留下家長回饋。';
  if (input) input.placeholder = '請輸入要提供給家長的回饋或提醒…';
  if (submit) submit.textContent = '送出老師回饋';
  const form = section.querySelector('#feedbackForm');
  if (form?.dataset.teacherReplyBound) return;
  form.dataset.teacherReplyBound = 'true';
  form.addEventListener('submit', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const body = input?.value.trim();
    const notice = section.querySelector('#feedbackNotice');
    const studentId = doc.getElementById('student')?.value;
    if (!body || !studentId) return;
    notice.textContent = '送出中…';
    const { data: { session } } = await db.auth.getSession();
    const { error } = await db.from('messages').insert({ student_id: studentId, author_id: session?.user.id, author_role: 'teacher', body });
    notice.textContent = error ? '送出失敗，請稍後再試。' : '已送出老師回饋。';
    if (!error) { input.value = ''; frame?.contentWindow?.location.reload(); }
  }, true);
}

document.querySelector('iframe[title="家長頁面預覽"]')?.addEventListener('load', applyTeacherPreviewLabels);
