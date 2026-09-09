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
  on($('calendarCloseBtn'), 'click', goHome);
  on($('togetherCloseBtn'), 'click', goHome);
  on($('settingsCloseBtn'), 'click', goHome);
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

// ---- Service worker (offline support for the app shell) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is best-effort */ });
  });
}
