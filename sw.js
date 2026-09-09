// sw.js — app-shell caching for offline use.
//
// The previous version of this app shipped an empty service worker
// file: it registered successfully but cached nothing, so the app
// had no real offline support despite claiming to be a PWA. This
// version precaches the shell and serves it cache-first, falling
// back to the network for anything not yet cached.
//
// Bump CACHE_NAME whenever shell files change so old clients pick up
// the new version instead of serving a stale cache forever.

const CACHE_NAME = 'couple-tools-shell-v1';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/home.css',
  './assets/css/together.css',
  './assets/css/calendar.css',
  './assets/css/settings.css',
  './assets/css/aod.css',
  './assets/css/lock-onboarding.css',
  './assets/css/animations.css',
  './assets/js/app.js',
  './assets/js/core/config.js',
  './assets/js/core/dom.js',
  './assets/js/core/state.js',
  './assets/js/core/utils.js',
  './assets/js/services/audio.service.js',
  './assets/js/services/db.js',
  './assets/js/services/media.service.js',
  './assets/js/services/storage.service.js',
  './assets/js/services/sync.service.js',
  './assets/js/features/aod.js',
  './assets/js/features/backup.js',
  './assets/js/features/calendar.js',
  './assets/js/features/gallery.js',
  './assets/js/features/home.js',
  './assets/js/features/lock.js',
  './assets/js/features/music.js',
  './assets/js/features/onboarding.js',
  './assets/js/features/settings.js',
  './assets/js/features/streak.js',
  './assets/js/features/theme.js',
  './assets/js/features/together.js',
  './assets/js/features/together/bucketList.js',
  './assets/js/features/together/dailyQuestion.js',
  './assets/js/features/together/gratitudeJar.js',
  './assets/js/features/together/loveNotes.js',
  './assets/js/features/together/milestones.js',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-96x96.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/web-app-manifest-192x192.png',
  './assets/icons/web-app-manifest-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Add files individually so one failed fetch (e.g. a CDN
      // vendor script blocked by the network) doesn't abort caching
      // of the rest of the shell.
      await Promise.all(SHELL_FILES.map((url) => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Opportunistically cache same-origin shell files fetched later.
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
