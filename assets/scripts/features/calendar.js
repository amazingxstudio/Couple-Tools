// calendar.js — month grid with notes + memory photos per day, and
// automatic anniversary / birthday flags read from Settings data.

import { $, $$, on, onLongPress, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { uid, todayStr, ddmmyyyy } from '../core/utils.js';
import { saveMedia, mediaUrl, removeMedia } from '../services/media.service.js';
import { openImageViewerUrl } from './gallery.js';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
let viewDate = new Date();
let selectedDate = todayStr();
let noteCat = CONFIG.NOTE_CATEGORIES[0];
let memSelection = new Set();

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayFlags(y, m, d) {
  const flags = { anniv: false, bdayA: false, bdayB: false };
  const { startDate, profile1, profile2 } = Store.data;
  if (startDate) {
    const s = new Date(startDate);
    if (s.getMonth() === m && s.getDate() === d) flags.anniv = true;
  }
  if (profile1.birthday) {
    const b = new Date(profile1.birthday);
    if (b.getMonth() === m && b.getDate() === d) flags.bdayA = true;
  }
  if (profile2.birthday) {
    const b = new Date(profile2.birthday);
    if (b.getMonth() === m && b.getDate() === d) flags.bdayB = true;
  }
  return flags;
}

export function renderCalendarGrid() {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  $('calMonthLabel').textContent = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const grid = $('calGrid');
  let html = '';
  for (let i = 0; i < firstDow; i++) html += '<div></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(y, m, d);
    const flags = dayFlags(y, m, d);
    const entry = Store.data.calendarData[key];
    const hasContent = entry && ((entry.notes && entry.notes.length) || (entry.memories && entry.memories.length));
    const classes = ['cal-day'];
    if (key === todayStr()) classes.push('is-today');
    if (key === selectedDate) classes.push('is-selected');
    if (flags.anniv) classes.push('is-anniv');
    if (flags.bdayA && flags.bdayB) classes.push('is-birthday-both');
    else if (flags.bdayA) classes.push('is-birthday-a');
    else if (flags.bdayB) classes.push('is-birthday-b');

    let tag = '';
    if (flags.anniv) tag = 'Anniv';
    else if (flags.bdayA && flags.bdayB) tag = 'Bdays';
    else if (flags.bdayA || flags.bdayB) tag = 'Bday';

    html += `<div class="${classes.join(' ')}" data-date="${key}">
      <span>${d}</span>
      ${tag ? `<span class="cal-tag">${tag}</span>` : (hasContent ? '<span class="cal-dot"></span>' : '')}
    </div>`;
  }
  grid.innerHTML = html;
  $$('.cal-day', grid).forEach((el) => on(el, 'click', () => selectDate(el.dataset.date)));
}

async function selectDate(key) {
  selectedDate = key;
  renderCalendarGrid();
  await renderDayDetail();
}

async function renderDayDetail() {
  const [y, m, d] = selectedDate.split('-').map(Number);
  const flags = dayFlags(y, m - 1, d);
  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  let flagText = '';
  if (flags.anniv) flagText = 'Your anniversary';
  else if (flags.bdayA && flags.bdayB) flagText = 'Both your birthdays';
  else if (flags.bdayA) flagText = `${Store.data.profile1.name || 'Partner 1'}'s birthday`;
  else if (flags.bdayB) flagText = `${Store.data.profile2.name || 'Partner 2'}'s birthday`;

  $('calDetailDate').innerHTML = `${dateLabel}${flagText ? `<span class="flag">${flagText}</span>` : ''}`;

  const entry = Store.data.calendarData[selectedDate] || { notes: [], memories: [] };

  const notesWrap = $('calNotesList');
  notesWrap.innerHTML = entry.notes.length
    ? entry.notes.map((n) => `
        <div class="note-item">
          <span class="cat">${n.cat}</span>
          <p>${escapeHtml(n.text)}</p>
          <button data-del-note="${n.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>`).join('')
    : '<p class="u-muted" style="font-size:.82rem">No notes yet.</p>';
  notesWrap.querySelectorAll('[data-del-note]').forEach((btn) => on(btn, 'click', () => deleteNote(btn.dataset.delNote)));

  const memGrid = $('calMemoryList');
  if (memGrid) await renderMemories(entry);
}

function getImageRatio(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve((img.naturalWidth / img.naturalHeight) || 1);
    img.onerror = () => resolve(1);
    img.src = url;
  });
}

/** Memories are grouped by how close their aspect ratio is to
 *  portrait / square / landscape, so a day with a mix of photo
 *  shapes reads as tidy little albums instead of one long grid. */
