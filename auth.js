const {createClient}=window.supabase;

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
style.textContent = '#authGate{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#fafaf9;padding:20px;font-family:"PingFang TC","Microsoft JhengHei",system-ui,sans-serif;pointer-events:auto}body.auth-open iframe{visibility:hidden!important;pointer-events:none!important}#authGate .auth-card{position:relative;z-index:1;width:min(390px,100%);padding:30px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 10px 15px -3px rgba(0,0,0,.08),0 4px 6px -4px rgba(0,0,0,.05)}#authGate h1{font-size:21px;font-weight:900;letter-spacing:-.02em;margin:0 0 8px;color:#1e293b}#authGate p{color:#64748b;margin:0 0 18px;font-size:14px}#authGate label{display:block;font-size:12px;font-weight:800;margin:14px 0 5px;color:#475569}#authGate input{position:relative;z-index:2;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font:inherit;font-size:14px;color:#1e293b;pointer-events:auto}#authGate input:focus{outline:none;border-color:#850103;box-shadow:0 0 0 3px rgba(133,1,3,.12)}#authGate button{margin-top:20px;width:100%;border:1px solid #850103;border-radius:8px;padding:11px;background:#850103;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}#authGate button:hover{background:#6a0002;border-color:#6a0002}#authGate .notice{padding:11px 13px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#b45309;font-size:13px;line-height:1.55}.auth-inline{color:#850103;font-weight:700}.auth-inline:hover{text-decoration:underline}.auth-secondary{margin-top:9px!important;background:#fff!important;color:#475569!important;border-color:#e2e8f0!important}.auth-secondary:hover{background:#f8fafc!important;border-color:#cbd5e1!important}.auth-help{font-size:12px!important;margin:8px 0 0!important;color:#64748b}.auth-password-rules{font-size:12px!important;margin:6px 0 0!important;color:#64748b}#authGate .error{min-height:20px;margin-top:12px;color:#e11d48;font-size:13px;font-weight:700}#authUser{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;gap:7px;padding:7px;border:1px solid #e2e8f0;background:#fff;border-radius:11px;box-shadow:0 4px 6px -1px rgba(0,0,0,.07);font:13px "PingFang TC",system-ui}#authUser a{border:0;border-radius:7px;background:#f8fafc;color:#475569;padding:7px 9px;font:inherit;font-weight:700;text-decoration:none;white-space:nowrap}#authUser a:hover{background:#f1f5f9}';
document.head.append(style);

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

let appliedKey = null;
let profileCache = null;

function showTeacherNotice() {
  if (document.getElementById('teacherOnParent')) return;
  const bar = document.createElement('div');
  bar.id = 'teacherOnParent';
  bar.style.cssText = 'position:fixed;inset:0 0 auto 0;z-index:9998;display:flex;flex-wrap:wrap;'
    + 'align-items:center;justify-content:center;gap:12px;padding:12px 16px;background:#fffbeb;'
    + 'border-bottom:1px solid #fde68a;color:#b45309;'
    + 'font:14px/1.5 "PingFang TC","Microsoft JhengHei",system-ui,sans-serif';
  bar.innerHTML = '<span>您目前以<b>教師</b>身分登入，看到的是家長端畫面。</span>'
    + '<a href="teacher.html" style="border:1px solid #b45309;border-radius:8px;background:#fff;'
    + 'color:#b45309;padding:7px 14px;font-weight:700;text-decoration:none">回教師後台</a>';
  document.body.append(bar);
  document.body.style.paddingTop = '58px';
}

async function applySession(session) {
  const existing = document.getElementById('authGate');
  if (!session) { appliedKey = null; profileCache = null; if (!existing) showGate(); return; }
  latestSession = session;
  window.BOSSFU_AUTH_SESSION = session;
  // 同一位使用者重複觸發事件時，不需要再查一次 profiles，也不需要重跑一次導向。
  const key = session.user.id;
  if (appliedKey === key && document.getElementById('authGate') === null) return;
  let data = profileCache && profileCache.id === key ? profileCache.data : null;
  if (!data) {
    ({ data } = await supabase.from('profiles').select('role,display_name,is_active,must_change_password').eq('id', key).single());
    profileCache = { id: key, data };
  }
  const role = data?.role;
  // 教師開啟家長端時不強制導回：兩端共用同一組 session，硬導會讓教師
  // 永遠無法檢視家長頁面。改為顯示返回教師後台的提示。
  if (role === 'teacher' && isParentPage) {
    existing?.remove();
    document.body.classList.remove('auth-open');
    showTeacherNotice();
    appliedKey = key;
    return;
  }
  if (role === 'teacher' && !isTeacherPortal && !isParentPage && !isEmbeddedSchedule) {
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
  appliedKey = key;
  // 教師端與家長端為獨立入口；登入後固定留在目前頁面，不顯示跨站捷徑。
}

supabase.auth.onAuthStateChange((event, session) => {
  // 不要在這裡呼叫 location.reload()：Supabase 會在分頁取得焦點與更新 token 時
  // 重複觸發事件，一旦瀏覽器封鎖 sessionStorage，防護就失效而變成無限重載
  // （畫面正常、按鈕沒反應、裝置發燙）。頁面本身已會在 session 抵達時重新載入資料。
  if (session) { latestSession = session; window.BOSSFU_AUTH_SESSION = session; }
  if (event === 'SIGNED_OUT') { latestSession = null; appliedKey = null; profileCache = null; }
  setTimeout(() => applySession(session), 0);
});

// 家長端未登入時顯示登入頁；不可在載入期間強制登出，
// 否則首次設定密碼的 session 會被清掉，造成「Auth session missing」。
const { data: { session } } = await supabase.auth.getSession();
applySession(session);
