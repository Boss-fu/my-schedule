import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.SUPABASE_CONFIG;
const supabase = (window.BOSSFU_DB ||= createClient(config.url, config.publishableKey));
const isParentPage = location.pathname.endsWith('/parent.html') || location.pathname.endsWith('/parent');
const isTeacherPage = !isParentPage;
const isTeacherPortal = location.pathname.endsWith('/teacher.html') || location.pathname.endsWith('/teacher');
const isEmbeddedSchedule = location.pathname.endsWith('/index.html') && new URLSearchParams(location.search).has('embed');
let latestSession = null;

async function ensureSession() {
  let { data: { session } } = await supabase.auth.getSession();
  const candidate = session || latestSession;
  // 多個同網域頁面同時初始化 Supabase 時，先把目前 session 明確寫回此 client，
  // 再刷新 token，避免 updateUser 誤判為沒有登入。
  if (candidate?.access_token && candidate?.refresh_token) {
    const { data } = await supabase.auth.setSession({
      access_token: candidate.access_token,
      refresh_token: candidate.refresh_token,
    });
    session = data?.session || null;
  }
  if (session) {
    const { data } = await supabase.auth.refreshSession();
    session = data?.session || session;
    latestSession = session;
  }
  return session;
}

const style = document.createElement('style');
style.textContent = '#authGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#f4f6f9;padding:20px;font-family:system-ui,sans-serif;pointer-events:auto}body.auth-open iframe{visibility:hidden!important;pointer-events:none!important}#authGate .auth-card{position:relative;z-index:1;width:min(390px,100%);padding:28px;background:#fff;border:1px solid #dce1ea;border-radius:16px;box-shadow:0 12px 40px rgba(20,35,60,.15)}#authGate h1{font-size:21px;margin:0 0 8px}#authGate p{color:#586074;margin:0 0 18px}#authGate label{display:block;font-size:13px;font-weight:700;margin:12px 0 4px;color:#586074}#authGate input{position:relative;z-index:2;width:100%;box-sizing:border-box;padding:10px;border:1px solid #c7cdd9;border-radius:9px;font:inherit;pointer-events:auto}#authGate button{margin-top:18px;width:100%;border:0;border-radius:9px;padding:11px;background:#2f7fce;color:#fff;font:inherit;font-weight:700;cursor:pointer}#authGate .notice{padding:10px 12px;background:#eef6ff;border:1px solid #c9e1f8;border-radius:9px;color:#245986;font-size:13px;line-height:1.55}.auth-inline{color:#2f7fce;font-weight:700}.auth-inline:hover{text-decoration:underline}.auth-secondary{margin-top:9px!important;background:#eef5fc!important;color:#205c95!important}.auth-help{font-size:12px!important;margin:8px 0 0!important}.auth-password-rules{font-size:12px!important;margin:6px 0 0!important}#authGate .error{min-height:20px;margin-top:10px;color:#c43b2f;font-size:13px}#authUser{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;gap:7px;padding:7px;border:1px solid #dce1ea;background:#fff;border-radius:11px;box-shadow:0 5px 18px rgba(20,35,60,.12);font:13px system-ui}#authUser a{border:0;border-radius:7px;background:#eef5fc;color:#205c95;padding:7px 9px;font:inherit;font-weight:700;text-decoration:none;white-space:nowrap}#authUser a:hover{background:#dceeff}';
document.head.append(style);
// 登入入口也使用與課務平台相同的暖白、酒紅與金色語言，避免登入前後視覺斷裂。
style.textContent += '#authGate{background:#f5f4f0}#authGate .auth-card{background:#fffdfa;border-color:#e8e1d6;border-radius:15px;box-shadow:0 14px 42px rgba(68,45,25,.10)}#authGate h1{color:#242a31}#authGate p,#authGate label{color:#746f68}#authGate input{border-color:#e0d9ce;border-radius:9px;background:#fffefa;color:#272b30}#authGate input:focus{outline:3px solid rgba(214,168,81,.22);border-color:#c79b51}#authGate button{background:#8d2b2e;border:1px solid #8d2b2e;border-radius:9px;box-shadow:0 3px 8px rgba(116,33,35,.16)}#authGate button:hover{background:#742226}#authGate .notice{background:#fbf6ea;border-color:#ead9b8;color:#735529}.auth-secondary{background:#fff9ef!important;color:#7d292d!important;border-color:#e5cfaa!important}#authGate .error{color:#aa3930}';

function accountEmail(value) {
  const digits = value.replace(/\D/g, '');
  return `u${digits}@bossfu-tutor.com`;
}

