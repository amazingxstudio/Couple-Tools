// state.js — the single in-memory copy of `appData`, plus a tiny
// event bus so feature modules can react when something they don't
// own changes (e.g. the gallery re-rendering when settings adds photos).

import { loadAppData, saveAppData, saveAppDataNow } from '../services/storage.service.js';

let appData = null;
const listeners = new Set();

export const Store = {
  async init() {
    appData = await loadAppData();
    return appData;
  },

  get data() {
    return appData;
  },

  /** Mutate appData in place via `fn`, then persist + notify. */
  patch(fn) {
    fn(appData);
    saveAppData(appData);
    listeners.forEach((l) => l());
  },

  /** Same as patch, but flushes to disk immediately (used before
   *  navigation-heavy actions where a debounce could be dropped). */
  async patchNow(fn) {
    fn(appData);
    await saveAppDataNow(appData);
    listeners.forEach((l) => l());
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
