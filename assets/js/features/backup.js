// backup.js — export everything (appData + every stored photo/song)
// as one downloadable JSON file, and restore from it. This is also
// today's real answer to "what if I get a new phone": there's no
// backend yet to sync automatically, so a manual backup file is the
// safety net until the Telegram-bot sync in Settings goes live.

import { $, on, confirmDialog, snackbar, alertDialog } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaStore } from '../services/db.js';
import { putMediaWithId } from '../services/media.service.js';
import { CONFIG } from '../core/config.js';

function collectMediaIds(data) {
  const ids = new Set();
  const add = (id) => { if (id) ids.add(id); };
  add(data.profile1.avatarId);
  add(data.profile2.avatarId);
  add(data.homeBg);
  add(data.aod.bgId);
  data.gallery.forEach((g) => add(g.id));
  data.songs.forEach((s) => { add(s.id); add(s.albumArtId); });
  Object.values(data.calendarData).forEach((entry) => (entry.memories || []).forEach(add));
  return Array.from(ids);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function base64ToBlob(dataUrl) {
  return fetch(dataUrl).then((r) => r.blob());
}

async function exportBackup() {
  snackbar('Preparing backup…');
  const data = Store.data;
  const ids = collectMediaIds(data);
  const media = {};
  for (const id of ids) {
    const blob = await mediaStore.getItem(id);
    if (blob) media[id] = { type: blob.type, data: await blobToBase64(blob) };
  }
  const pkg = { app: CONFIG.APP_NAME, exportedAt: new Date().toISOString(), version: CONFIG.DATA_VERSION, appData: data, media };
  const blob = new Blob([JSON.stringify(pkg)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `couple-tools-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  snackbar('Backup downloaded');
}

async function importBackup(file) {
  const ok = await confirmDialog('Importing will replace everything currently in the app. Continue?', 'Import & replace');
  if (!ok) return;
  try {
    const text = await file.text();
    const pkg = JSON.parse(text);
    if (!pkg.appData) throw new Error('missing appData');

    for (const [id, entry] of Object.entries(pkg.media || {})) {
      const blob = await base64ToBlob(entry.data);
      await putMediaWithId(id, blob);
    }
    await Store.patchNow((d) => { Object.assign(d, pkg.appData); });
    snackbar('Backup restored');
    setTimeout(() => window.location.reload(), 600);
  } catch (err) {
    await alertDialog("That file couldn't be read as a Couple Tools backup.");
  }
}

export function initBackup() {
  on($('exportBackupBtn'), 'click', exportBackup);
  const input = $('importBackupInput');
  on($('importBackupBtn'), 'click', () => input.click());
  on(input, 'change', () => { if (input.files[0]) importBackup(input.files[0]); input.value = ''; });

  on($('resetAllBtn'), 'click', async () => {
    const ok = await confirmDialog('This permanently deletes every photo, song, and note in the app. Are you sure?', 'Delete everything');
    if (!ok) return;
    await mediaStore.clear();
    const { kvStore, KV_KEY } = await import('../services/db.js');
    await kvStore.removeItem(KV_KEY);
    window.location.reload();
  });
}
