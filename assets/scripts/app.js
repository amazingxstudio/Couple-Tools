// app.js — boot sequence. Loads data, shows the PIN lock or the
// onboarding wizard if needed, then wires up every feature module
// and the bottom navigation dock.

import { $, $$, on, openSurface, closeSurface } from './core/dom.js';
import { Store } from './core/state.js';
import { initTheme, applyThemeImmediate } from './features/theme.js';
import { isLockEnabled, showLockScreen, initLock } from './features/lock.js';
import { shouldOnboard, startOnboarding } from './features/onboarding.js';
import { initHome } from './features/home.js';
import { initGallery } from './features/gallery.js';
import { initMusic } from './features/music.js';
import { initStreak } from './features/streak.js';
import { initCalendar } from './features/calendar.js';
import { initAOD, openAOD } from './features/aod.js';
import { initTogether } from './features/together.js';
import { initSettings } from './features/settings.js';
import { initBackup } from './features/backup.js';
import { initNotifications } from './features/notifications.js';

const PAGE_SURFACES = ['calendarScreen', 'togetherScreen', 'settingsScreen'];

function openPage(id) {
  PAGE_SURFACES.forEach((s) => { if (s !== id) closeSurface(s); });
  openSurface(id);
  updateDock(id);
}
function goHome() {
  PAGE_SURFACES.forEach(closeSurface);
  updateDock(null);
}
function updateDock(activeId) {
  $$('.dock-btn').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.target === activeId));
}

function wireNav() {
  on($('navHomeBtn'), 'click', goHome);
  on($('navCalendarBtn'), 'click', () => openPage('calendarScreen'));
  on($('navTogetherBtn'), 'click', () => openPage('togetherScreen'));
  on($('navSettingsBtn'), 'click', () => openPage('settingsScreen'));
  on($('navAodBtn'), 'click', openAOD);
  // Calendar/Together/Settings no longer have their own close (X)
  // button — they're top-level dock destinations now, so tapping
  // "Home" in the dock (wired above) is how you back out of them.
  // A dedicated back/close button only appears on true sub-panels:
  // modals, the image viewer, and the AOD screen (see those files).
}

function initAllFeatures() {
  initTheme();
  initLock();
  initHome();
  initGallery();
  initMusic();
  initStreak();
  initCalendar();
  initAOD();
  initTogether();
  initSettings();
  initBackup();
  initNotifications();
  wireNav();
}

async function boot() {
  await Store.init();
  applyThemeImmediate(Store.data.theme); // avoid a flash of the default theme before full init runs

  const proceed = () => {
    initAllFeatures();
    document.getElementById('bootScreen')?.remove();
  };

  if (shouldOnboard()) {
    proceed();
    startOnboarding(() => {});
    return;
  }

  if (isLockEnabled()) {
    proceed();
    showLockScreen(() => {});
    return;
  }

  proceed();
}

document.addEventListener('DOMContentLoaded', boot);

// ---------------------------------------------------------------------
// Best-effort "hide the browser's address bar" trick for when the app
// is opened in an ordinary browser tab (not installed as a PWA).
//
// Important honesty note: no website can force a real browser tab to
// hide its own address bar — that's a deliberate browser/OS security
// restriction, not something this code can fully override. The only
// *reliable* chromeless experience is installing the app (Add to Home
// Screen / Install app), which is what manifest.json's
// "display": "standalone" is for.
//
// What this DOES do: some mobile browsers auto-collapse their address
// bar once the page scrolls, but the app shell has zero scroll
// (overflow: hidden everywhere) so there was never anything to
// scroll, and the browser chrome had no reason to collapse. This just
// nudges a 1px scroll on load so that collapse can happen where the
// browser supports it.
// ---------------------------------------------------------------------
function tryHideBrowserChrome() {
  const alreadyChromeless = window.matchMedia && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
  if (alreadyChromeless) return;
  // The app shell is 100% `position:fixed` surfaces (see base.css), so
  // none of the visible UI is anchored to body scroll — it's safe to
  // open up a hair of scroll room just long enough to nudge it, then
  // lock it back down to `overflow:hidden` as normal.
  document.documentElement.style.height = '100.1%';
  document.body.style.overflowY = 'auto';
  window.scrollTo(0, 1);
  setTimeout(() => {
    window.scrollTo(0, 1);
    document.body.style.overflowY = 'hidden';
  }, 350);
}
window.addEventListener('load', tryHideBrowserChrome);
window.addEventListener('orientationchange', () => setTimeout(tryHideBrowserChrome, 300));

// ---- Service worker (offline support for the app shell) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is best-effort */ });
  });
}
