{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww12720\viewh7800\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /* Arcana service worker \'97 production build */\
const VERSION = "arcana-v3-" + (self.registration.scope || ""); // helps bust old scopes\
const APP_SHELL = [\
  "./",\
  "./index.html",\
  "./manifest.webmanifest",\
  "./cards/back.png",\
  "./cards/back.webp"\
];\
\
// Named caches (versioned)\
const STATIC_CACHE  = `$\{VERSION\}::static`;\
const RUNTIME_CACHE = `$\{VERSION\}::runtime`;\
\
self.addEventListener("install", (event) => \{\
  event.waitUntil(\
    caches.open(STATIC_CACHE).then((c) => c.addAll(APP_SHELL))\
  );\
  self.skipWaiting();\
\});\
\
self.addEventListener("activate", (event) => \{\
  event.waitUntil((async () => \{\
    // Clean out old versions\
    const keys = await caches.keys();\
    await Promise.all(\
      keys\
        .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))\
        .map((k) => caches.delete(k))\
    );\
\
    // Opt-in to navigation preload (faster HTML on slow 3G)\
    if ("navigationPreload" in self.registration) \{\
      try \{ await self.registration.navigationPreload.enable(); \} catch \{\}\
    \}\
    await self.clients.claim();\
  \})());\
\});\
\
self.addEventListener("message", (event) => \{\
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();\
\});\
\
// Helpers\
const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;\
const isCardsImg = (url) => sameOrigin(url) && /\\/cards\\/.+\\.(webp|png|jpg|jpeg|gif)$/i.test(url);\
const isAsset = (req) => ["script", "style", "image", "font"].includes(req.destination);\
\
// Fetch strategies:\
// - HTML navigations: Network-first (with preload) \uc0\u8594  cache fallback \u8594  offline/index.html\
// - /cards/* images: Cache-first (ideal for big image sets)\
// - Other same-origin assets (CSS/JS/fonts/images): Stale-while-revalidate\
// - Everything else: Network-first (no caching)\
self.addEventListener("fetch", (event) => \{\
  const \{ request \} = event;\
\
  // Only handle GET\
  if (request.method !== "GET") return;\
\
  // 1) Navigations (HTML/app-shell)\
  if (request.mode === "navigate") \{\
    event.respondWith((async () => \{\
      try \{\
        const preload = await event.preloadResponse;\
        if (preload) return preload;\
\
        const fresh = await fetch(request);\
        const cache = await caches.open(STATIC_CACHE);\
        // Cache a copy of the current entrypoint\
        cache.put("./index.html", fresh.clone());\
        return fresh;\
      \} catch \{\
        const cache = await caches.open(STATIC_CACHE);\
        return (await cache.match("./index.html")) || Response.error();\
      \}\
    \})());\
    return;\
  \}\
\
  const url = request.url;\
\
  // 2) Card images \uc0\u8594  cache-first\
  if (isCardsImg(url)) \{\
    event.respondWith((async () => \{\
      const cache = await caches.open(RUNTIME_CACHE);\
      const hit = await cache.match(request);\
      if (hit) return hit;\
      try \{\
        const fresh = await fetch(request, \{ credentials: "same-origin" \});\
        cache.put(request, fresh.clone());\
        return fresh;\
      \} catch \{\
        // last-ditch: try static cache (back card), else fail\
        const staticCache = await caches.open(STATIC_CACHE);\
        return (await staticCache.match("./cards/back.webp")) ||\
               (await staticCache.match("./cards/back.png")) ||\
               Response.error();\
      \}\
    \})());\
    return;\
  \}\
\
  // 3) Same-origin CSS/JS/fonts/images \uc0\u8594  stale-while-revalidate\
  if (sameOrigin(url) && isAsset(request)) \{\
    event.respondWith((async () => \{\
      const cache = await caches.open(RUNTIME_CACHE);\
      const cached = await cache.match(request);\
      const network = fetch(request).then((res) => \{\
        cache.put(request, res.clone());\
        return res;\
      \}).catch(() => null);\
      return cached || (await network) || Response.error();\
    \})());\
    return;\
  \}\
\
  // 4) Default \uc0\u8594  network-first (don\'92t cache cross-origin)\
  event.respondWith((async () => \{\
    try \{\
      return await fetch(request);\
    \} catch \{\
      // fall back to cache if we have it (useful for same-origin JSON)\
      const cache = await caches.open(RUNTIME_CACHE);\
      const hit = await cache.match(request);\
      return hit || Response.error();\
    \}\
  \})());\
\});}