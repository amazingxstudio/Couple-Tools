// aod.js — the immersive "always-on display" screen: a big clock,
// an optional custom background, and a gentle gyroscope tilt on the
// framed clock style (iOS requires the permission prompt to fire
// from a direct user gesture, which openAOD() always is here).

import { $, on, onLongPress, openModal, closeModal, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';
import { CONFIG } from '../core/config.js';

let tickTimer = null;
let gyroActive = false;

function formatTime(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return { h, m, ampm };
}
function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function renderClock() {
  const { h, m, ampm } = formatTime(new Date());
  const dateStr = formatDate(new Date());
  const type = Store.data.aod.clockType;

  $('aodLineClock').classList.toggle('u-hide', type !== 'line');
  $('aodBoxedClock').classList.toggle('u-hide', type !== 'boxed');
  $('aodFramedClock').classList.toggle('u-hide', type !== 'framed');

  const timeStr = `${h}:${m} ${ampm}`;
  $('aodLineTime').textContent = timeStr;
  $('aodLineDate').textContent = dateStr;
  $('aodBoxedTime').textContent = timeStr;
  $('aodBoxedDate').textContent = dateStr;
  $('aodFramedTime').textContent = `${h}:${m}`;
  $('aodFramedDate').textContent = dateStr;
}

async function applyAodBg() {
  const screen = $('aodScreen');
  const id = Store.data.aod.bgId;
  if (!id) { screen.style.backgroundImage = ''; return; }
  const url = await mediaUrl(id);
  if (url) screen.style.backgroundImage = `url("${url}")`;
}

function startGyroTilt() {
  const frame = $('aodFramedClock');
  const handler = (e) => {
    const x = Math.max(-16, Math.min(16, (e.gamma || 0) * 0.4));
    const y = Math.max(-16, Math.min(16, (e.beta || 0) * 0.2));
    frame.style.transform = `rotateX(${-y}deg) rotateY(${x}deg)`;
  };
  window.addEventListener('deviceorientation', handler);
  gyroActive = true;
  return () => window.removeEventListener('deviceorientation', handler);
}
let stopGyro = null;

async function requestGyroIfNeeded() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') stopGyro = startGyroTilt();
    } catch { /* user declined or unsupported — clock just stays static */ }
  } else if (window.DeviceOrientationEvent) {
    stopGyro = startGyroTilt();
  }
}

export async function openAOD() {
  renderClock();
  await applyAodBg();
  $('aodScreen').classList.add('is-open');
  tickTimer = setInterval(renderClock, 1000);
  if (Store.data.aod.clockType === 'framed') requestGyroIfNeeded();

  // Keep the screen visible while docked (harmless if unsupported).
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then((lock) => { $('aodScreen')._wakeLock = lock; }).catch(() => {});
  }
}

export function closeAOD() {
  $('aodScreen').classList.remove('is-open');
  clearInterval(tickTimer);
  if (stopGyro) { stopGyro(); stopGyro = null; }
  gyroActive = false;
  const lock = $('aodScreen')._wakeLock;
  if (lock) { lock.release().catch(() => {}); $('aodScreen')._wakeLock = null; }
}

function renderClockChips() {
  const row = $('aodTypeRow');
  const types = [['line', 'Line'], ['boxed', 'Boxed'], ['framed', 'Framed']];
  row.innerHTML = types.map(([key, label]) => `
    <button class="chip ${Store.data.aod.clockType === key ? 'is-active' : ''}" data-type="${key}">${label}</button>
  `).join('');
  row.querySelectorAll('.chip').forEach((chip) => on(chip, 'click', () => {
    Store.patch((d) => { d.aod.clockType = chip.dataset.type; });
    renderClockChips();
    renderClock();
    if (chip.dataset.type === 'framed' && !gyroActive) requestGyroIfNeeded();
  }));
}

function wireAodBgPicker() {
  const input = $('aodBgFileInput');
  on($('aodBgUploadBtn'), 'click', () => input.click());
  on(input, 'change', async () => {
    const file = input.files[0];
    if (!file) return;
    const oldId = Store.data.aod.bgId;
    const id = await saveMedia(file);
    if (oldId) await removeMedia(oldId);
    Store.patch((d) => { d.aod.bgId = id; });
    await applyAodBg();
    snackbar('AOD background updated');
    input.value = '';
  });
  on($('aodBgResetBtn'), 'click', async () => {
    const oldId = Store.data.aod.bgId;
    if (oldId) await removeMedia(oldId);
    Store.patch((d) => { d.aod.bgId = null; });
    await applyAodBg();
    snackbar('Background reset');
  });
}

export function initAOD() {
  on($('aodCloseBtn'), 'click', closeAOD);
  on($('aodSettingsDoneBtn'), 'click', () => closeModal('aodSettingsOverlay'));

  // Long-press anywhere on the AOD background (i.e. not on a button)
  // opens the AOD settings sheet, instead of a permanent settings
  // button sitting on the screen the whole time.
  onLongPress($('aodScreen'), (e) => {
    if (e.target.closest && e.target.closest('button')) return;
    renderClockChips();
    openModal('aodSettingsOverlay');
  });

  wireAodBgPicker();
  wireAppLauncher();
}

