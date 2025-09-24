// sw.js
const CACHE_NAME = 'arcana-v1';

// Only cache first-party assets you control.
// Keep this list short and concrete (no wildcards).
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './cards/back.webp',
  // add specific frequently-used card faces you want offline:
  // './cards/ace spades.webp', './cards/j clubs.webp', ...
];

// Helper: http(s) + GET only
const isHttpGet = (req) =>
  req && req.method === 'GET' &&
  (req.url.startsWith('http://') || req.url.startsWith('https://'));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache only good URLs (skip chrome-extension:, data:, etc)
      const good = ASSETS.filter(u => u.startsWith('./') || u.startsWith('http'));
      // addAll is safe and simpler; no manual cache.put on odd schemes
      await cache.addAll(good);
      await self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-http(s) schemes (e.g., chrome-extension:// on desktop browsers)
  if (!(url.protocol === 'http:' || url.protocol === 'https:')) return;

  // Handle page navigations (offline fallback to index.html)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          if (net && net.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, net.clone())).catch(()=>{});
          }
          return net;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Only cache GET requests
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        const ok = res && res.status === 200;
        const sameOrigin = url.origin === self.location.origin;
        if (ok && sameOrigin) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
