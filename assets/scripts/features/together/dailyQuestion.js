// dailyQuestion.js — one rotating conversation-starter per day, with
// a shared answer log. Both of you answer from this device (or your
// own devices, once the Telegram-bot sync described in Settings
// exists) and see each other's past answers below.

import { $, $$, on } from '../../core/dom.js';
import { Store } from '../../core/state.js';
import { CONFIG } from '../../core/config.js';
import { uid, relativeTime, escapeHtml, todayStr } from '../../core/utils.js';

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

function todaysQuestion() {
  const idx = dayOfYear(new Date()) % CONFIG.DAILY_QUESTIONS.length;
  return { idx, text: CONFIG.DAILY_QUESTIONS[idx] };
}

let activeWho = 1;

function render() {
  const q = todaysQuestion();
  $('dqText').textContent = q.text;

  const log = Store.data.together.answers.slice().sort((a, b) => b.ts - a.ts);
  const wrap = $('dqLog');
  wrap.innerHTML = log.length
    ? log.map((a) => `
        <div class="answer-item card">
          <span class="date">${relativeTime(a.ts)}</span>
          <div class="who">${escapeHtml(nameFor(a.who))}</div>
          <p>${escapeHtml(a.text)}</p>
        </div>`).join('')
    : '<div class="empty-state">No answers yet today — start the conversation.</div>';
}

function nameFor(who) {
  const p = Store.data[`profile${who}`];
  return p.name || `Partner ${who}`;
}

function submit() {
  const input = $('dqAnswerInput');
  const text = input.value.trim();
  if (!text) return;
  const q = todaysQuestion();
  Store.patch((d) => {
    d.together.answers.push({ id: uid(), questionIndex: q.idx, who: activeWho, text, ts: Date.now() });
  });
  input.value = '';
  render();
}

export function initDailyQuestion() {
  $$('#dqWhoToggle button').forEach((btn) => on(btn, 'click', () => {
    activeWho = Number(btn.dataset.who);
    $$('#dqWhoToggle button').forEach((b) => b.classList.toggle('is-active', b === btn));
  }));
  on($('dqSubmitBtn'), 'click', submit);
  render();
  Store.subscribe(render);
}
