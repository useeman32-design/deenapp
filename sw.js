/* pass 83-30 — DeenLink web push service worker.
 * Registered by lib/push.ts on the browser. Two jobs:
 *  1. show the server's web-push payloads as notifications;
 *  2. tapping a notification focuses DeenLink (or opens the payload URL).
 * VAPID + subscriptions live server-side (api/notifications/web_push_*). */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'DeenLink', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'DeenLink';
  const body = payload.body || '';
  const url = payload.url || '/';
  const icon = payload.icon || '/img/logo.png';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: payload.tag || 'deenlink',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (u.pathname === target || u.pathname === '/') {
            await client.focus();
            if (u.pathname !== target) client.navigate && client.navigate(target);
            return;
          }
        } catch (e) { /* keep looking */ }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
