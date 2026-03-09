/**
 * uMshado Service Worker
 * Handles Web Push notifications — fires even when the app is closed.
 */

const CACHE_NAME = 'umshado-v1';

// ── Push event: show notification ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'uMshado', body: event.data.text() };
  }

  const title = payload.title || 'uMshado';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo-icon.png',
    badge: payload.badge || '/logo-icon.png',
    tag: payload.tag || 'umshado-notification',
    data: payload.data || {},
    // Show notification even if app is in focus
    renotify: true,
    requireInteraction: false,
    // Vibration pattern: short buzz
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click: open the app at the right page ───────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const url = data.link || data.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, focus and navigate it
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// ── Push subscription change: re-subscribe automatically ─────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.__VAPID_PUBLIC_KEY__,
    }).then((subscription) => {
      // POST the new subscription to the server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
        credentials: 'include',
      });
    })
  );
});

// ── Install + activate: minimal caching ──────────────────────────────
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
