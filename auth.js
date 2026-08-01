import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.SUPABASE_CONFIG;
const supabase = createClient(config.url, config.publishableKey);
const isParentPage = location.pathname.endsWith('/parent.html');
const isTeacherPage = !isParentPage;

const style = document.createElement('style');
style.textContent = '#authGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#f4f6f9;padding:20px;font-family:system-ui,sans-serif}#authGate .auth-card{width:min(390px,100%);padding:28px;background:#fff;border:1px solid #dce1ea;border-radius:16px;box-shadow:0 12px 40px rgba(20,35,60,.15)}#authGate h1{font-size:21px;margin:0 0 8px}#authGate p{color:#586074;margin:0 0 18px}#authGate label{display:block;font-size:13px;font-weight:700;margin:12px 0 4px;color:#586074}#authGate input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #c7cdd9;border-radius:9px;font:inherit}#authGate button{margin-top:18px;width:100%;border:0;border-radius:9px;padding:11px;background:#2f7fce;color:#fff;font:inherit;font-weight:700;cursor:pointer}#authGate .error{min-height:20px;margin-top:10px;color:#c43b2f;font-size:13px}#authUser{position:fixed;right:16px;bottom:16px;z-index:30;border:1px solid #dce1ea;background:#fff;border-radius:10px;padding:7px 10px;font:13px system-ui;color:#586074}#authUser a,#authUser button{margin-left:8px;border:0;background:transparent;color:#2f7fce;font:inherit;cursor:pointer;text-decoration:none}';
document.head.append(style);

function accountEmail(value) {
  const digits = value.replace(/\D/g, '');
  return `u${digits}@bossfu-tutor.com`;
}

function showGate(message = '') {
  document.body.insertAdjacentHTML('beforeend', `<div id="authGate"><form class="auth-card" id="authForm"><h1>${isParentPage ? '家長端登入' : '教師端登入'}</h1><p>請使用系統建立的手機帳號與密碼登入。</p><label for="authPhone">手機號碼</label><input id="authPhone" inputmode="tel" autocomplete="username" placeholder="09xxxxxxxx" required><label for="authPassword">密碼</label><input id="authPassword" type="password" autocomplete="current-password" required><button type="submit">登入</button><div class="error" id="authError">${message}</div></form></div>`);
  document.getElementById('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = accountEmail(document.getElementById('authPhone').value);
    const password = document.getElementById('authPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) document.getElementById('authError').textContent = '帳號或密碼不正確。';
  });
}

async function applySession(session) {
  const existing = document.getElementById('authGate');
  if (!session) { if (!existing) showGate(); return; }
  const { data } = await supabase.from('profiles').select('role,display_name,is_active').eq('id', session.user.id).single();
  const role = data?.role;
  if ((isTeacherPage && role !== 'teacher') || (isParentPage && role !== 'parent') || (role === 'parent' && !data?.is_active)) {
    await supabase.auth.signOut();
    if (existing) existing.remove();
    showGate(isParentPage && role === 'parent' ? '此家長帳號尚未開通。' : isParentPage ? '此帳號沒有家長端權限。' : '此帳號沒有教師端權限。');
    return;
  }
  existing?.remove();
  if (!document.getElementById('authUser')) document.body.insertAdjacentHTML('beforeend', `<div id="authUser">${data.display_name || (role === 'teacher' ? '教師' : '家長')}${role === 'teacher' ? '<a href="teacher.html">課務後台</a>' : ''}<button type="button" id="authLogout">登出</button></div>`);
  document.getElementById('authLogout').onclick = () => supabase.auth.signOut();
}

supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => applySession(session), 0));
const { data: { session } } = await supabase.auth.getSession();
applySession(session);
