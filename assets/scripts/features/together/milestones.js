// milestones.js — a timeline of relationship milestones beyond just
// the anniversary date: first trip, moving in together, and so on.

import { $, $$, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { uid, escapeHtml, ddmmyyyy } from '../../core/utils.js';

function render() {
  const items = Store.data.together.milestones.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const wrap = $('milestoneTimeline');
  wrap.innerHTML = items.length
    ? `<div class="timeline">${items.map((m) => `
        <div class="timeline-item">
          <button class="timeline-del" data-id="${m.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 7h12l-1 13H7L6 7zm3-4h6l1 2H8l1-2z"/></svg></button>
          <div class="timeline-date">${ddmmyyyy(m.date)}</div>
          <div class="timeline-title">${escapeHtml(m.title)}</div>
          ${m.note ? `<div class="timeline-note">${escapeHtml(m.note)}</div>` : ''}
        </div>`).join('')}</div>`
    : '<div class="empty-state">Mark the moments worth remembering.</div>';
  $$('[data-id]', wrap).forEach((btn) => on(btn, 'click', () => remove(btn.dataset.id)));
}

function add() {
  const date = $('milestoneDateInput').value;
  const title = $('milestoneTitleInput').value.trim();
  const note = $('milestoneNoteInput').value.trim();
  if (!date || !title) return;
  Store.patch((d) => { d.together.milestones.push({ id: uid(), date, title, note }); });
  $('milestoneTitleInput').value = '';
  $('milestoneNoteInput').value = '';
  $('milestoneDateInput').value = '';
  render();
}
function remove(id) {
  Store.patch((d) => { d.together.milestones = d.together.milestones.filter((m) => m.id !== id); });
  render();
}

export function initMilestones() {
  on($('milestoneAddBtn'), 'click', add);
  render();
  Store.subscribe(render);
}
