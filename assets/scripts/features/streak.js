// streak.js — the daily "we both showed up today" streak. Ported
// from the original app's logic (it was one of the better-built
// parts) and cleaned up: single source of truth in Store instead of
// a separate localStorage key, and an explicit restore-or-reset
// prompt instead of silently resetting.

import { $, openModal, closeModal, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { todayStr, clamp } from '../core/utils.js';

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Same multi-layer flame markup as the two copies baked into
// index.html (#streakFabIcon / #streakGiantFlame) — needed here too
// since the milestone row's five dots are generated fresh each time
// the streak modal opens, one per milestone, each showing what the
// flame looks like AT that milestone's tier (via its own fire-N
// class below) rather than the user's actual current tier.
const FLAME_SVG = '<svg viewBox="-3 -5 30 30"><path class="flame-crown" d="M12 -4c2.5 5-1.5 7-3.5 11.5-1.6 3.6-1 6.7 1 9a6 6 0 0010-3.5c0-2.2-1-4.3-2.3-5.7 3.6 2 6.3 5.7 6.3 10.2a10.5 10.5 0 01-21 0c0-8.5 5.4-13.6 9.5-21.5z"/><path class="flame-left" d="M10 21c-2.5 0-5-1.6-6.3-4.4-1.6-3.4-.7-7 1.3-9.6-.4 3 .3 5 2 6.8 1.6 1.7 3 2.2 3.6 3.4.6 1.2.2 2.5-.6 3.8z"/><path class="flame-right" d="M14 21c2.5 0 5-1.6 6.3-4.4 1.6-3.4.7-7-1.3-9.6.4 3-.3 5-2 6.8-1.6 1.7-3 2.2-3.6 3.4-.6 1.2-.2 2.5.6 3.8z"/><g transform="translate(-3,-5) scale(1.25)"><path class="flame-base" d="M12 2c1 4-3 5-3 9a3 3 0 006 0c0-1-.4-2-1-3 2 1 3 3 3 5a5 5 0 01-10 0c0-4 3-6 5-11z"/><path class="flame-core" d="M12 8.5c1 2.2-1.3 2.8-1.3 4.8a1.8 1.8 0 003.6 0c0-.6-.2-1.1-.5-1.6 1.1.6 1.8 1.7 1.8 2.9a2.8 2.8 0 01-5.6 0c0-2.4 1.5-3.7 2-6.1z"/></g></svg>';

function getLevel(count) {
  let lvl = CONFIG.STREAK_LEVELS[0];
  for (const l of CONFIG.STREAK_LEVELS) if (count >= l.min) lvl = l;
  return lvl;
}
function getNextMilestone(count) {
  return CONFIG.STREAK_MILESTONES.find((m) => m > count) || null;
}

export function initStreak() {
  runDailyCheck();
  renderBadge();
  wireBadge();
  $('streakFab').addEventListener('click', openStreakModal);
  $('streakModalClose').addEventListener('click', () => closeModal('streakModal'));
}

function runDailyCheck() {
  const s = Store.data.streak;
  const today = todayStr();
  if (s.lastDate === today) { checkMonthlyRestoreReset(); return; }

  if (!s.lastDate) {
    Store.patch((d) => {
      d.streak.count = 1; d.streak.lastDate = today; d.streak.firstStreakDate = today; d.streak.peak = 1;
    });
  } else if (s.lastDate === yesterdayStr()) {
    Store.patch((d) => {
      d.streak.count += 1;
      d.streak.lastDate = today;
      if (d.streak.count > d.streak.peak) d.streak.peak = d.streak.count;
    });
    maybeCelebrateMilestone();
  } else {
    // Missed at least one day.
    if (s.restores > 0) {
      showRestorePrompt();
    } else {
      Store.patch((d) => { d.streak.count = 1; d.streak.lastDate = today; d.streak.firstStreakDate = today; });
    }
  }
  checkMonthlyRestoreReset();
}

function checkMonthlyRestoreReset() {
  const curMonth = new Date().getMonth();
  if (Store.data.streak.month !== curMonth) {
    Store.patch((d) => { d.streak.month = curMonth; d.streak.restores = 3; d.streak.restoresUsed = 0; });
  }
}

function showRestorePrompt() {
  const s = Store.data.streak;
  $('restorePromptText').textContent =
    `You missed a day, and your ${s.count}-day streak is at risk. Use a restore to keep it going? You have ${s.restores} left this month.`;
  openModal('restorePromptOverlay');

  const useBtn = $('restoreUseBtn');
  const resetBtn = $('restoreResetBtn');
  const cleanup = () => {
    useBtn.removeEventListener('click', onUse);
    resetBtn.removeEventListener('click', onReset);
    closeModal('restorePromptOverlay');
  };
  const onUse = () => {
    Store.patch((d) => {
      d.streak.restores -= 1;
      d.streak.restoresUsed += 1;
      d.streak.lastDate = todayStr();
    });
    renderBadge();
    cleanup();
  };
  const onReset = () => {
    Store.patch((d) => { d.streak.count = 1; d.streak.lastDate = todayStr(); d.streak.firstStreakDate = todayStr(); });
    renderBadge();
    cleanup();
  };
  useBtn.addEventListener('click', onUse);
  resetBtn.addEventListener('click', onReset);
}

function maybeCelebrateMilestone() {
  const s = Store.data.streak;
  if (CONFIG.STREAK_MILESTONES.includes(s.count)) {
    snackbar(`${s.count}-day streak — ${getLevel(s.count).name}!`);
  }
}

export function renderBadge() {
  const s = Store.data.streak;
  const fab = $('streakFab');
  const isToday = s.lastDate === todayStr();
  fab.classList.toggle('is-inactive', !isToday);
  $('streakFabNum').textContent = s.count;
  $('streakFabIcon').classList.toggle('is-live', isToday);
  applyFireLevel($('streakFabIcon'), s.count);
}

/** Applies the streak's level tier as a class (fire-0 … fire-200, see
 *  CONFIG.STREAK_LEVELS). Each tier's look — how many of the flame's
 *  internal layers (core / side tongues / outer blaze) are visible,
 *  their color, and the glow — is entirely driven by CSS off this
 *  class (see .flame-base etc. in home.css), so the flame itself
 *  grows fuller and brighter with the streak rather than anything
 *  being added around it. */
function applyFireLevel(flameEl, count) {
  const level = getLevel(count);
  CONFIG.STREAK_LEVELS.forEach((l) => flameEl.classList.remove(l.fireClass));
  flameEl.classList.add(level.fireClass);
}

function openStreakModal() {
  const s = Store.data.streak;
  const level = getLevel(s.count);
  const next = getNextMilestone(s.count);

  $('streakModalCount').textContent = s.count;
  $('streakModalLevel').textContent = level.mastery;
  $('streakModalHint').textContent = next
    ? `${next - s.count} more day${next - s.count === 1 ? '' : 's'} to the next milestone`
    : "You've reached the top tier — legendary.";

  $('streakPeakStat').textContent = s.peak;
  $('streakRestoreStat').textContent = s.restores;
  $('streakSinceStat').textContent = s.firstStreakDate ? s.firstStreakDate.slice(5) : '-';
  applyFireLevel($('streakGiantFlame'), s.count);

  const row = $('milestoneRow');
  row.innerHTML = CONFIG.STREAK_MILESTONES.map((m) => `
    <div class="milestone-item ${s.count >= m ? 'is-reached' : ''}">
      <div class="milestone-dot fire-${m}">${FLAME_SVG}</div>
      <span>${m}d</span>
    </div>
  `).join('');

  openModal('streakModal');
}

// ---- Draggable position (nice-to-have, purely local UI state) ----
function wireBadge() {
  const fab = $('streakFab');
  const saved = JSON.parse(localStorage.getItem('streakFabPos') || 'null');
  if (saved) { fab.style.left = saved.x + 'px'; fab.style.top = saved.y + 'px'; fab.style.right = 'auto'; fab.style.bottom = 'auto'; }

  let dragging = false, moved = false, offX = 0, offY = 0;
  const start = (clientX, clientY) => {
    dragging = true; moved = false;
    const r = fab.getBoundingClientRect();
    offX = clientX - r.left; offY = clientY - r.top;
  };
  const move = (clientX, clientY) => {
    if (!dragging) return;
    moved = true;
    const x = clamp(clientX - offX, 6, window.innerWidth - fab.offsetWidth - 6);
    const y = clamp(clientY - offY, 6, window.innerHeight - fab.offsetHeight - 6);
    fab.style.left = x + 'px'; fab.style.top = y + 'px'; fab.style.right = 'auto'; fab.style.bottom = 'auto';
  };
  const end = () => {
    if (dragging && moved) {
      const r = fab.getBoundingClientRect();
      localStorage.setItem('streakFabPos', JSON.stringify({ x: r.left, y: r.top }));
    }
    dragging = false;
  };

  fab.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);
  fab.addEventListener('touchstart', (e) => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  window.addEventListener('touchmove', (e) => { if (dragging) move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchend', end);

  // Suppress the click-to-open-modal right after a real drag.
  fab.addEventListener('click', (e) => { if (moved) { e.stopImmediatePropagation(); moved = false; } }, true);
}
