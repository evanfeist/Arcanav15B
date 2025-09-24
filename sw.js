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
  // Ignore non-http(s) schemes (e.g., chrome-extension:// on desktop browsers)
const url = new URL(req.url);
if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
  return; // let the browser handle it
}
  if (!isHttpGet(req)) return; // ignore non-http(s) or non-GET

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      // network-first, then put a clone into cache (best-effort)
      return fetch(req).then((res) => {
        // only cache basic/opaque ok responses
        const ok = res && (res.status === 200 || res.type === 'opaque');
        if (ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())).catch(()=>{});
        }
        return res;
      }).catch(() => cached); // fallback to cache if fetch fails
    })
  );
});
