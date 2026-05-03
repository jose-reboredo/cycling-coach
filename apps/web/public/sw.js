// Cycling Coach service worker — minimal, hand-rolled. No Workbox.
// Strategy:
//   • Static assets (JS, CSS, fonts, SVG): cache-first with background revalidation
//   • Navigation requests: network-first, fall back to cached index.html offline
//   • API/auth (/api/*, /authorize, /callback, /refresh, /coach*, /webhook,
//     /version): always passthrough to network. Never cached.
//
// Bump CACHE on every meaningful release so old payloads get evicted.
//
// v10.11.1 — bumped after 12+ releases of staleness. The SW had been
// stuck at v8.4.1 since Sprint 4; on activate we evict every cache name
// that doesn't match. Effect on rollout: existing PWA-installed users
// get a one-time eviction of every cached asset on next launch, then
// rebuild the cache against the current bundle. No flash, no logout.
const CACHE = 'cycling-coach-v11.4.0';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

const NEVER_CACHE = (path) =>
  path.startsWith('/api/') ||
  path === '/authorize' ||
  path === '/callback' ||
  path === '/refresh' ||
  path.startsWith('/coach') ||
  path === '/webhook' ||
  path === '/version' ||
  path === '/roadmap' ||
  path.startsWith('/admin/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cross-origin (Geist fonts on Google) — let the browser handle.
  if (url.origin !== self.location.origin) return;
  // API + auth — never cache.
  if (NEVER_CACHE(url.pathname)) return;
  // Only handle GETs.
  if (request.method !== 'GET') return;

  // Navigation request → network-first, fall back to cached SPA shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put('/', clone));
          return res;
        })
        .catch(() => caches.match('/').then((m) => m || new Response('Offline', { status: 503 }))),
    );
    return;
  }

  // Static asset → cache-first, revalidate in background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
