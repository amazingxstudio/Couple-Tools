// lock.js — an optional 4-digit PIN screen, since this app can hold
// personal photos. The PIN itself is never stored in plain text —
// only its SHA-256 hash — but this is a local convenience lock, not
// real security (anyone with device/browser storage access could
// still get at the data). It's presented to the user that way.

import { $, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { sha256 } from '../core/utils.js';

let buffer = '';
let mode = 'unlock'; // 'unlock' | 'set-new' | 'confirm-new'
let pendingNewPin = '';
let onUnlocked = null;

export function isLockEnabled() {
  return !!Store.data.lock.enabled && !!Store.data.lock.pinHash;
}

export function showLockScreen(callback) {
  onUnlocked = callback;
  mode = 'unlock';
  buffer = '';
  $('lockTitle').textContent = 'Enter PIN';
  $('lockSub').textContent = 'This keeps your shared space private.';
  $('lockError').textContent = '';
  updateDots();
  $('lockScreen').classList.add('is-open');
}

function hideLockScreen() {
  $('lockScreen').classList.remove('is-open');
}

function updateDots() {
  const dots = document.querySelectorAll('#lockDots .pin-dot');
  dots.forEach((dot, i) => dot.classList.toggle('is-filled', i < buffer.length));
}

async function submitPin() {
  if (mode === 'unlock') {
    const hash = await sha256(buffer);
    if (hash === Store.data.lock.pinHash) {
      hideLockScreen();
      buffer = '';
      onUnlocked && onUnlocked();
    } else {
      $('lockError').textContent = 'Incorrect PIN — try again.';
      shakeAndClear();
    }
  } else if (mode === 'set-new') {
    pendingNewPin = buffer;
    buffer = '';
    mode = 'confirm-new';
    $('lockTitle').textContent = 'Confirm PIN';
    $('lockSub').textContent = 'Enter it once more to confirm.';
    updateDots();
  } else if (mode === 'confirm-new') {
    if (buffer === pendingNewPin) {
      const hash = await sha256(buffer);
      Store.patch((d) => { d.lock.enabled = true; d.lock.pinHash = hash; });
      hideLockScreen();
      buffer = '';
      snackbar('PIN lock turned on');
      document.dispatchEvent(new CustomEvent('lock:changed'));
    } else {
      $('lockError').textContent = "PINs didn't match — start again.";
      buffer = '';
      pendingNewPin = '';
      mode = 'set-new';
      $('lockTitle').textContent = 'Set a PIN';
      $('lockSub').textContent = 'Choose 4 digits.';
      shakeAndClear();
    }
  }
}

function shakeAndClear() {
  const dotsWrap = $('lockDots');
  dotsWrap.classList.add('is-shaking');
  setTimeout(() => { dotsWrap.classList.remove('is-shaking'); buffer = ''; updateDots(); }, 400);
}

export function openSetPinFlow() {
  mode = 'set-new';
  buffer = '';
  pendingNewPin = '';
  onUnlocked = null;
  $('lockTitle').textContent = 'Set a PIN';
  $('lockSub').textContent = 'Choose 4 digits.';
  $('lockError').textContent = '';
  updateDots();
  $('lockScreen').classList.add('is-open');
}

export function disableLock() {
  Store.patch((d) => { d.lock.enabled = false; d.lock.pinHash = null; });
  document.dispatchEvent(new CustomEvent('lock:changed'));
}

export function initLock() {
  const keypad = $('lockKeypad');
  keypad.addEventListener('click', (e) => {
    const key = e.target.closest('.pin-key');
    if (!key) return;
    const val = key.dataset.key;
    if (val === 'back') {
      buffer = buffer.slice(0, -1);
      updateDots();
      return;
    }
    if (val === 'clear') { buffer = ''; updateDots(); return; }
    if (buffer.length >= 4) return;
    buffer += val;
    updateDots();
    if (buffer.length === 4) submitPin();
  });
}
