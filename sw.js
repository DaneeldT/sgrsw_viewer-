// SGRSW Viewer — Service Worker
// Caches shell files on install; caches image assets lazily on first access.
// Update CACHE_VERSION when deploying a new build to force a cache refresh.

const CACHE_VERSION = 'sgrsw-v1';

// Core shell files — pre-cached on install so the app works offline immediately
const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './content.js',
  './manifest.json'
];

// ── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the shell. skipWaiting() activates this worker immediately without
// waiting for existing tabs to close.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
// Delete any old caches from previous versions so stale files don't accumulate.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Strategy:
//   • Image assets (/assets/*)  → Cache-first. Serve from cache if available;
//     otherwise fetch, store in cache, then return. This means each image is
//     only downloaded once and works offline after the first view.
//   • Everything else (HTML, JS) → Network-first. Try the network so updates
//     are picked up; fall back to cache if offline.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests for same-origin resources
  if (event.request.method !== 'GET') return;
  if (!url.origin === self.location.origin) return;

  // ── Cache-first for image assets ──
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request)
          .then(response => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Offline and not yet cached — return empty 408 so the app
            // handles the missing image gracefully (broken-image placeholder)
            return new Response('', {
              status: 408,
              statusText: 'Image not yet cached — connect once to cache it for offline use.'
            });
          });
      })
    );
    return;
  }

  // ── Network-first for shell files ──
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
