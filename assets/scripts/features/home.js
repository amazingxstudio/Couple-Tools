// home.js — the top of the home dashboard: avatar row, the "days
// together" pill + stat counter, the profile detail modal, and the
// optional custom wallpaper behind the whole page.
//
// Note on the wallpaper feature: the old app let you set a custom
// background image on the message page via a long-press, and that
// exact interaction is what triggered the "screen shrinks" bug when
// you then tapped a photo (see base.css for the fix). The message
// page is gone now, so that capability has moved here — long-press
// the profile row to set a wallpaper behind the whole dashboard.

import { $, $$, on, onLongPress, openModal, closeModal, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';
import { daysMonthsYearsBetween, ddmmyyyy, escapeHtml } from '../core/utils.js';
import { openSurface } from '../core/dom.js';

export async function renderProfileRow() {
  await renderAvatar(1, $('avatarBtn1'));
  await renderAvatar(2, $('avatarBtn2'));
  renderAnnivPill();
}

async function renderAvatar(which, btn) {
  const p = Store.data[`profile${which}`];
  btn.innerHTML = '';
  if (p.avatarId) {
    const url = await mediaUrl(p.avatarId);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = p.name || `Partner ${which}`;
      btn.appendChild(img);
      return;
    }
  }
  btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5v3h18v-3c0-2.8-4.6-5-9-5z"/></svg>`;
}

function renderAnnivPill() {
  const { startDate } = Store.data;
  const pill = $('annivPill');
  if (!startDate) {
    pill.querySelector('.eyebrow').textContent = 'Set your date';
    pill.querySelector('.value').textContent = 'Tap to begin';
    return;
  }
  const { days } = daysMonthsYearsBetween(startDate);
  pill.querySelector('.eyebrow').textContent = 'Together since ' + ddmmyyyy(startDate);
  pill.querySelector('.value').textContent = `Day ${days}`;
}

export function renderCounter() {
  const { startDate, scrollingText } = Store.data;
  const { days, months, years } = daysMonthsYearsBetween(startDate);
  $('counterDays').textContent = days;
  $('counterMonths').textContent = months;
  $('counterYears').textContent = years;
  const textEl = $('counterScrollText');
  textEl.textContent = scrollingText || (startDate ? "Every day with you is one I'd choose again." : 'Add your story in Settings.');
}

async function openProfileView(which) {
  const p = Store.data[`profile${which}`];
  $('profileViewName').textContent = p.name || `Partner ${which}`;
  $('profileViewNickname').textContent = p.nickname ? `"${p.nickname}"` : '';
  $('profileViewBirthday').textContent = p.birthday ? ddmmyyyy(p.birthday) : 'Not set';
  $('profileViewTelegram').textContent = p.telegram ? '@' + p.telegram.replace(/^@/, '') : 'Not set';
  const phoneWrap = $('profileViewPhones');
  phoneWrap.innerHTML = p.phones.length
    ? p.phones.map((ph) => `<span class="tag-pill">${escapeHtml(ph)}</span>`).join('')
    : '<span class="u-muted" style="font-size:.82rem">No phone numbers added</span>';

  const img = $('profileViewAvatar');
  if (p.avatarId) {
    const url = await mediaUrl(p.avatarId);
    img.style.display = url ? 'block' : 'none';
    if (url) img.src = url;
  } else {
    img.style.display = 'none';
  }
  openModal('profileViewOverlay');
}

// ---- Home wallpaper (long-press profile row) ----
async function applyHomeBg() {
  const home = $('homeScreen');
  const id = Store.data.homeBg;
  if (!id) { home.style.backgroundImage = ''; home.classList.remove('has-custom-bg'); return; }
  const url = await mediaUrl(id);
  if (url) {
    home.style.backgroundImage = `url("${url}")`;
    home.style.backgroundSize = 'cover';
    home.style.backgroundPosition = 'center';
    home.classList.add('has-custom-bg');
  }
}

function wireHomeBgPicker() {
  const input = $('homeBgFileInput');
  on($('homeBgUploadBtn'), 'click', () => input.click());
  on(input, 'change', async () => {
    const file = input.files[0];
    if (!file) return;
    const oldId = Store.data.homeBg;
    const id = await saveMedia(file);
    if (oldId) await removeMedia(oldId);
    Store.patch((d) => { d.homeBg = id; });
    await applyHomeBg();
    closeModal('homeBgOverlay');
    snackbar('Wallpaper updated');
    input.value = '';
  });
  on($('homeBgResetBtn'), 'click', async () => {
    const oldId = Store.data.homeBg;
    if (oldId) await removeMedia(oldId);
    Store.patch((d) => { d.homeBg = null; });
    await applyHomeBg();
    closeModal('homeBgOverlay');
    snackbar('Wallpaper reset');
  });
}

export function initHome() {
  on($('avatarBtn1'), 'click', () => openProfileView(1));
  on($('avatarBtn2'), 'click', () => openProfileView(2));
  on($('profileViewClose'), 'click', () => closeModal('profileViewOverlay'));
  on($('annivPill'), 'click', () => openSurface('calendarScreen'));
  on($('counterCard'), 'click', () => openSurface('calendarScreen'));

  onLongPress($('profileRow'), () => openModal('homeBgOverlay'));
  on($('homeBgCancelBtn'), 'click', () => closeModal('homeBgOverlay'));
  wireHomeBgPicker();
  applyHomeBg();

  renderProfileRow();
  renderCounter();
  setInterval(renderCounter, 60 * 1000);

  Store.subscribe(() => { renderProfileRow(); renderCounter(); });
}
