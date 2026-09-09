// loveNotes.js — a growing wall of short notes to each other. This
// replaces the old Message page: instead of a fake two-way chat with
// canned replies, it's an honest one-way journal wall that's actually
// useful without a backend, and will read even better once the
// Telegram-bot sync makes it live between both your phones.

import { $, $$, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { uid, relativeTime, escapeHtml } from '../../core/utils.js';

let activeWho = 1;

function nameFor(who) {
  const p = Store.data[`profile${who}`];
  return p.name || `Partner ${who}`;
}

function render() {
  const notes = Store.data.together.notes.slice().sort((a, b) => b.ts - a.ts);
  const wall = $('noteWall');
  wall.innerHTML = notes.length
    ? notes.map((n) => `
        <div class="note-entry card">
          <button class="note-del" data-id="${n.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 7h12l-1 13H7L6 7zm3-4h6l1 2H8l1-2z"/></svg></button>
          <div class="note-from">${escapeHtml(nameFor(n.who))}</div>
          <p>${escapeHtml(n.text)}</p>
          <span class="note-time">${relativeTime(n.ts)}</span>
        </div>`).join('')
    : '<div class="empty-state">Leave the first note for your partner to find.</div>';
  $$('.note-del', wall).forEach((btn) => on(btn, 'click', () => remove(btn.dataset.id)));
}

function add() {
  const input = $('noteComposerInput');
  const text = input.value.trim();
  if (!text) return;
  Store.patch((d) => { d.together.notes.push({ id: uid(), who: activeWho, text, ts: Date.now() }); });
  input.value = '';
  render();
}
function remove(id) {
  Store.patch((d) => { d.together.notes = d.together.notes.filter((n) => n.id !== id); });
  render();
}

export function initLoveNotes() {
  $$('#noteWhoToggle button').forEach((btn) => on(btn, 'click', () => {
    activeWho = Number(btn.dataset.who);
    $$('#noteWhoToggle button').forEach((b) => b.classList.toggle('is-active', b === btn));
  }));
  on($('noteSubmitBtn'), 'click', add);
  render();
  Store.subscribe(render);
}
