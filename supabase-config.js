window.SUPABASE_CONFIG = {
  url: 'https://gfqtzcmaoxftzfrnjxqq.supabase.co',
  publishableKey: 'sb_publishable_lM4f_ALgcCOhQQM-TIlBEQ_EsoPnrdD'
};

// Supabase keeps one session per storage key. Both portals share an origin, so
// with a single key the second login evicted the first and the teacher and
// parent portals could not be open at the same time. Give each portal its own
// key, and build the one shared client here so every module reuses it.
(function () {
  function portalFor(pathname) {
    return /parent(\.html)?$/.test(pathname) ? 'parent' : 'teacher';
  }

  var portal;
  if (/parent-preview/.test(location.pathname)) {
    // The preview is embedded by both portals; follow whoever opened it.
    try {
      portal = window.parent !== window ? portalFor(window.parent.location.pathname) : 'parent';
    } catch (e) {
      portal = 'parent';
    }
  } else {
    portal = portalFor(location.pathname);
  }

  window.BOSSFU_PORTAL = portal;
  window.BOSSFU_STORAGE_KEY = 'bossfu-auth-' + portal;

  // The teacher portal embeds index.html twice as hidden iframes (個人課表 /
  // 新增與管理行程). Each one used to build its own Supabase client on the
  // same storage key as the parent frame — three independent GoTrueClient
  // instances, each with its own auto-refresh timer, all reading and writing
  // the same localStorage entry and reacting to each other's "storage"
  // events. Supabase's own docs warn against sharing a storage key across
  // concurrently-running clients for exactly this reason; the plausible
  // result here is a refresh feedback loop that pins the CPU and can hang
  // the tab. The embedded frames still need to read the session the parent
  // is already authenticated with, they just must not also try to renew it.
  // 被嵌在別頁裡的 iframe 不自己刷新 token，只由最上層頁面負責；否則多個共用同一
  // storageKey 的 client 會互相搶著刷新，形成 refresh 回饋迴圈把 CPU 跑滿 → 整頁凍住、
  // 裝置發燙。原本只擋 index.html 的嵌入，漏掉了 parent-preview（它在教師端也用
  // bossfu-auth-teacher 這把鍵，且原本仍開著自動刷新）；這裡補上「parent-preview 被
  // 嵌入時（window.parent !== window）」一併擋掉，即為教師端凍住/發燙的根因。
  var isEmbedded =
    (/\/index\.html$/.test(location.pathname) && /[?&]embed=/.test(location.search))
    || (/parent-preview/.test(location.pathname) && window.parent !== window);

  // boot-check.js already reports a missing library; don't throw on top of it.
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return;

  window.BOSSFU_DB = window.BOSSFU_DB || window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.publishableKey,
    { auth: { storageKey: window.BOSSFU_STORAGE_KEY, persistSession: true, autoRefreshToken: !isEmbedded } }
  );
})();
