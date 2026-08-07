const VAPID_PUBLIC = 'BO6FbyL6xjvU1dOXMR-FftzzjhurqId_HlXilPujisFNLxjgJMN64dFlj8d5hJHA-B2pJNPL4Ye6FQhDJIB28Zg';

function urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// 把這台裝置的推播訂閱存進 push_subscriptions（需先在 Supabase 建表）。
async function subscribePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const db = window.BOSSFU_DB;
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (!session?.user) return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
    const k = sub.toJSON().keys || {};
    await db.from('push_subscriptions').upsert(
      { user_id: session.user.id, endpoint: sub.endpoint, p256dh: k.p256dh, auth: k.auth },
      { onConflict: 'endpoint' },
    );
  } catch (_) {}
}

// 事件發生時觸發推播（容錯：Edge Function／資料表尚未部署時安靜略過，不影響原功能）。
window.bossfuPush = async function (targetUserIds, title, body, url) {
  try {
    const db = window.BOSSFU_DB;
    if (!db || !targetUserIds || !targetUserIds.length) return;
    await db.functions.invoke('send-push', { body: { target_user_ids: targetUserIds, title, body, url } });
  } catch (_) {}
};
window.bossfuPushRole = async function (role, title, body, url) {
  try {
    const db = window.BOSSFU_DB;
    if (!db) return;
    await db.functions.invoke('send-push', { body: { target_role: role, title, body, url } });
  } catch (_) {}
};

(() => {
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js')
    .then(() => { if ('Notification' in window && Notification.permission === 'granted') subscribePush(); })
    .catch(() => {});
  if (!isStandalone || !('Notification' in window) || Notification.permission !== 'default') return;
  if (localStorage.getItem('bossfu-notification-prompted')) return;

  const ask = () => {
    if (document.getElementById('pushConsent')) return;
    const prompt = document.createElement('aside');
    prompt.id = 'pushConsent';
    prompt.style.cssText = 'position:fixed;z-index:9999;left:16px;right:16px;bottom:16px;max-width:520px;margin:auto;padding:18px;background:#fff;border:1px solid #d8e3ef;border-radius:14px;box-shadow:0 12px 34px rgba(20,40,70,.2);font:14px/1.55 system-ui;color:#1b2735';
    prompt.innerHTML = '<b style="font-size:17px">要開啟手機通知嗎？</b><p style="margin:6px 0 12px;color:#657388">老師的新訊息、講義與練習上傳時，會顯示在手機通知中。</p><button id="enablePush" style="border:0;border-radius:8px;background:#2d7dcc;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer">開啟通知</button> <button id="laterPush" style="border:1px solid #d8e3ef;border-radius:8px;background:#fff;padding:9px 13px;font-weight:800;cursor:pointer">稍後再說</button>';
    document.body.append(prompt);
    document.getElementById('laterPush').onclick = () => { localStorage.setItem('bossfu-notification-prompted', 'later'); prompt.remove(); };
    document.getElementById('enablePush').onclick = async () => {
      const permission = await Notification.requestPermission();
      localStorage.setItem('bossfu-notification-prompted', permission);
      prompt.remove();
      if (permission === 'granted') {
        new Notification('福大自然家教通知已開啟', { body: '之後的新訊息與檔案會在此通知。' });
        subscribePush();
      }
    };
  };
  setTimeout(ask, 700);
})();
