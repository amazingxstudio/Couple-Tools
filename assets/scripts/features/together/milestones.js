// milestones.js — a timeline of relationship milestones beyond just
// the anniversary date: first trip, moving in together, and so on.

import { $, $$, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { uid, escapeHtml, ddmmyyyy } from '../../core/utils.js';
import { attachDatePicker } from '../../core/datepicker.js';

function clearDateField(input) {
  if (input._dpSetValue) input._dpSetValue('');
  else input.value = '';
}

function render() {
  const items = Store.data.together.milestones.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const wrap = $('milestoneTimeline');
  wrap.innerHTML = items.length
    ? `<div class="timeline">${items.map((m) => `
        <div class="timeline-item">
          <button class="timeline-del" data-id="${m.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
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
  clearDateField($('milestoneDateInput'));
  render();
}
function remove(id) {
  Store.patch((d) => { d.together.milestones = d.together.milestones.filter((m) => m.id !== id); });
  render();
}

export function initMilestones() {
  attachDatePicker($('milestoneDateInput'), { title: 'Milestone date', max: new Date().toISOString().slice(0, 10) });
  on($('milestoneAddBtn'), 'click', add);
  render();
  Store.subscribe(render);
}
