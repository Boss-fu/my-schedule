(() => {
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});
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
      if (permission === 'granted') new Notification('福大自然家教通知已開啟', { body: '之後的新訊息與檔案會在此通知。' });
    };
  };
  setTimeout(ask, 700);
})();
