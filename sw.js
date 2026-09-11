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

const CACHE_NAME = 'couple-tools-shell-v3';

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles/tokens.css',
  './assets/styles/base.css',
  './assets/styles/components.css',
  './assets/styles/home.css',
  './assets/styles/together.css',
  './assets/styles/calendar.css',
  './assets/styles/settings.css',
  './assets/styles/aod.css',
  './assets/styles/lock-onboarding.css',
  './assets/styles/animations.css',
  './assets/scripts/app.js',
  './assets/scripts/core/config.js',
  './assets/scripts/core/dom.js',
  './assets/scripts/core/state.js',
  './assets/scripts/core/utils.js',
  './assets/scripts/core/datepicker.js',
  './assets/scripts/services/audio.service.js',
  './assets/scripts/services/chime.service.js',
  './assets/scripts/services/db.js',
  './assets/scripts/services/media.service.js',
  './assets/scripts/services/storage.service.js',
  './assets/scripts/services/sync.service.js',
  './assets/scripts/features/aod.js',
  './assets/scripts/features/backup.js',
  './assets/scripts/features/calendar.js',
  './assets/scripts/features/gallery.js',
  './assets/scripts/features/home.js',
  './assets/scripts/features/lock.js',
  './assets/scripts/features/music.js',
  './assets/scripts/features/notifications.js',
  './assets/scripts/features/onboarding.js',
  './assets/scripts/features/settings.js',
  './assets/scripts/features/streak.js',
  './assets/scripts/features/theme.js',
  './assets/scripts/features/together.js',
  './assets/scripts/features/together/bucketList.js',
  './assets/scripts/features/together/dailyQuestion.js',
  './assets/scripts/features/together/gratitudeJar.js',
  './assets/scripts/features/together/loveNotes.js',
  './assets/scripts/features/together/milestones.js',
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