function showGate(message = '') {
  document.body.classList.add('auth-open');
  const parentNotice = isParentPage ? '<p class="notice">首次登入請使用教師提供的預設密碼 <b>00000000</b>。登入後系統會請您立即設定自己的新密碼。</p>' : '';
  document.body.insertAdjacentHTML('beforeend', `<div id="authGate"><form class="auth-card" id="authForm"><h1>${isParentPage ? '家長端登入' : '教師端登入'}</h1><p>請使用系統建立的手機帳號與密碼登入。</p>${parentNotice}<label for="authPhone">手機號碼</label><input id="authPhone" inputmode="tel" autocomplete="username" placeholder="09xxxxxxxx" required><label for="authPassword">密碼</label><input id="authPassword" type="password" autocomplete="current-password" required><button type="submit">登入</button><div class="error" id="authError">${message}</div></form></div>`);
  document.getElementById('authForm').addEventListener('submit', async event => {
    event.preventDefault();
    const email = accountEmail(document.getElementById('authPhone').value);
    const password = document.getElementById('authPassword').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) document.getElementById('authError').textContent = '帳號或密碼不正確。';
    else if (isParentPage) location.reload();
  });
}

function showPasswordSetup() {
  document.body.classList.add('auth-open');
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
    const session = await ensureSession();
    if (!session) { errorNode.textContent = '登入已逾時，請回到登入頁重新登入後再設定密碼。'; return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { errorNode.textContent = error.message || '密碼儲存失敗，請稍後再試。'; return; }
    const { error: completeError } = await supabase.rpc('complete_initial_parent_password');
    if (completeError) { errorNode.textContent = '密碼已更新，請重新登入後再試。'; return; }
    // 改密碼完成後重新載入，讓家長資料 iframe 以已更新的 session 初始化。
    if (isParentPage) { location.reload(); return; }
    document.getElementById('authGate')?.remove();
    document.body.classList.remove('auth-open');
  });
}

async function applySession(session) {
  const existing = document.getElementById('authGate');
  if (!session) { if (!existing) showGate(); return; }
  latestSession = session;
  window.BOSSFU_AUTH_SESSION = session;
  const { data } = await supabase.from('profiles').select('role,display_name,is_active,must_change_password').eq('id', session.user.id).single();
  const role = data?.role;
  // 教師不論由哪個入口登入，都統一回到教師客務後台。
  if (role === 'teacher' && !isTeacherPortal && !isEmbeddedSchedule) {
    location.replace('teacher.html');
    return;
  }
  if ((isTeacherPage && role !== 'teacher') || (isParentPage && role !== 'parent') || (role === 'parent' && !data?.is_active)) {
    await supabase.auth.signOut();
    if (existing) existing.remove();
    showGate(isParentPage && role === 'parent' ? '此家長帳號尚未開通。' : isParentPage ? '此帳號沒有家長端權限。' : '此帳號沒有教師端權限。');
    return;
  }
  // Supabase 會在登入與 token 初始化時各觸發一次事件；若每次都重建表單，
  // 家長剛輸入的新密碼就會被清空，看起來像「無法輸入」。
  if (role === 'parent' && data?.must_change_password) {
    if (!document.getElementById('passwordSetupForm')) showPasswordSetup();
    return;
  }
  // parent.html 是唯一的登入／啟用入口；完成啟用後在相同網址載入家長內容。
  if (isParentPage && role === 'parent') {
    existing?.remove();
    document.body.classList.remove('auth-open');
    window.BossfuOpenParentPortal?.();
    return;
  }
  existing?.remove();
  document.body.classList.remove('auth-open');
  // 教師端與家長端為獨立入口；登入後固定留在目前頁面，不顯示跨站捷徑。
}

supabase.auth.onAuthStateChange((event, session) => {
  // 新網域首次登入時，頁面主程式可能早於 session 完成而先載入成空白。
  // 登入成功後只重載一次，確保所有課次、學生與財務查詢都以有效 session 初始化。
  if (event === 'SIGNED_IN' && isTeacherPortal && !sessionStorage.getItem('bossfu-teacher-session-ready')) {
    sessionStorage.setItem('bossfu-teacher-session-ready', '1');
    location.reload();
    return;
  }
  if (session) { latestSession = session; window.BOSSFU_AUTH_SESSION = session; }
  if (event === 'SIGNED_OUT') { latestSession = null; sessionStorage.removeItem('bossfu-teacher-session-ready'); }
  setTimeout(() => applySession(session), 0);
});

// 家長端未登入時顯示登入頁；不可在載入期間強制登出，
// 否則首次設定密碼的 session 會被清掉，造成「Auth session missing」。
const { data: { session } } = await supabase.auth.getSession();
applySession(session);
