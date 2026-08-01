import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);

async function applyPaymentInfo() {
  const { data } = await db.from('site_settings').select('value').eq('key', 'finance_profile').maybeSingle();
  const profile = data?.value || {};
  const lines = [profile.teacher, profile.contact, profile.payment].filter(Boolean);
  const paint = () => {
    const node = document.querySelector('#invoicePreview .invoice > p.muted');
    if (!node) return;
    node.textContent = '付款資訊\n' + (lines.length ? lines.join('\n') : '請洽教師。');
    node.style.whiteSpace = 'pre-line';
  };
  paint();
  const preview = document.getElementById('invoicePreview');
  if (preview) new MutationObserver(paint).observe(preview, { childList: true, subtree: true });
}

applyPaymentInfo();
