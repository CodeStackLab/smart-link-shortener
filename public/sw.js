const CACHE_NAME = 'smartlink-v147';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];

// Install: cache icons
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: delete ALL old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Always network first, never cache stale admin.html, publytics.html or scripts
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Always fetch API and admin/publytics scripts and pages from network
  if (url.pathname.startsWith('/api/') || url.pathname.includes('dashboard') || url.pathname.includes('admin') || url.pathname.includes('login') || url.pathname.includes('publytics')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Static assets (icons)
  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
