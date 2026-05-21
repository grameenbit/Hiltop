// Service Worker for Offline Assets (Synchronization is handled via foreground React TS and Native Android Services)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
