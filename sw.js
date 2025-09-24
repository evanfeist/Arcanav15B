// sw.js  (plain text UTF-8)
const CACHE_NAME = 'arcana-v3';
const ASSETS = [
  './',
  './index.html',
  './cards/back.webp',
  './cards/back.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        ASSETS.map(url => cache.add(url).catch(()=>void 0))
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Only handle http/https GET (skip chrome-extension:, data:, etc.)
function isHttpGet(request){
  if (request.method !== 'GET') return false;
  try{
    const u = new URL(request.url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  }catch{
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isHttpGet(req)) return; // <-- prevents the chrome-extension error

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, copy).catch(()=>{}); // guard put() for opaque responses
        });
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
