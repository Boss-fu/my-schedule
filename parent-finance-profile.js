import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);

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
  const profile = data?.value || {};
  const paint = () => {
    const node = preview.querySelector('.invoice > p.muted');
    if (!node) return;
    const lines = [profile.teacher, profile.contact, profile.payment].filter(Boolean);
    node.textContent = '付款資訊\n' + (lines.length ? lines.join('\n') : '請洽教師。');
    node.style.whiteSpace = 'pre-line';
  };
  paint();
  new MutationObserver(paint).observe(preview, { childList: true, subtree: true });
}

document.querySelector('iframe[title="家長端"]')?.addEventListener('load', applyPayment);
db.auth.onAuthStateChange((_event, session) => { if (session) setTimeout(applyPayment, 0); });
