import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
const settingKey = 'finance_profile';
let profile = {};

async function loadProfile() {
  const { data } = await db.from('site_settings').select('value').eq('key', settingKey).maybeSingle();
  profile = data?.value || {};
  return profile;
}

function parentInvoicePayment() {
  const preview = document.getElementById('invoicePreview');
  if (!preview) return;
  const current = preview.querySelector('.invoice > p.muted');
  if (!current) return;
  const lines = [profile.teacher, profile.contact, profile.payment].filter(Boolean);
  current.textContent = lines.length ? lines.join('\n') : '付款資訊請洽教師。';
  current.style.whiteSpace = 'pre-line';
}

async function setupTeacherFinanceProfile() {
  const teacher = document.getElementById('financeTeacher');
  if (!teacher) return;
  const localProfile = {
    teacher: teacher.value.trim(),
    contact: document.getElementById('financeContact').value.trim(),
    payment: document.getElementById('financePayment').value.trim(),
  };
  await loadProfile();
  if (!Object.values(profile).some(Boolean) && Object.values(localProfile).some(Boolean)) {
    profile = localProfile;
    await db.from('site_settings').upsert({ key: settingKey, value: profile, updated_at: new Date().toISOString() });
  }
  teacher.value = profile.teacher || '';
  document.getElementById('financeContact').value = profile.contact || '';
  document.getElementById('financePayment').value = profile.payment || '';
  const notice = document.getElementById('financeProfileNotice');
  document.getElementById('saveFinanceProfile').onclick = async () => {
    const value = {
      teacher: teacher.value.trim(),
      contact: document.getElementById('financeContact').value.trim(),
      payment: document.getElementById('financePayment').value.trim(),
    };
    notice.textContent = '儲存中…';
    const { error } = await db.from('site_settings').upsert({ key: settingKey, value, updated_at: new Date().toISOString() });
    if (error) { notice.textContent = '儲存失敗，請稍後再試。'; return; }
    profile = value;
    notice.textContent = '已儲存，家長學費單會同步顯示。';
  };
}

async function setupParentInvoiceProfile() {
  await loadProfile();
  parentInvoicePayment();
  const preview = document.getElementById('invoicePreview');
  if (preview) new MutationObserver(parentInvoicePayment).observe(preview, { childList: true, subtree: true });
}

if (location.pathname.endsWith('/teacher.html') || location.pathname.endsWith('/teacher')) setupTeacherFinanceProfile();
if (location.pathname.endsWith('/parent-preview.html')) setupParentInvoiceProfile();
