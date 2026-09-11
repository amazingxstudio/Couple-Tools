// config.js — feature flags, static content, and the default data shape.
//
// This file is also where the *next* milestone (backend + Telegram bot
// sync) gets wired in. Nothing here talks to a network yet — SYNC_ENABLED
// is false and services/sync.service.js is a no-op — but every place in
// the app that saves data already calls through that one service, so
// turning sync on later is a change in exactly one file.

export const CONFIG = {
  APP_NAME: 'Couple Tools',
  DATA_VERSION: 2,

  // ---- Future backend integration (not active yet) ----
  SYNC_ENABLED: false,
  API_BASE_URL: '', // e.g. 'https://api.your-domain.com' once the backend exists
  TELEGRAM_BOT_USERNAME: '', // e.g. 'CoupleToolsBot' — used to build the deep link

  // ---- Streak tuning ----
  STREAK_LEVELS: [
    { min: 0,   name: 'Spark Beginner',   mastery: 'Spark',   fireClass: 'fire-0' },
    { min: 3,   name: 'Ember Guardian',   mastery: 'Guardian', fireClass: 'fire-3' },
    { min: 10,  name: 'Phoenix Rising',   mastery: 'Phoenix', fireClass: 'fire-10' },
    { min: 50,  name: 'Blaze Master',     mastery: 'Blaze Sovereign', fireClass: 'fire-50' },
    { min: 100, name: 'Inferno Legend',   mastery: 'Inferno Lord', fireClass: 'fire-100' },
    { min: 200, name: 'Mythic Dragon',    mastery: 'Dragon Mythic', fireClass: 'fire-200' },
  ],
  STREAK_MILESTONES: [3, 10, 50, 100, 200],

  THEME_LIST: [
    { key: 'theme-default',  label: 'Linen' },
    { key: 'theme-pink',     label: 'Bloom' },
    { key: 'theme-ocean',    label: 'Tide' },
    { key: 'theme-sunset',   label: 'Dusk' },
    { key: 'theme-dark',     label: 'Midnight' },
    { key: 'theme-colorful', label: 'Prism' },
  ],

  NOTE_CATEGORIES: ['Note', 'Promise', 'Plan', 'Reminder'],

  // ---- Developer / credits (shown in Settings → About) ----
  DEVELOPER: {
    name: 'Aung Myat Minn',
    team: 'AmazinG X Studio',
    telegram: 'aung_myat_minn',
    email: 'aungmyatminnx@gmail.com',
  },

  // ---- AOD quick-launch circle panel ----
  APP_LAUNCHER: [
    { key: 'telegram', label: 'Telegram', url: 'https://t.me/', color: '#2AABEE' },
    { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/', color: '#111111' },
    { key: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/', color: '#FF0000' },
    {
      key: 'chatgpt',
      label: 'ChatGPT',
      url: 'https://chatgpt.com/',
      color: '#10A37F',
      isBot: true,
      avatar: 'assets/icons/apps/chatgpt-logo.png',
    },
    {
      key: 'nexusduos',
      label: 'Nexus Duos',
      url: 'https://t.me/NexusDuos_bot',
      color: '#a6425a',
      isBot: true,
      avatar: 'assets/icons/apps/nexusduos-bot.png',
    },
  ],

  // ---- Special-day notifications ----
  NOTIFY_DAYS_BEFORE: [3, 1],

  DAILY_QUESTIONS: [
    'What moment from this week made you smile?',
    "What's one small thing I did recently that you appreciated?",
    'If we could go anywhere this weekend, where would you pick?',
    "What's a habit of mine you secretly love?",
    'What song reminds you of us right now?',
    'What are you most looking forward to together?',
    'What is one thing you want more of in our relationship?',
    "What's your favourite memory of us from this year?",
    'What made today better than yesterday?',
    'What is something new you would like us to try?',
    'What do you think we do best as a couple?',
    "What's a small comfort you'd like from me this week?",
    'Where do you picture us five years from now?',
    'What is something I do that always makes you feel loved?',
    "What's on your mind that we haven't talked about yet?",
  ],
};

export function defaultAppData() {
  return {
    version: CONFIG.DATA_VERSION,
    onboarded: false,
    theme: 'theme-default',

    profile1: emptyProfile(),
    profile2: emptyProfile(),
    startDate: null,
    scrollingText: '',

    gallery: [],          // [{ id, favorite }]
    currentImgIndex: 0,

    songs: [],             // [{ id, name, albumArtId }]
    currentSongIndex: 0,
    shuffleMode: false,
    loopMode: 'all',

    calendarData: {},      // { 'YYYY-MM-DD': { notes:[{id,cat,text,ts}], memories:[mediaId] } }

    aod: { clockType: 'line', bgId: null },
    homeBg: null,          // custom wallpaper behind the home dashboard

    lock: { enabled: false, pinHash: null },

    together: {
      answers: [],         // [{id, questionIndex, who, text, ts}]
      notes: [],            // [{id, who, text, ts}]
      bucket: [],            // [{id, text, done, ts}]
      gratitude: [],          // [{id, text, ts}]
      milestones: [],          // [{id, date, title, note}]
    },

    streak: {
      count: 0, lastDate: '', restores: 3, month: new Date().getMonth(),
      peak: 0, firstStreakDate: '', restoresUsed: 0,
    },

    sync: { remoteEnabled: false, telegramLinked: false },

    notifications: {
      enabled: false,       // becomes true once the person grants permission
      notified: [],         // e.g. "anniv-2026-0" — keys already alerted, so we never repeat one
    },
  };
}

function emptyProfile() {
  return { avatarId: null, name: '', nickname: '', birthday: '', telegram: '', email: '', phones: [] };
}
