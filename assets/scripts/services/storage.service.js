// storage.service.js — the single place that loads and persists
// `appData`. Feature modules never touch localforage directly; they
// call Store.patch() (see core/state.js) which calls save() here.

import { kvStore, legacyStore, mediaStore, KV_KEY, LEGACY_KEY, LEGACY_STREAK_KEY } from './db.js';
import { defaultAppData, CONFIG } from '../core/config.js';
import { debounce } from '../core/utils.js';
import { SyncService } from './sync.service.js';

/** Load appData: new schema if present, otherwise try to migrate the
 *  old single-blob schema, otherwise start fresh. */
export async function loadAppData() {
  const existing = await kvStore.getItem(KV_KEY);
  if (existing) return normalize(existing);

  const migrated = await migrateLegacy();
  if (migrated) return migrated;

  return defaultAppData();
}

function normalize(data) {
  const base = defaultAppData();
  const merged = deepMerge(base, data);
  merged.version = CONFIG.DATA_VERSION;
  return merged;
}

function deepMerge(base, incoming) {
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (incoming[k] === undefined) continue;
    if (isPlainObject(base[k]) && isPlainObject(incoming[k])) {
      out[k] = deepMerge(base[k], incoming[k]);
    } else {
      out[k] = incoming[k];
    }
  }
  return out;
}
function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

const _save = debounce(async (data) => {
  await kvStore.setItem(KV_KEY, data);
  SyncService.push('app_data', data); // no-op today; real push once a backend exists
}, 250);

export function saveAppData(data) {
  _save(data);
}

/** Immediate (non-debounced) save — used before actions that navigate
 *  away or close the app, where a pending debounce could be lost. */
export async function saveAppDataNow(data) {
  await kvStore.setItem(KV_KEY, data);
}

// ---------------------------------------------------------------
// One-time migration from the old single-file app's data.
// Old schema kept every image/song as a base64 string embedded in
// one JSON document at legacyStore['core_data']. We convert each
// base64 payload into a real Blob in the new media store and carry
// over every field that still has an equivalent in the new schema.
// The old message/chat data (tgAccounts, readyMessages, msgBg) has
// no destination — that feature was removed — so it's intentionally
// left behind.
// ---------------------------------------------------------------
async function migrateLegacy() {
  let old;
  try {
    old = await legacyStore.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
  if (!old) return null;

  const data = defaultAppData();
  data.theme = old.theme || data.theme;
  data.startDate = old.startDate || null;
  data.scrollingText = old.scrollingText || '';
  data.shuffleMode = !!old.shuffleMode;
  data.onboarded = true; // returning user — skip the first-run wizard

  data.profile1 = await migrateProfile(old.profile1);
  data.profile2 = await migrateProfile(old.profile3); // profile3 -> profile2 rename

  // Gallery: base64 strings -> Blobs, favorites tracked by matching content before
  const favSet = new Set(old.favorites || []);
  if (Array.isArray(old.gallery)) {
    for (const b64 of old.gallery) {
      const id = await base64ToMedia(b64);
      if (id) data.gallery.push({ id, favorite: favSet.has(b64) });
    }
  }
  data.currentImgIndex = 0;

  // Songs: base64 -> Blob; album art (already extracted, base64) -> Blob
  if (Array.isArray(old.songs)) {
    const arts = old.songAlbumArts || {};
    for (let i = 0; i < old.songs.length; i++) {
      const s = old.songs[i];
      const id = await base64ToMedia(s.data);
      if (!id) continue;
      let albumArtId = null;
      if (arts[i]) albumArtId = await base64ToMedia(arts[i]);
      data.songs.push({ id, name: s.name || 'Untitled', albumArtId });
    }
  }

  // Calendar notes + memory photos
  if (old.calendarData) {
    for (const [dateKey, entry] of Object.entries(old.calendarData)) {
      const notes = Array.isArray(entry?.notes)
        ? entry.notes.map((n) => ({ id: cryptoId(), cat: n.cat || 'Note', text: n.text || '', ts: Date.now() }))
        : [];
      const memories = [];
      if (Array.isArray(entry?.memories)) {
        for (const b64 of entry.memories) {
          const id = await base64ToMedia(b64);
          if (id) memories.push(id);
        }
      }
      data.calendarData[dateKey] = { notes, memories };
    }
  }

  // AOD — the old app used a numeric clock-style id with no reliable
  // mapping to the redesigned styles below, so migrated users land on
  // the new default and can pick a style again in the AOD settings sheet.
  if (old.aod) {
    data.aod.clockType = 'line';
    data.aod.bgId = old.aod.bgImage ? await base64ToMedia(old.aod.bgImage) : null;
  }

  // Streak (was kept in a separate localStorage key, not localforage)
  try {
    const raw = localStorage.getItem(LEGACY_STREAK_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      data.streak = {
        count: s.count ?? 0,
        lastDate: s.lastDate ?? '',
        restores: s.restores ?? 3,
        month: s.month ?? new Date().getMonth(),
        peak: s.peak ?? 0,
        firstStreakDate: s.firstStreakDate ?? '',
        restoresUsed: s.restoresUsed ?? 0,
      };
    }
  } catch { /* ignore malformed legacy streak data */ }

  await kvStore.setItem(KV_KEY, data);
  return data;
}

async function migrateProfile(p) {
  const out = { avatarId: null, name: '', nickname: '', birthday: '', telegram: '', email: '', phones: [] };
  if (!p) return out;
  out.name = p.name || '';
  out.nickname = p.nickname || '';
  out.birthday = p.birthday || '';
  out.telegram = p.telegram || '';
  out.email = p.email || '';
  out.phones = typeof p.phones === 'string' && p.phones
    ? p.phones.split('|').map((s) => s.trim()).filter(Boolean)
    : [];
  if (p.img) out.avatarId = await base64ToMedia(p.img);
  return out;
}

async function base64ToMedia(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const id = cryptoId();
    await mediaStore.setItem(id, blob);
    return id;
  } catch {
    return null;
  }
}

function cryptoId() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random().toString(36).slice(2));
}
