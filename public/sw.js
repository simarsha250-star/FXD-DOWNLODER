/* FXD Downloader service worker.
 *
 * scripts/postbuild.mjs replaces BUILD_ID and PRECACHE in dist/sw.js after `vite build`,
 * so every deploy gets its own cache and the exact hashed files the new index.html uses.
 * `npm run dev` never registers this file, so the placeholders below never run.
 *
 * Rules:
 *  - Only same-origin GET requests are handled. Cross-origin requests (file downloads,
 *    link previews from other hosts) always go straight to the network.
 *  - /api/* is never cached.
 *  - Page loads are network-first, with the cached shell as the offline fallback.
 */
const BUILD_ID = '__BUILD_ID__';
const PRECACHE = /*__PRECACHE__*/ [];
const CACHE = 'fxd-' + BUILD_ID;
const OFFLINE_URL = '/offline.html';
const CORE = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })));
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('fxd-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, url));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && url.pathname === '/') {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put('/', copy));
    }
    return response;
  } catch (err) {
    const shell = await caches.match('/', { ignoreSearch: true });
    return shell || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
