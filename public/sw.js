const CACHE_NAME = 'smartlink-v223';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/publytics-icon.png',
  '/manifest.json',
  '/css/style.css?v=223',
  '/css/publytics.css?v=223',
  '/js/dashboard.js?v=223',
  '/js/publytics.js?v=223',
  '/uploads/admin_alert_header_banner.png',
  '/uploads/admin_alert_info_banner.png'
];

// Install: pre-cache static assets
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

// Fetch: Network-first for dynamic API & HTML; Stale-While-Revalidate for CSS/JS/images
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dynamic API calls, shortlinks and HTML pages always fetch from network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/') || url.pathname === '/admin' || url.pathname === '/login' || url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets (CSS, JS, images, fonts): Stale-While-Revalidate for instant 0ms load on distant cell towers
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
