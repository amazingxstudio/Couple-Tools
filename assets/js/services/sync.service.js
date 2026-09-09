// sync.service.js — the seam where the future backend + Telegram bot
// plugs in. Every save in the app already flows through here (see
// storage.service.js), so wiring up real sync later means editing
// this one file, not hunting through every feature module.
//
// Nothing here makes a network call yet. When the backend exists:
//   1. Set CONFIG.SYNC_ENABLED = true and CONFIG.API_BASE_URL.
//   2. Implement push()/pull() below with real fetch() calls.
//   3. Add a bearer token / device-pairing step (see linkTelegram()).

import { CONFIG } from '../core/config.js';

export const SyncService = {
  isEnabled() {
    return CONFIG.SYNC_ENABLED;
  },

  /** Called after every local save. No-op until a backend exists. */
  async push(key, value) {
    if (!CONFIG.SYNC_ENABLED) return { ok: false, reason: 'sync-disabled' };
    // TODO: fetch(`${CONFIG.API_BASE_URL}/sync/${key}`, { method: 'PUT', body: JSON.stringify(value) })
    return { ok: false, reason: 'not-implemented' };
  },

  /** Called on load, once a backend exists, to reconcile remote state. */
  async pull(key) {
    if (!CONFIG.SYNC_ENABLED) return null;
    // TODO: fetch(`${CONFIG.API_BASE_URL}/sync/${key}`).then(r => r.json())
    return null;
  },

  /** Kicks off pairing this device with a Telegram account via the bot.
   *  Until the bot exists this just reports itself unavailable so the
   *  Settings UI can show a clear "coming soon" state instead of a
   *  silent failure. */
  async linkTelegram() {
    if (!CONFIG.TELEGRAM_BOT_USERNAME) return { ok: false, reason: 'bot-not-configured' };
    // TODO: open `https://t.me/${CONFIG.TELEGRAM_BOT_USERNAME}?start=<pairing-code>`
    // and poll the backend for confirmation.
    return { ok: false, reason: 'not-implemented' };
  },
};
