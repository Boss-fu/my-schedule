import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey);
const settingKey = 'finance_profile';
const localKey = 'bossfu-tutor-finance-profile';
let profile = {};
const defaultProfile = {
  teacher: '福大自然（張家福）',
  contact: 'LINE: jeffreyfuchang / Phone: 0978200135',
  payment: '現金付款／以下帳戶匯款\n台新 (812) 28881008215019\n富邦 (012) 81680017605956',
};

async function loadProfile() {
  const { data } = await db.from('site_settings').select('value').eq('key', settingKey).maybeSingle();
  profile = data?.value || {};
  if (!Object.values(profile).some(Boolean)) {
    try { profile = JSON.parse(localStorage.getItem(localKey) || '{}'); } catch (_) { profile = {}; }
  }
  profile = {
    teacher: profile.teacher || defaultProfile.teacher,
    contact: profile.contact || defaultProfile.contact,
    payment: profile.payment || defaultProfile.payment,
  };
  try { localStorage.setItem(localKey, JSON.stringify(profile)); } catch (_) {}
  window.BOSSFU_FINANCE_PROFILE = profile;
  return profile;
}

function parentInvoicePayment() {
  const preview = document.getElementById('invoicePreview');
  if (!preview) return;
  const current = preview.querySelector('.invoice > p.muted');
  if (!current) return;
  const lines = [profile.teacher, profile.contact, profile.payment].filter(Boolean);
  current.textContent = '付款資訊\n' + (lines.length ? lines.join('\n') : '請洽教師。');
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
    try { localStorage.setItem(localKey, JSON.stringify(value)); } catch (_) {}
    window.BOSSFU_FINANCE_PROFILE = value;
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
