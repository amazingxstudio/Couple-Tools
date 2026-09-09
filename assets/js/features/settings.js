// settings.js — profile editing, start date / scrolling text, the
// PIN-lock toggle, and the (currently inert) backend/Telegram sync
// panel. Theme picking lives in theme.js; backup/import lives in
// backup.js; both are initialized alongside this module in app.js.

import { $, $$, on, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';
import { isLockEnabled, openSetPinFlow, disableLock } from './lock.js';
import { confirmDialog } from '../core/dom.js';

let activeProfile = 1;

function profile() {
  return Store.data[`profile${activeProfile}`];
}

async function populateForm() {
  const p = profile();
  $('setName').value = p.name;
  $('setNickname').value = p.nickname;
  $('setBirthday').value = p.birthday;
  $('setTelegram').value = p.telegram;
  $('setEmail').value = p.email;
  renderPhoneTags();

  const avatarPreview = $('setAvatarPreview');
  if (p.avatarId) {
    const url = await mediaUrl(p.avatarId);
    avatarPreview.innerHTML = url ? `<img src="${url}" alt="">` : avatarPlaceholder();
  } else {
    avatarPreview.innerHTML = avatarPlaceholder();
  }
}
function avatarPlaceholder() {
  return '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.4 0-9 2.2-9 5v3h18v-3c0-2.8-4.6-5-9-5z"/></svg>';
}

function renderPhoneTags() {
  const wrap = $('setPhoneTags');
  const phones = profile().phones;
  wrap.innerHTML = phones.map((ph, i) => `
    <span class="tag-pill">${ph}<button data-i="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" width="10" height="10"><path fill="currentColor" d="M6 6l12 12M18 6L6 18"/></svg></button></span>
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

function wireSyncPanel() {
  on($('connectTelegramBtn'), 'click', async () => {
    const { SyncService } = await import('../services/sync.service.js');
    const res = await SyncService.linkTelegram();
    if (!res.ok) snackbar('Telegram sync is coming in a future update');
  });
}

export function initSettings() {
  $$('.profile-toggle button').forEach((btn) => on(btn, 'click', () => setActiveProfile(Number(btn.dataset.profile))));

  bindField('setName', 'name');
  bindField('setNickname', 'nickname');
  bindField('setBirthday', 'birthday');
  bindField('setTelegram', 'telegram');
  bindField('setEmail', 'email');

  on($('setPhoneAddBtn'), 'click', () => {
    const input = $('setPhoneInput');
    const val = input.value.trim();
    if (!val) return;
    Store.patch((d) => { d[`profile${activeProfile}`].phones.push(val); });
    input.value = '';
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
  wireSyncPanel();

  setActiveProfile(1);
  $('setStartDate').value = Store.data.startDate || '';
  $('setScrollText').value = Store.data.scrollingText || '';
}
