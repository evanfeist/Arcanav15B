const CACHE = 'arcana-v1';
const ASSETS = [
  './',                // important: relative, not "/"
  'index.html',
  'manifest.webmanifest',
  'cards/back.webp'
  // add any always-needed faces here if you like
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // optional: activate new SW immediately on next nav
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  e.respondWith(
    caches.match(request).then(hit =>
      hit || fetch(request).then(resp => {
        // opportunistic cache for game shell & card images
        if (
          request.url.includes('/cards/') ||
          request.destination === 'document' ||
          request.destination === 'script' ||
          request.destination === 'style'
        ) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return resp;
      }).catch(() => caches.match('index.html')) // offline fallback
    )
  );
});
