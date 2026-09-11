// datepicker.js — a small custom Day / Month / Year wheel picker that
// replaces the native <input type="date"> everywhere in the app.
//
// Why: native date pickers look completely different across iOS /
// Android / desktop browsers and can't be themed, so they always feel
// bolted-on next to the rest of the app's design. This uses the
// .wheel-picker / .wheel-col / .wheel-item scroll-snap styles already
// defined in components.css to build one consistent, on-brand picker
// that's reused by every date field in the app (onboarding, settings,
// milestones, …).
//
// Usage:
//   attachDatePicker($('setBirthday'), { max: todayStr() });
// The target <input> keeps working exactly like before — reading
// `.value` still gives you the plain ISO "YYYY-MM-DD" string, and it
// still fires a real `change` event when a date is picked, so any
// existing `on(input, 'change', …)` binding keeps working untouched.
// The input itself becomes read-only; a small formatted display span
// is shown in its place so the field never shows a raw ISO string.

import { $ } from './dom.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ITEM_H = 42; // must match .wheel-item's rendered row height

function pad(n) { return String(n).padStart(2, '0'); }
function isoOf(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

function formatDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

let sheetEl = null;
let colDay, colMonth, colYear;
let pending = { y: 0, m: 0, d: 1 };
let activeInput = null;
let activeOpts = null;

function buildSheet() {
  if (sheetEl) return;
  sheetEl = document.createElement('div');
  sheetEl.id = 'dpOverlay';
  sheetEl.className = 'modal-overlay dp-overlay';
  sheetEl.innerHTML = `
    <div class="modal-box dp-box">
      <h3 id="dpTitle">Choose a date</h3>
      <div class="wheel-picker" id="dpWheel">
        <div class="wheel-col" id="dpColDay"></div>
        <div class="wheel-col" id="dpColMonth"></div>
        <div class="wheel-col" id="dpColYear"></div>
      </div>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost btn-sm" id="dpCancelBtn" style="flex:1;">Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" id="dpDoneBtn" style="flex:1;">Set date</button>
      </div>
    </div>`;
  document.body.appendChild(sheetEl);

  colDay = sheetEl.querySelector('#dpColDay');
  colMonth = sheetEl.querySelector('#dpColMonth');
  colYear = sheetEl.querySelector('#dpColYear');

  sheetEl.querySelector('#dpCancelBtn').addEventListener('click', closeSheet);
  sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) closeSheet(); });
  sheetEl.querySelector('#dpDoneBtn').addEventListener('click', () => {
    if (!activeInput) return;
    const iso = isoOf(pending.y, pending.m, pending.d);
    setInputValue(activeInput, iso);
    closeSheet();
  });

  fillColumn(colMonth, MONTHS.map((name, i) => ({ value: i, label: name })), (i) => { pending.m = i; renderDayColumn(); });
}

function fillColumn(col, items, onPick) {
  col.innerHTML = `<div class="wheel-spacer"></div>${items.map((it) => `<div class="wheel-item" data-v="${it.value}">${it.label}</div>`).join('')}<div class="wheel-spacer"></div>`;
  col._items = items;
  col._onPick = onPick;
  col.querySelectorAll('.wheel-item').forEach((el) => {
    el.addEventListener('click', () => scrollColTo(col, Number(el.dataset.v)));
  });
  let scrollTimer = null;
  col.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => syncColSelection(col), 90);
  }, { passive: true });
}

function syncColSelection(col) {
  const i = Math.round(col.scrollTop / ITEM_H);
  const els = col.querySelectorAll('.wheel-item');
  els.forEach((el, idx) => el.classList.toggle('is-selected', idx === i));
  const picked = els[i];
  if (picked && col._onPick) col._onPick(Number(picked.dataset.v));
}

function scrollColTo(col, value, smooth = true) {
  const els = Array.from(col.querySelectorAll('.wheel-item'));
  const idx = els.findIndex((el) => Number(el.dataset.v) === value);
  if (idx < 0) return;
  col.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'instant' });
  els.forEach((el, i) => el.classList.toggle('is-selected', i === idx));
}

function renderDayColumn() {
  const dim = daysInMonth(pending.y, pending.m);
  if (pending.d > dim) pending.d = dim;
  const items = Array.from({ length: dim }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  fillColumn(colDay, items, (v) => { pending.d = v; });
  scrollColTo(colDay, pending.d, false);
}

function renderYearColumn(minY, maxY) {
  const items = [];
  for (let y = maxY; y >= minY; y--) items.push({ value: y, label: String(y) });
  fillColumn(colYear, items, (v) => { pending.y = v; renderDayColumn(); });
}

function openSheet(input, opts) {
  buildSheet();
  activeInput = input;
  activeOpts = opts || {};
  sheetEl.querySelector('#dpTitle').textContent = opts.title || 'Choose a date';

  const today = new Date();
  const maxDate = opts.max ? new Date(opts.max) : today;
  const minDate = opts.min ? new Date(opts.min) : new Date(today.getFullYear() - 100, 0, 1);
  const current = input.dataset.iso ? new Date(input.dataset.iso) : (opts.defaultDate ? new Date(opts.defaultDate) : maxDate);

  pending = { y: current.getFullYear(), m: current.getMonth(), d: current.getDate() };

  renderYearColumn(minDate.getFullYear(), maxDate.getFullYear());
  scrollColTo(colYear, pending.y, false);
  scrollColTo(colMonth, pending.m, false);
  renderDayColumn();

  sheetEl.classList.add('is-open');
}

function closeSheet() {
  if (sheetEl) sheetEl.classList.remove('is-open');
  activeInput = null;
}

function setInputValue(input, iso) {
  input.dataset.iso = iso;
  input.value = iso;
  const display = input.parentElement && input.parentElement.querySelector('.dp-display');
  if (display) display.textContent = formatDisplay(iso);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

const CAL_ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2V2h-2v2H9V2H7zM5 9h14v11H5V9z"/></svg>';

/** Turn a plain `<input type="date">` (or any input) into a custom
 *  wheel date-picker field. Safe to call more than once on the same
 *  element — later calls just update the options. */
export function attachDatePicker(input, opts = {}) {
  if (!input) return null;
  if (!input.dataset.dpBound) {
    input.dataset.dpBound = '1';
    input.type = 'text';
    input.readOnly = true;
    input.classList.add('dp-input');
    if (!input.placeholder) input.placeholder = ' ';

    const wrap = document.createElement('div');
    wrap.className = 'dp-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const display = document.createElement('span');
    display.className = 'dp-display';
    wrap.appendChild(display);

    const icon = document.createElement('span');
    icon.className = 'dp-icon';
    icon.innerHTML = CAL_ICON;
    wrap.appendChild(icon);

    const open = () => openSheet(input, activeInputOpts(input));
    input.addEventListener('click', open);
    icon.addEventListener('click', open);

    if (input.value) setInputValue(input, input.value);
  }
  input._dpOpts = opts;
  input._dpSetValue = (iso) => setInputValue(input, iso || '');
  return {
    setValue: input._dpSetValue,
  };
}

function activeInputOpts(input) {
  return input._dpOpts || {};
}
