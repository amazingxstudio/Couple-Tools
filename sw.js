// sw.js — app-shell caching for offline use.
//
// Fetch strategy: stale-while-revalidate. Every request is served from
// cache instantly if present (fast, works offline), while a network
// fetch runs in the background to refresh that cache entry for next
// time. This means a normal content change (editing a CSS/JS file,
// swapping an icon) does NOT require bumping CACHE_NAME anymore — the
// next time the app is opened online, the cache quietly updates itself,
// and the change shows up on the load after that.
//
// You only need to bump CACHE_NAME when the SHELL_FILES list itself
// changes shape — adding or removing a precached file path — so a
// fresh install can precache the new set from scratch.

const CACHE_NAME = 'couple-tools-shell-v6';

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
  './assets/icons/apps/nexusduos-bot.png',
  './assets/icons/apps/chatgpt-logo.png',
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
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      // Always try the network in the background and refresh the
      // cache entry, whether or not we already have a cached copy.
      const network = fetch(req)
        .then((res) => {
          if (res.ok && new URL(req.url).origin === self.location.origin) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // Cached copy wins for speed (and offline); otherwise wait on
      // the network fetch we just kicked off above.
      return cached || (await network) || Response.error();
    })
  );
});
