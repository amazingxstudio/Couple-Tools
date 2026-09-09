// together.js — wires up the tab row on the Together page. Each
// panel's own logic lives in features/together/*.js; this file only
// handles which panel is visible.

import { $, $$, on } from '../core/dom.js';
import { initDailyQuestion } from './together/dailyQuestion.js';
import { initLoveNotes } from './together/loveNotes.js';
import { initBucketList } from './together/bucketList.js';
import { initGratitudeJar } from './together/gratitudeJar.js';
import { initMilestones } from './together/milestones.js';

const TABS = [
  ['question', 'Question'],
  ['notes', 'Love Notes'],
  ['bucket', 'Bucket List'],
  ['jar', 'Gratitude'],
  ['milestones', 'Timeline'],
];

function switchTab(key) {
  $$('.together-tabs .chip').forEach((c) => c.classList.toggle('is-active', c.dataset.tab === key));
  $$('.together-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === key));
}

export function initTogether() {
  const row = $('togetherTabs');
  row.innerHTML = TABS.map(([key, label], i) => `<button class="chip ${i === 0 ? 'is-active' : ''}" data-tab="${key}">${label}</button>`).join('');
  $$('.chip', row).forEach((chip) => on(chip, 'click', () => switchTab(chip.dataset.tab)));

  initDailyQuestion();
  initLoveNotes();
  initBucketList();
  initGratitudeJar();
  initMilestones();
}
