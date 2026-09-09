// aod.js — the immersive "always-on display" screen: a big clock,
// an optional custom background, and a gentle gyroscope tilt on the
// framed clock style (iOS requires the permission prompt to fire
// from a direct user gesture, which openAOD() always is here).

import { $, on, openModal, closeModal, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';

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
  on($('openAodBtn'), 'click', openAOD);
  on($('aodCloseBtn'), 'click', closeAOD);
  on($('aodSettingsBtn'), 'click', () => { renderClockChips(); openModal('aodSettingsOverlay'); });
  on($('aodSettingsDoneBtn'), 'click', () => closeModal('aodSettingsOverlay'));
  wireAodBgPicker();
}
