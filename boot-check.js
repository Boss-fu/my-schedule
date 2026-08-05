/**
 * The portals wire up every button inside module scripts that need the Supabase
 * client. If that library is missing, the markup still renders and the page
 * looks healthy while ignoring every click — the failure is invisible.
 * Surface it instead, with something the user can act on.
 */
(() => {
  if (window.supabase && typeof window.supabase.createClient === 'function') return;

  const show = () => {
    if (document.getElementById('bootError')) return;
    const banner = document.createElement('div');
    banner.id = 'bootError';
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed', 'inset:auto 0 0 0', 'z-index:10000',
      'padding:16px 18px', 'background:#fff1f2', 'border-top:2px solid #e11d48',
      'color:#9f1239', 'font:14px/1.6 "PingFang TC","Microsoft JhengHei",system-ui,sans-serif',
      'box-shadow:0 -6px 20px rgba(0,0,0,.10)', 'text-align:center',
    ].join(';');
    banner.innerHTML =
      '<b>頁面沒有載入完整，按鈕會沒有反應。</b><br>' +
      '請重新整理一次；若仍相同，請關掉分頁重開，或改用行動網路再試。' +
      '<button type="button" style="margin-left:12px;border:1px solid #e11d48;border-radius:8px;' +
      'background:#fff;color:#9f1239;padding:7px 14px;font:inherit;font-weight:700;cursor:pointer">' +
      '重新整理</button>';
    banner.querySelector('button').onclick = () => location.reload();
    document.body.append(banner);
  };

  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();
