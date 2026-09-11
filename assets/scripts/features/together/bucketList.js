// bucketList.js — shared goals: places to go, things to try together.

import { $, $$, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { uid, escapeHtml } from '../../core/utils.js';

function render() {
  const items = Store.data.together.bucket;
  const done = items.filter((i) => i.done).length;
  $('bucketProgressLabel').textContent = items.length ? `${done} of ${items.length} done` : 'Nothing on the list yet';
  $('bucketProgressFill').style.width = items.length ? `${(done / items.length) * 100}%` : '0%';

  const wrap = $('bucketList');
  wrap.innerHTML = items.length
    ? items.map((i) => `
        <div class="bucket-item card ${i.done ? 'is-done' : ''}">
          <button class="bucket-check" data-toggle="${i.id}"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></button>
          <span class="bucket-text">${escapeHtml(i.text)}</span>
          <button class="bucket-del" data-del="${i.id}"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>`).join('')
    : '<div class="empty-state">Add something you both want to do.</div>';

  $$('[data-toggle]', wrap).forEach((btn) => on(btn, 'click', () => toggle(btn.dataset.toggle)));
  $$('[data-del]', wrap).forEach((btn) => on(btn, 'click', () => remove(btn.dataset.del)));
}

function add() {
  const input = $('bucketInput');
  const text = input.value.trim();
  if (!text) return;
  Store.patch((d) => { d.together.bucket.push({ id: uid(), text, done: false, ts: Date.now() }); });
  input.value = '';
  render();
}
function toggle(id) {
  Store.patch((d) => {
    const item = d.together.bucket.find((i) => i.id === id);
    if (item) item.done = !item.done;
  });
  render();
}
function remove(id) {
  Store.patch((d) => { d.together.bucket = d.together.bucket.filter((i) => i.id !== id); });
  render();
}

export function initBucketList() {
  on($('bucketAddBtn'), 'click', add);
  on($('bucketInput'), 'keydown', (e) => { if (e.key === 'Enter') add(); });
  render();
  Store.subscribe(render);
}
