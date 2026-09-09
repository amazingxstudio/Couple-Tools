// db.js — low-level storage handles. Nothing here knows about app
// features; it only knows how to talk to IndexedDB (via localforage).
//
// Two stores, on purpose:
//  - `kv`    holds ONE small JSON record: everything except binary
//            media. Small records save fast and reliably.
//  - `media` holds every photo / song / album-art / wallpaper as its
//            own native Blob, one row per id.
//
// The old app kept a single record with every photo and song
// base64-encoded *inside* it, so liking a photo rewrote the entire
// database — including every song's audio data — on every tap. That
// is a well-known source of IndexedDB slowness and failures on iOS
// Safari in particular. Splitting media into its own keyed store and
// writing Blobs directly (no base64 inflation) removes that problem.

export const kvStore = localforage.createInstance({
  name: 'CoupleToolsDB',
  storeName: 'kv',
});

export const mediaStore = localforage.createInstance({
  name: 'CoupleToolsDB',
  storeName: 'media',
});

// Handle to the *old* single-store database, used only for one-time
// migration of existing users' data into the new schema.
export const legacyStore = localforage.createInstance({
  name: 'Couple_Tools_DB',
  storeName: 'app_data',
});

export const KV_KEY = 'app_data_v2';
export const LEGACY_KEY = 'core_data';
export const LEGACY_STREAK_KEY = 'ember_streak';