async function renderMemories(entry) {
  const list = $('calMemoryList');
  const hint = $('calMemoryHint');
  exitMemorySelection();

  if (!entry.memories.length) {
    list.innerHTML = '';
    hint.classList.add('u-hide');
    return;
  }
  hint.classList.remove('u-hide');

  const items = (await Promise.all(entry.memories.map(async (id) => {
    const url = await mediaUrl(id);
    if (!url) return null;
    const ratio = await getImageRatio(url);
    return { id, url, ratio };
  }))).filter(Boolean);

  const groups = { Portrait: [], Square: [], Landscape: [] };
  items.forEach((it) => {
    if (it.ratio < 0.85) groups.Portrait.push(it);
    else if (it.ratio > 1.2) groups.Landscape.push(it);
    else groups.Square.push(it);
  });

  list.innerHTML = Object.entries(groups)
    .filter(([, arr]) => arr.length)
    .map(([label, arr]) => `
      <div class="memory-group">
        <div class="memory-group-title">${label} · ${arr.length}</div>
        <div class="memory-grid">
          ${arr.map((it) => `
            <div class="memory-thumb-wrap" data-id="${it.id}">
              <img class="memory-thumb" src="${it.url}" alt="">
              <span class="memory-thumb-check"><svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
            </div>`).join('')}
        </div>
      </div>`).join('');

  $$('.memory-thumb-wrap', list).forEach((wrap) => {
    on(wrap, 'click', () => {
      if (memSelection.size) toggleMemSelect(wrap);
      else openImageViewerUrl(wrap.querySelector('img').src);
    });
    onLongPress(wrap, () => toggleMemSelect(wrap));
  });
}

function toggleMemSelect(wrap) {
  const id = wrap.dataset.id;
  if (memSelection.has(id)) { memSelection.delete(id); wrap.classList.remove('is-selected'); }
  else { memSelection.add(id); wrap.classList.add('is-selected'); }
  syncMemActionBar();
}

function syncMemActionBar() {
  const bar = $('calMemorySelBar');
  if (!bar) return;
  bar.classList.toggle('u-hide', memSelection.size === 0);
  $('calMemorySelCount').textContent = `${memSelection.size} selected`;
}

function exitMemorySelection() {
  memSelection.clear();
  syncMemActionBar();
}

async function deleteSelectedMemories() {
  const ids = Array.from(memSelection);
  if (!ids.length) return;
  for (const id of ids) await removeMedia(id);
  Store.patch((d) => {
    const e = ensureEntry(d);
    e.memories = e.memories.filter((mid) => !ids.includes(mid));
  });
  exitMemorySelection();
  await renderDayDetail();
  renderCalendarGrid();
  snackbar(ids.length > 1 ? 'Photos deleted' : 'Photo deleted');
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ensureEntry(d) {
  if (!d.calendarData[selectedDate]) d.calendarData[selectedDate] = { notes: [], memories: [] };
  return d.calendarData[selectedDate];
}

function addNote() {
  const input = $('calNoteInput');
  const text = input.value.trim();
  if (!text) return;
  Store.patch((d) => {
    ensureEntry(d).notes.push({ id: uid(), cat: noteCat, text, ts: Date.now() });
  });
  input.value = '';
  renderDayDetail();
  renderCalendarGrid();
}
function deleteNote(id) {
  Store.patch((d) => {
    const e = ensureEntry(d);
    e.notes = e.notes.filter((n) => n.id !== id);
  });
  renderDayDetail();
  renderCalendarGrid();
}

async function addMemories(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  for (const file of files) {
    const id = await saveMedia(file);
    Store.patch((d) => { ensureEntry(d).memories.push(id); });
  }
  renderDayDetail();
  renderCalendarGrid();
  snackbar('Memory added');
}

export function initCalendar() {
  on($('calPrevBtn'), 'click', () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendarGrid(); });
  on($('calNextBtn'), 'click', () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendarGrid(); });
  on($('calMonthLabel'), 'click', () => { viewDate = new Date(); selectedDate = todayStr(); renderCalendarGrid(); renderDayDetail(); });

  const catRow = $('noteCatRow');
  catRow.innerHTML = CONFIG.NOTE_CATEGORIES.map((c, i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('');
  $$('.chip', catRow).forEach((chip) => on(chip, 'click', () => {
    noteCat = chip.dataset.cat;
    $$('.chip', catRow).forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
  }));

  on($('calAddNoteBtn'), 'click', addNote);
  const memInput = $('calMemoryInput');
  on($('calAddMemoryBtn'), 'click', () => memInput.click());
  on(memInput, 'change', () => { addMemories(memInput.files); memInput.value = ''; });
  on($('calMemoryDeleteBtn'), 'click', deleteSelectedMemories);
  on($('calMemoryCancelSelBtn'), 'click', exitMemorySelection);

  renderCalendarGrid();
  renderDayDetail();
  Store.subscribe(() => { renderCalendarGrid(); });
}
