// settings.js — profile editing, start date / scrolling text, the
// PIN-lock toggle, and the (currently inert) backend/Telegram sync
// panel. Theme picking lives in theme.js; backup/import lives in
// backup.js; both are initialized alongside this module in app.js.

import { $, $$, on, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';
import { isLockEnabled, openSetPinFlow, disableLock } from './lock.js';
import { confirmDialog } from '../core/dom.js';
import { attachDatePicker } from '../core/datepicker.js';
import { isNotifyEnabled, enableNotify, disableNotify } from './notifications.js';

let activeProfile = 1;
let floatingSyncs = [];

function profile() {
  return Store.data[`profile${activeProfile}`];
}

async function populateForm() {
  const p = profile();
  $('setName').value = p.name;
  $('setNickname').value = p.nickname;
  setDateField('setBirthday', p.birthday);
  $('setTelegram').value = p.telegram;
  $('setEmail').value = p.email;
  renderPhoneTags();

  const avatarImg = $('setAvatarImg');
  if (p.avatarId) {
    const url = await mediaUrl(p.avatarId);
    avatarImg.innerHTML = url ? `<img src="${url}" alt="">` : avatarPlaceholder();
  } else {
    avatarImg.innerHTML = avatarPlaceholder();
  }
  floatingSyncs.forEach((fn) => fn());
}
function avatarPlaceholder() {
  return '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5v3h18v-3c0-2.8-4.6-5-9-5z"/></svg>';
}

function setDateField(id, iso) {
  const input = $(id);
  if (input._dpSetValue) input._dpSetValue(iso || '');
  else input.value = iso || '';
}

function renderPhoneTags() {
  const wrap = $('setPhoneTags');
  const phones = profile().phones;
  wrap.innerHTML = phones.map((ph, i) => `
    <span class="tag-pill">${ph}<button data-i="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button></span>
  `).join('');
  $$('button', wrap).forEach((btn) => on(btn, 'click', () => {
    const i = Number(btn.dataset.i);
    Store.patch((d) => { d[`profile${activeProfile}`].phones.splice(i, 1); });
    renderPhoneTags();
  }));
}

function bindField(id, key) {
  on($(id), 'change', () => {
    const val = $(id).value;
    Store.patch((d) => { d[`profile${activeProfile}`][key] = val; });
  });
}

function setActiveProfile(n) {
  activeProfile = n;
  $$('.profile-toggle button').forEach((b) => b.classList.toggle('is-active', Number(b.dataset.profile) === n));
  populateForm();
}

async function uploadAvatar(file) {
  const oldId = profile().avatarId;
  const id = await saveMedia(file);
  if (oldId) await removeMedia(oldId);
  Store.patch((d) => { d[`profile${activeProfile}`].avatarId = id; });
  populateForm();
  snackbar('Photo updated');
}

function renderLockSwitch() {
  $('lockSwitch').classList.toggle('is-on', isLockEnabled());
}

function wireLock() {
  renderLockSwitch();
  document.addEventListener('lock:changed', renderLockSwitch);
  on($('lockSwitch'), 'click', async () => {
    if (isLockEnabled()) {
      const ok = await confirmDialog('Turn off the PIN lock?', 'Turn off');
      if (ok) { disableLock(); renderLockSwitch(); }
    } else {
      openSetPinFlow();
    }
  });
}

function renderNotifySwitch() {
  $('notifySwitch').classList.toggle('is-on', isNotifyEnabled());
}

function wireNotify() {
  renderNotifySwitch();
  on($('notifySwitch'), 'click', async () => {
    if (isNotifyEnabled()) {
      disableNotify();
    } else {
      const granted = await enableNotify();
      if (!granted) snackbar('Notifications need to be allowed in your browser settings');
    }
    renderNotifySwitch();
  });
}

function wireSyncPanel() {
  on($('connectTelegramBtn'), 'click', async () => {
    const { SyncService } = await import('../services/sync.service.js');
    const res = await SyncService.linkTelegram();
    if (!res.ok) snackbar('Telegram sync is coming in a future update');
  });
}

/** Turns a `.field` (label + input/textarea) into a floating-label
 *  field: the label sits over the input until it's focused or has a
 *  value, then floats up. Driven by classes rather than CSS-only
 *  tricks so it works the same whether the value was typed or set
 *  programmatically (e.g. by the date picker or populateForm). */
function setupFloatingField(id) {
  const input = $(id);
  const wrap = input.closest('.field');
  if (!wrap) return () => {};
  wrap.classList.add('field-floating');
  const sync = () => wrap.classList.toggle('is-filled', !!input.value);
  input.addEventListener('focus', () => wrap.classList.add('is-focused'));
  input.addEventListener('blur', () => { wrap.classList.remove('is-focused'); sync(); });
  input.addEventListener('input', sync);
  input.addEventListener('change', sync);
  sync();
  return sync;
}

function renderDeveloperInfo() {
  const dev = CONFIG.DEVELOPER;
  $('devName').textContent = dev.name;
  $('devTeam').textContent = dev.team;
  const tg = $('devTelegram');
  tg.textContent = `@${dev.telegram}`;
  tg.href = `https://t.me/${dev.telegram}`;
  const email = $('devEmail');
  email.textContent = dev.email;
  email.href = `mailto:${dev.email}`;
}

export function initSettings() {
  $$('.profile-toggle button').forEach((btn) => on(btn, 'click', () => setActiveProfile(Number(btn.dataset.profile))));

  bindField('setName', 'name');
  bindField('setNickname', 'nickname');
  bindField('setBirthday', 'birthday');
  bindField('setTelegram', 'telegram');
  bindField('setEmail', 'email');

  attachDatePicker($('setBirthday'), { title: 'Birthday', max: new Date().toISOString().slice(0, 10) });
  attachDatePicker($('setStartDate'), { title: 'Start date', max: new Date().toISOString().slice(0, 10) });

  floatingSyncs = [
    setupFloatingField('setName'),
    setupFloatingField('setNickname'),
    setupFloatingField('setBirthday'),
    setupFloatingField('setTelegram'),
    setupFloatingField('setEmail'),
    setupFloatingField('setStartDate'),
    setupFloatingField('setScrollText'),
    setupFloatingField('setPhoneInput'),
  ];

  on($('setPhoneAddBtn'), 'click', () => {
    const input = $('setPhoneInput');
    const val = input.value.trim();
    if (!val) return;
    Store.patch((d) => { d[`profile${activeProfile}`].phones.push(val); });
    input.value = '';
    input.dispatchEvent(new Event('change'));
    renderPhoneTags();
  });

  // Note: setAvatarInput is an absolutely-positioned, fully-covering
  // <input> inside setAvatarPreview (see .avatar-upload in
  // settings.css), so a tap already reaches it directly — no need to
  // forward a click from the wrapper (that would open the picker twice).
  const avatarInput = $('setAvatarInput');
  on(avatarInput, 'change', () => { if (avatarInput.files[0]) uploadAvatar(avatarInput.files[0]); avatarInput.value = ''; });

  on($('setStartDate'), 'change', () => Store.patch((d) => { d.startDate = $('setStartDate').value; }));
  on($('setScrollText'), 'change', () => Store.patch((d) => { d.scrollingText = $('setScrollText').value; }));

  wireLock();
  wireNotify();
  wireSyncPanel();
  renderDeveloperInfo();

  setActiveProfile(1);
  setDateField('setStartDate', Store.data.startDate || '');
  $('setScrollText').value = Store.data.scrollingText || '';
  floatingSyncs.forEach((fn) => fn());
}
