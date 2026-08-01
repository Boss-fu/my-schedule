import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.SUPABASE_CONFIG;
const supabase = createClient(config.url, config.publishableKey);
const isParentPage = location.pathname.endsWith('/parent.html');
const isTeacherPage = !isParentPage;
const isPersonalSchedulePage = location.pathname.endsWith('/index.html') || location.pathname === '/' || location.pathname.endsWith('/my-schedule/');

const style = document.createElement('style');
style.textContent = '#authGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#f4f6f9;padding:20px;font-family:system-ui,sans-serif}#authGate .auth-card{width:min(390px,100%);padding:28px;background:#fff;border:1px solid #dce1ea;border-radius:16px;box-shadow:0 12px 40px rgba(20,35,60,.15)}#authGate h1{font-size:21px;margin:0 0 8px}#authGate p{color:#586074;margin:0 0 18px}#authGate label{display:block;font-size:13px;font-weight:700;margin:12px 0 4px;color:#586074}#authGate input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #c7cdd9;border-radius:9px;font:inherit}#authGate button{margin-top:18px;width:100%;border:0;border-radius:9px;padding:11px;background:#2f7fce;color:#fff;font:inherit;font-weight:700;cursor:pointer}#authGate .notice{padding:10px 12px;background:#eef6ff;border:1px solid #c9e1f8;border-radius:9px;color:#245986;font-size:13px;line-height:1.55}.auth-inline{color:#2f7fce;font-weight:700}.auth-inline:hover{text-decoration:underline}.auth-secondary{margin-top:9px!important;background:#eef5fc!important;color:#205c95!important}.auth-help{font-size:12px!important;margin:8px 0 0!important}.auth-password-rules{font-size:12px!important;margin:6px 0 0!important}#authGate .error{min-height:20px;margin-top:10px;color:#c43b2f;font-size:13px}#authUser{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;gap:7px;padding:7px;border:1px solid #dce1ea;background:#fff;border-radius:11px;box-shadow:0 5px 18px rgba(20,35,60,.12);font:13px system-ui}#authUser a{border:0;border-radius:7px;background:#eef5fc;color:#205c95;padding:7px 9px;font:inherit;font-weight:700;text-decoration:none;white-space:nowrap}#authUser a:hover{background:#dceeff}';
document.head.append(style);

function accountEmail(value) {
  const digits = value.replace(/\D/g, '');
  return `u${digits}@bossfu-tutor.com`;
}

function showGate(message = '') {
  const parentNotice = isParentPage ? '<p class="notice">首次登入請使用教師提供的預設密碼 <b>00000000</b>。登入後系統會請您立即設定自己的新密碼。</p>' : '';
  document.body.insertAdjacentHTML('beforeend', `<div id="authGate"><form class="auth-card" id="authForm"><h1>${isParentPage ? '家長端登入' : '教師端登入'}</h1><p>請使用系統建立的手機帳號與密碼登入。</p>${parentNotice}<label for="authPhone">手機號碼</label><input id="authPhone" inputmode="tel" autocomplete="username" placeholder="09xxxxxxxx" required><label for="authPassword">密碼</label><input id="authPassword" type="password" autocomplete="current-password" required><button type="submit">登入</button><div class="error" id="authError">${message}</div></form></div>`);
  document.getElementById('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = accountEmail(document.getElementById('authPhone').value);
    const password = document.getElementById('authPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) document.getElementById('authError').textContent = '帳號或密碼不正確。';
  });
}

function showPasswordSetup() {
  const existing = document.getElementById('authGate');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="authGate"><form class="auth-card" id="passwordSetupForm"><h1>請設定您的新密碼</h1><p>為保護學生資料，首次登入後必須先更換預設密碼。</p><label for="newPassword">新密碼</label><input id="newPassword" type="password" autocomplete="new-password" minlength="6" required><p class="auth-password-rules">至少 6 碼，請設定您自己記得住的密碼。</p><label for="confirmPassword">再次輸入新密碼</label><input id="confirmPassword" type="password" autocomplete="new-password" minlength="6" required><button type="submit">儲存並進入家長端</button><div class="error" id="authError"></div></form></div>`);
  document.getElementById('passwordSetupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errorNode = document.getElementById('authError');
    if (password.length < 6) { errorNode.textContent = '密碼至少需要 6 碼。'; return; }
    if (password !== confirm) { errorNode.textContent = '兩次輸入的密碼不一致。'; return; }
    errorNode.textContent = '儲存中…';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { errorNode.textContent = error.message || '密碼儲存失敗，請稍後再試。'; return; }
    const { error: completeError } = await supabase.rpc('complete_initial_parent_password');
    if (completeError) { errorNode.textContent = '密碼已更新，請重新登入後再試。'; return; }
    document.getElementById('authGate')?.remove();
  });
}

async function applySession(session) {
  const existing = document.getElementById('authGate');
  if (!session) { if (!existing) showGate(); return; }
  const { data } = await supabase.from('profiles').select('role,display_name,is_active,must_change_password').eq('id', session.user.id).single();
  const role = data?.role;
  if ((isTeacherPage && role !== 'teacher') || (isParentPage && role !== 'parent') || (role === 'parent' && !data?.is_active)) {
    await supabase.auth.signOut();
    if (existing) existing.remove();
    showGate(isParentPage && role === 'parent' ? '此家長帳號尚未開通。' : isParentPage ? '此帳號沒有家長端權限。' : '此帳號沒有教師端權限。');
    return;
  }
  if (role === 'parent' && data?.must_change_password) { showPasswordSetup(); return; }
  existing?.remove();
  // 個人課表只保留課表本身，不顯示浮動的系統捷徑。
  if (!isPersonalSchedulePage && !document.getElementById('authUser')) {
    const links = role === 'teacher'
      ? '<a href="teacher.html">老師課務後台</a><a href="parent-preview.html">家長端預覽</a>'
      : '<a href="parent.html">家長端介面</a>';
    document.body.insertAdjacentHTML('beforeend', `<nav id="authUser" aria-label="系統捷徑">${links}</nav>`);
  }
}

supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => applySession(session), 0));
const { data: { session } } = await supabase.auth.getSession();
applySession(session);
