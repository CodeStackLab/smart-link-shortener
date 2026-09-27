const CACHE_NAME = 'smartlink-v230';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/publytics-icon.png',
  '/manifest.json',
  '/css/style.css?v=230',
  '/css/publytics.css?v=230',
  '/js/dashboard.js?v=230',
  '/js/publytics.js?v=230',
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: Network-first for dynamic API, shortlinks, HTML pages, and JS/CSS files
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Dynamic API calls, shortlinks and HTML pages always fetch from network
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/') || url.pathname === '/admin' || url.pathname === '/login' || url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // JS & CSS: Network-First so code updates apply immediately without waiting for cache eviction
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (images, icons, fonts): Stale-While-Revalidate
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
