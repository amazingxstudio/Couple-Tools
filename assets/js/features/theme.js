// theme.js — applies the active theme and drives the theme picker row.

import { $, $$ } from '../core/dom.js';
import { Store } from '../core/state.js';
import { CONFIG } from '../core/config.js';

let transitioning = false;

export function applyThemeImmediate(themeKey) {
  document.body.className = themeKey || 'theme-default';
}

export function setTheme(themeKey) {
  if (transitioning || themeKey === Store.data.theme) {
    if (themeKey === Store.data.theme) return;
  }
  transitioning = true;
  const overlay = $('themeTransitionOverlay');
  overlay.classList.add('is-active');
  setTimeout(() => {
    applyThemeImmediate(themeKey);
    Store.patch((d) => { d.theme = themeKey; });
    renderSwatches();
    setTimeout(() => {
      overlay.classList.remove('is-active');
      transitioning = false;
    }, 260);
  }, 260);
}

export function renderSwatches() {
  const row = $('themeRow');
  if (!row) return;
  row.innerHTML = CONFIG.THEME_LIST.map((t) => `
    <button class="theme-swatch ${t.key === Store.data.theme ? 'is-active' : ''}" data-theme="${t.key}" type="button">
      <span class="dot swatch-${t.key}"></span>
      <span>${t.label}</span>
    </button>
  `).join('');
  $$('.theme-swatch', row).forEach((btn) => {
    btn.addEventListener('click', () => setTheme(btn.dataset.theme));
  });
}

export function initTheme() {
  applyThemeImmediate(Store.data.theme);
  renderSwatches();
}
