import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
const defaultProfile = {
  teacher: '福大自然（張家福）',
  contact: 'LINE: jeffreyfuchang / Phone: 0978200135',
  payment: '現金付款／以下帳戶匯款\n台新 (812) 28881008215019\n富邦 (012) 81680017605956',
};

async function applyPaymentInfo() {
  const { data } = await db.from('site_settings').select('value').eq('key', 'finance_profile').maybeSingle();
  const saved = data?.value || {};
  const profile = { teacher: saved.teacher || defaultProfile.teacher, contact: saved.contact || defaultProfile.contact, payment: saved.payment || defaultProfile.payment };
  const paint = () => {
    const node = document.querySelector('#invoicePreview .invoice > p.muted');
    if (!node) return;
    const teacherInfo = [profile.teacher, profile.contact].filter(Boolean).join('\n') || '福大自然（張家福）';
    node.textContent = '老師資訊\n' + teacherInfo + '\n\n付款資訊\n' + (profile.payment || '請洽教師。');
    node.style.whiteSpace = 'pre-line';
  };
  paint();
  const preview = document.getElementById('invoicePreview');
  if (preview) new MutationObserver(paint).observe(preview, { childList: true, subtree: true });
}

applyPaymentInfo();
