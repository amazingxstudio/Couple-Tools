// dom.js — tiny DOM helpers shared by every feature module.
// No framework: the app is small enough that direct DOM writes stay
// readable, and it keeps the whole thing runnable with zero build step.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(el, evt, handler, opts) {
  if (el) el.addEventListener(evt, handler, opts);
}

/** Open/close a full-screen `.surface` page by id. */
export function openSurface(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('is-open');
  document.dispatchEvent(new CustomEvent('surface:open', { detail: { id } }));
}
export function closeSurface(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('is-open');
  document.dispatchEvent(new CustomEvent('surface:close', { detail: { id } }));
}
export function isSurfaceOpen(id) {
  const el = $(id);
  return !!el && el.classList.contains('is-open');
}

/** Open/close a `.modal-overlay` by id. */
export function openModal(id) {
  const el = $(id);
  if (el) el.classList.add('is-open');
}
export function closeModal(id) {
  const el = $(id);
  if (el) el.classList.remove('is-open');
}

// ---- Snackbar (lightweight, non-blocking confirmation) ----
let snackTimer = null;
export function snackbar(msg) {
  const el = $('snackbar');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-shown');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => el.classList.remove('is-shown'), 2200);
}

// ---- Blocking alert (replaces window.alert, themeable) ----
export function alertDialog(msg) {
  return new Promise((resolve) => {
    $('alertMessage').textContent = msg;
    openModal('alertOverlay');
    const btn = $('alertOkBtn');
    const handler = () => {
      btn.removeEventListener('click', handler);
      closeModal('alertOverlay');
      resolve();
    };
    btn.addEventListener('click', handler);
  });
}

// ---- Blocking confirm (replaces window.confirm, themeable) ----
export function confirmDialog(msg, confirmLabel = 'Confirm') {
  return new Promise((resolve) => {
    $('confirmMessage').textContent = msg;
    $('confirmYesBtn').textContent = confirmLabel;
    openModal('confirmOverlay');
    const yes = $('confirmYesBtn');
    const no = $('confirmNoBtn');
    const cleanup = (result) => {
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      closeModal('confirmOverlay');
      resolve(result);
    };
    const onYes = () => cleanup(true);
    const onNo = () => cleanup(false);
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

/** Long-press helper: fires `onFire` after `ms` of a sustained press,
 *  without blocking the normal click/tap on the same element. */
export function onLongPress(el, onFire, ms = 450) {
  if (!el) return;
  let timer = null;
  let moved = false;
  const start = (e) => {
    moved = false;
    timer = setTimeout(() => { timer = null; onFire(e); }, ms);
  };
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  const move = () => { moved = true; cancel(); };
  el.addEventListener('mousedown', start);
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('touchmove', move, { passive: true });
}