// ---------------------------------------------------------------------
// Quick-launch circle panel: a small ring of app shortcuts that pops
// open from a FAB in the corner of the AOD screen, so a quick check of
// Telegram/TikTok/YouTube/etc. doesn't require leaving the app fully.
// ---------------------------------------------------------------------

function appIconSvg(key) {
  const icons = {
    telegram: '<path fill="#fff" d="M21.5 4.5L2.7 11.9c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.8-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.9-1.3-1.4zM8.6 14.1l9.2-5.8c.5-.3.9-.1.6.2l-7.8 7.1-.3 3-1.4-3.8z"/>',
    tiktok: '<path fill="#fff" d="M16.6 3h-3.1v12.4a2.7 2.7 0 11-2.3-2.7v-3.2a5.9 5.9 0 105.4 5.9V9.2a7.6 7.6 0 004.4 1.4V7.5a4.5 4.5 0 01-4.4-4.5z"/>',
    youtube: '<path fill="#fff" d="M22 12s0-3.3-.4-4.8a2.8 2.8 0 00-2-2C17.9 5 12 5 12 5s-5.9 0-7.6.2a2.8 2.8 0 00-2 2C2 8.7 2 12 2 12s0 3.3.4 4.8a2.8 2.8 0 002 2C6.1 19 12 19 12 19s5.9 0 7.6-.2a2.8 2.8 0 002-2C22 15.3 22 12 22 12zM10 15.5v-7l6 3.5-6 3.5z"/>',
  };
  return icons[key] || '<circle cx="12" cy="12" r="8" fill="#fff"/>';
}

function renderAppLauncher() {
  const ring = $('appLauncherRing');
  if (!ring) return;
  const apps = CONFIG.APP_LAUNCHER;
  ring.innerHTML = apps.map((app, i) => `
    <button class="app-orb" type="button" style="background:${app.color}" data-key="${app.key}" aria-label="${app.label}">
      ${app.isBot
        ? `<img src="${app.avatar}" alt="${app.label}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><span class="app-orb-fallback">${app.label.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>`
        : `<svg viewBox="0 0 24 24">${appIconSvg(app.key)}</svg>`}
      <span class="app-orb-label">${app.label}</span>
    </button>
  `).join('');

  // Positioned here (not in CSS) as a clean half-circle arc: a
  // pure-CSS version of this either needs trig functions CSS can't
  // rely on everywhere yet, or ends up cramming every orb along a
  // near-straight line so they overlap and the ones further from the
  // FAB become impossible to tap — which is exactly what was
  // happening before this fix. The FAB sits bottom-center (see
  // aod.css .app-launcher) so this arc can sweep the full upper
  // half-circle — due-left, up through due-up, to due-right — and
  // every orb still lands on screen, wrapping around the button
  // instead of only opening toward one corner.
  const orbs = ring.querySelectorAll('.app-orb');
  const n = orbs.length;
  // Small enough that the ring reads as "next to the button you
  // pressed" rather than scattered across the screen, but still
  // leaves ~8px between adjacent 46px orbs at n=5 on a 180° sweep
  // so they never overlap each other.
  const radius = 64; // px from the FAB's center to each orb's center — close to the smallest this can go before adjacent 46px orbs start to overlap at this spread
  orbs.forEach((orb, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const angle = (180 - t * 180) * (Math.PI / 180); // 180° = due left, 90° = due up, 0° = due right
    const tx = Math.cos(angle) * radius;
    const ty = -Math.sin(angle) * radius;
    orb.style.setProperty('--tx', `${tx.toFixed(1)}px`);
    orb.style.setProperty('--ty', `${ty.toFixed(1)}px`);
    orb.style.transitionDelay = `${i * 0.03}s`;
  });

  ring.querySelectorAll('.app-orb').forEach((orb) => {
    on(orb, 'click', () => openLauncherApp(orb.dataset.key));
  });
}

function openLauncherApp(key) {
  const app = CONFIG.APP_LAUNCHER.find((a) => a.key === key);
  if (!app) return;
  closeLauncher();
  const loader = $('appLaunchLoader');
  loader.classList.add('is-open');
  setTimeout(() => {
    window.open(app.url, '_blank', 'noopener');
    loader.classList.remove('is-open');
  }, 550);
}

function closeLauncher() { $('appLauncher').classList.remove('is-open'); }

function wireAppLauncher() {
  renderAppLauncher();
  const launcher = $('appLauncher');
  on($('appLauncherToggle'), 'click', () => launcher.classList.toggle('is-open'));
  document.addEventListener('click', (e) => {
    if (launcher.classList.contains('is-open') && !launcher.contains(e.target)) closeLauncher();
  });
}
