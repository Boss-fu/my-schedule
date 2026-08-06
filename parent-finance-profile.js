const {createClient}=window.supabase;

const db = (window.BOSSFU_DB ||= createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey));
const defaultProfile = {
  teacher: '福大自然（張家福）',
  contact: 'LINE: jeffreyfuchang / Phone: 0978200135',
  payment: '現金付款／以下帳戶匯款\n台新 (812) 28881008215019\n富邦 (012) 81680017605956',
};

async function applyPayment() {
  const frame = document.querySelector('iframe[title="家長端"]');
  const doc = frame?.contentDocument;
  const preview = doc?.getElementById('invoicePreview');
  if (!preview) return;
  const invoiceTitle = doc.querySelector('#invoice h2');
  const invoiceHint = doc.querySelector('#invoice p.muted');
  if (invoiceTitle) invoiceTitle.textContent = '學費單';
  if (invoiceHint) invoiceHint.textContent = '選擇月份即可查看當月學費明細。';
  const { data } = await db.from('site_settings').select('value').eq('key', 'finance_profile').maybeSingle();
  const saved = data?.value || {};
  const profile = { teacher: saved.teacher || defaultProfile.teacher, contact: saved.contact || defaultProfile.contact, payment: saved.payment || defaultProfile.payment };
  const paint = () => {
    const node = preview.querySelector('.invoice > p.muted');
    if (!node) return;
    const teacherInfo = [profile.teacher, profile.contact].filter(Boolean).join('\n') || '福大自然（張家福）';
    const desired = '老師資訊\n' + teacherInfo + '\n\n付款資訊\n' + (profile.payment || '請洽教師。');
    // 只在文字真的不同時才寫入，否則會不斷自我觸發 observer 造成當機。
    if (node.textContent !== desired) node.textContent = desired;
    if (node.style.whiteSpace !== 'pre-line') node.style.whiteSpace = 'pre-line';
  };
  paint();
  new MutationObserver(paint).observe(preview, { childList: true, subtree: true });
}

document.querySelector('iframe[title="家長端"]')?.addEventListener('load', applyPayment);
db.auth.onAuthStateChange((_event, session) => { if (session) setTimeout(applyPayment, 0); });
