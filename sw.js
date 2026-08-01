const CACHE = 'bossfu-tutor-shell-v1';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['./'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  const data = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(data.title || '福大自然家教通知', {
    body: data.body || '您有一則新的通知。',
    icon: './icon-192-v3.png',
    badge: './icon-192-v3.png',
    data: { url: data.url || './parent.html' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || './parent.html'));
});
