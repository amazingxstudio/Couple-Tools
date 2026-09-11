// notifications.js — best-effort reminders for the anniversary and
// birthdays. There's no backend/push server for this app (see the
// "Backend & Telegram bot" panel in Settings — it's marked Planned),
// so this checks while the app is open rather than truly in the
// background: on boot, and then every so often for as long as the
// tab stays open. That's honestly what's possible for a
// no-backend, on-device app; real background delivery needs the
// Telegram bot / push service that section is waiting on.

import { Store } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { todayStr } from '../core/utils.js';
import { playChime } from '../services/chime.service.js';

let checkTimer = null;

export function isNotifyEnabled() {
  return !!(Store.data.notifications && Store.data.notifications.enabled);
}

export async function enableNotify() {
  if (!('Notification' in window)) {
    Store.patch((d) => { d.notifications.enabled = true; });
    return true; // fall back to in-app snackbar + chime only
  }
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  const granted = perm === 'granted';
  Store.patch((d) => { d.notifications.enabled = granted || perm === 'default'; });
  if (granted) checkSpecialDays();
  return granted;
}

export function disableNotify() {
  Store.patch((d) => { d.notifications.enabled = false; });
}

function daysUntil(fromKey, monthDay) {
  // monthDay: [month(0-11), day]
  const today = new Date(fromKey + 'T00:00:00');
  let target = new Date(today.getFullYear(), monthDay[0], monthDay[1]);
  if (target < today) target = new Date(today.getFullYear() + 1, monthDay[0], monthDay[1]);
  return Math.round((target - today) / 86400000);
}

function specialDayList() {
  const { profile1, profile2, startDate } = Store.data;
  const list = [];
  if (startDate) {
    const d = new Date(startDate + 'T00:00:00');
    list.push({ key: 'anniv', label: 'Your anniversary', monthDay: [d.getMonth(), d.getDate()] });
  }
  if (profile1.birthday) {
    const d = new Date(profile1.birthday + 'T00:00:00');
    list.push({ key: 'bday1', label: `${profile1.name || 'Partner 1'}'s birthday`, monthDay: [d.getMonth(), d.getDate()] });
  }
  if (profile2.birthday) {
    const d = new Date(profile2.birthday + 'T00:00:00');
    list.push({ key: 'bday2', label: `${profile2.name || 'Partner 2'}'s birthday`, monthDay: [d.getMonth(), d.getDate()] });
  }
  return list;
}

function fireReminder(text) {
  playChime();
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Couple Tools', { body: text, tag: 'couple-tools-special-day' }); return; } catch { /* fall through to snackbar */ }
  }
  import('../core/dom.js').then(({ snackbar }) => snackbar(text));
}

export function checkSpecialDays() {
  if (!isNotifyEnabled()) return;
  const today = todayStr();
  const notified = new Set(Store.data.notifications.notified || []);
  let changed = false;

  specialDayList().forEach((item) => {
    const diff = daysUntil(today, item.monthDay);
    let key = null;
    let text = null;
    if (diff === 0) { key = `${item.key}-${today}-today`; text = `Today is ${item.label.toLowerCase()}! 🎉`; }
    else if (CONFIG.NOTIFY_DAYS_BEFORE.includes(diff)) { key = `${item.key}-${today}-in${diff}`; text = `${item.label} is in ${diff} day${diff > 1 ? 's' : ''}.`; }
    if (key && !notified.has(key)) {
      fireReminder(text);
      notified.add(key);
      changed = true;
    }
  });

  if (changed) {
    Store.patch((d) => {
      // keep the list from growing forever — only the last ~60 keys matter
      d.notifications.notified = Array.from(notified).slice(-60);
    });
  }
}

export function initNotifications() {
  checkSpecialDays();
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(checkSpecialDays, 60 * 60 * 1000); // re-check hourly while open
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSpecialDays(); });
}
