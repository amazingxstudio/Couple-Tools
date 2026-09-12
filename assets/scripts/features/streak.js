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
      <div class="milestone-dot">
        <svg viewBox="0 0 24 24"><path d="M12 2c1 4-3 5-3 9a3 3 0 006 0c0-1-.4-2-1-3 2 1 3 3 3 5a5 5 0 01-10 0c0-4 3-6 5-11z"/></svg>
      </div>
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
