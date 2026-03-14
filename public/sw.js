// CRM Follow-up Reminder Service Worker
// Handles Web Push notifications with sound

const CACHE_NAME = 'crm-sw-v1';
const NOTIFICATION_SOUND_URL = '/notification-sound.mp3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: '🔔 Recordatorio de Seguimiento',
      body: event.data.text(),
    };
  }

  const title = payload.title || '🔔 Seguimiento CRM';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/vite.svg',
    badge: payload.badge || '/vite.svg',
    tag: payload.tag || 'crm-followup',
    data: payload.data || {},
    vibrate: payload.vibrate || [200, 100, 200, 100, 200],
    requireInteraction: true,
    silent: false,
    actions: [
      { action: 'open', title: '📋 Ver Lead' },
      { action: 'dismiss', title: 'Descartar' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'dismiss') return;

  // Navigate to lead when clicking the notification or "Ver Lead"
  const urlToOpen = data.url || '/leads';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If CRM is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen });
          return;
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(self.location.origin + urlToOpen);
    })
  );
});
