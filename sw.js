// sw.js — Arcana full-offline service worker
// Bump this when you change code or art to force an update:
const CACHE_NAME = 'arcana-v3';

// ---- App shell (kept small)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './cards/back.webp',
  './cards/back.png', // include PNG so icons are cached offline too
];

// ---- Generate full deck face paths (match your filenames exactly)
const SUITS = ['spades', 'hearts', 'clubs', 'diamonds'];
const RANKS = ['ace', '2','3','4','5','6','7','8','9','10', 'j','q','k'];
const FACES = SUITS.flatMap(suit => RANKS.map(rank => `./cards/${rank} ${suit}.webp`));

// Pages (1–4) and Sigils (1–4). Adjust counts if your art differs.
const PAGES  = [1,2,3,4].map(n => `./cards/page ${n}.webp`);
const SIGILS = [1,2,3,4].map(n => `./cards/sigil ${n}.webp`);

// Final precache list
const ASSETS = [...STATIC_ASSETS, ...FACES, ...PAGES, ...SIGILS];

// --- Install: precache everything (skip any missing files without failing)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of ASSETS) {
      try { await cache.add(url); } catch (_) { /* ignore 404s */ }
    }
    await self.skipWaiting();
  })());
});

// --- Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// --- Fetch:
// • Navigations: network-first, fallback to cached index (offline).
// • Other GETs: cache-first for same-origin, then network; store successful responses.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-http(s)
  if (!(url.protocol === 'http:' || url.protocol === 'https:')) return;

  // Page navigations
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        if (net && net.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(req, net.clone())).catch(()=>{});
        }
        return net;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Non-GET requests: passthrough
  if (req.method !== 'GET') return;

  // Assets/data: cache-first, then network; cache same-origin successes
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      const ok = res && res.status === 200;
      const sameOrigin = url.origin === self.location.origin;
      if (ok && sameOrigin) {
        caches.open(CACHE_NAME).then(c => c.put(req, res.clone())).catch(()=>{});
      }
      return res;
    } catch {
      // As a last resort, return whatever we had (if any)
      return cached;
    }
  })());
});
