import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);

async function applyPayment() {
  const frame = document.querySelector('iframe[title="家長端"]');
  const doc = frame?.contentDocument;
  const preview = doc?.getElementById('invoicePreview');
  if (!preview) return;
  const { data } = await db.from('site_settings').select('value').eq('key', 'finance_profile').maybeSingle();
  const profile = data?.value || {};
  const paint = () => {
    const node = preview.querySelector('.invoice > p.muted');
    if (!node) return;
    const lines = [profile.teacher, profile.contact, profile.payment].filter(Boolean);
    node.textContent = lines.length ? lines.join('\n') : '付款資訊請洽教師。';
    node.style.whiteSpace = 'pre-line';
  };
  paint();
  new MutationObserver(paint).observe(preview, { childList: true, subtree: true });
}

document.querySelector('iframe[title="家長端"]')?.addEventListener('load', applyPayment);
db.auth.onAuthStateChange((_event, session) => { if (session) setTimeout(applyPayment, 0); });
