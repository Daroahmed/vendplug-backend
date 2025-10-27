// Basic VendPlug Service Worker
const CACHE_NAME = 'vendplug-app-shell-v7.3';
const APP_SHELL = [
  '/',
  '/public-buyer-home.html',
  '/offline.html',
  '/CSS/ads.css',
  '/js/auth-utils.js',
  '/js/cart-badge.js',
  '/js/adManager.js',
  '/js/config.js',
  '/manifest.webmanifest',
  '/logo.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)));
    // Notify pages that precache is ready
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'PRECACHE_READY' }));
  })());
  self.clients.claim();
});

// Strategies:
// - HTML: network-first, fallback to cache, then /offline.html
// - Scripts/Styles: network-first (ensure fresh code), fallback to cache
// - Images/Fonts: cache-first
// - API GET: network-first (avoid stale UI), fallback to cache
// - API non-GET: network-only; on success, purge cached API GETs
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== location.origin) return;

  // Avoid caching sensitive operations
  const isAPI = url.pathname.startsWith('/api/');
  const isGET = req.method === 'GET';
  const isHTML = req.headers.get('accept')?.includes('text/html');
  const wantsFresh = url.searchParams.get('fresh') === '1' || req.cache === 'no-store' || req.headers.get('cache-control')?.includes('no-store');

  // HTML: network-first
  if (isHTML) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Scripts/Styles: network-first to ensure latest code; Images/Fonts: cache-first
  if (req.destination === 'script' || req.destination === 'style') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Fallback to offline page for app shell scripts if not cached
        if (req.url.endsWith('/js/pwa-register.js')) {
          const offlineResponse = await caches.match('/offline.html');
          if (offlineResponse) return offlineResponse;
          return new Response('/* PWA registration script not available */', { 
            status: 503, 
            headers: { 'Content-Type': 'application/javascript' } 
          });
        }
        return new Response('/* script fetch failed */', { status: 503, headers: { 'Content-Type': 'application/javascript' } });
      })
    );
    return;
  }
  if (req.destination === 'image' || req.destination === 'font') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('/offline.html')))
    );
    return;
  }

  // API non-GET: network-only; on success, purge cached API GETs so next reads are fresh
  if (isAPI && !isGET) {
    event.respondWith(
      fetch(req).then((res) => {
        // Purge cached API GETs (best-effort)
        caches.open(CACHE_NAME).then(async (c) => {
          try {
            const keys = await c.keys();
            await Promise.all(keys.map((k) => {
              const u = new URL(k.url);
              if (u.pathname.startsWith('/api/') && k.method === 'GET') {
                return c.delete(k);
              }
              return Promise.resolve(false);
            }));
          } catch(_) {}
        });
        return res;
      }).catch(() => new Response(JSON.stringify({ error: 'Network error' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // API GET: network-first (unless explicitly fresh-only), fallback to cache
  if (isAPI && isGET) {
    if (wantsFresh) {
      event.respondWith(fetch(req));
      return;
    }
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(_){}
  const title = data.title || 'VendPlug';
  const options = {
    body: data.message || '',
    icon: '/favicon.png',
    data: data.url || '/public-buyer-home.html',
    timestamp: Date.now()
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/public-buyer-home.html';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const client of list) {
      if (client.url.includes(url) && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});


