// gratitudeJar.js — little things you appreciate about each other,
// dropped in a jar; pull one out at random when you want a lift.

import { $, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { uid, escapeHtml } from '../../core/utils.js';

function render() {
  const items = Store.data.together.gratitude;
  $('jarCount').textContent = items.length;
  $('jarCountLabel').textContent = items.length === 1 ? 'note in the jar' : 'notes in the jar';
  $('jarDrawBtn').disabled = items.length === 0;
}

function add() {
  const input = $('jarInput');
  const text = input.value.trim();
  if (!text) return;
  Store.patch((d) => { d.together.gratitude.push({ id: uid(), text, ts: Date.now() }); });
  input.value = '';
  render();
}

function draw() {
  const items = Store.data.together.gratitude;
  if (!items.length) return;
  const pick = items[Math.floor(Math.random() * items.length)];
  $('jarDrawText').textContent = escapeHtml(pick.text);
  $('jarDrawCard').classList.remove('u-hide');
}

export function initGratitudeJar() {
  on($('jarAddBtn'), 'click', add);
  on($('jarDrawBtn'), 'click', draw);
  render();
  Store.subscribe(render);
}
