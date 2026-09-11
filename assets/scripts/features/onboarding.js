// onboarding.js — a short first-run wizard so new installs start
// from something better than empty fields. Entirely optional: the
// person can skip straight to the app at any step.

import { $, $$ } from '../core/dom.js';
import { Store } from '../core/state.js';
import { attachDatePicker } from '../core/datepicker.js';

let step = 0;
const TOTAL_STEPS = 3;
let datePickerReady = false;

export function shouldOnboard() {
  return !Store.data.onboarded;
}

export function startOnboarding(onDone) {
  step = 0;
  render();
  $('onboardScreen').classList.add('is-open');
  if (!datePickerReady) {
    datePickerReady = true;
    attachDatePicker($('onboardStartDate'), { title: 'Start date', max: new Date().toISOString().slice(0, 10) });
  }

  $('onboardNextBtn').onclick = () => {
    if (step === 1) saveNames();
    if (step === 2) { saveStartDate(); finish(onDone); return; }
    step = Math.min(step + 1, TOTAL_STEPS - 1);
    render();
  };
  $('onboardBackBtn').onclick = () => {
    step = Math.max(step - 1, 0);
    render();
  };
  $('onboardSkipBtn').onclick = () => finish(onDone);
}

function finish(onDone) {
  Store.patch((d) => { d.onboarded = true; });
  $('onboardScreen').classList.remove('is-open');
  onDone && onDone();
}

function saveNames() {
  Store.patch((d) => {
    d.profile1.name = $('onboardName1').value.trim();
    d.profile2.name = $('onboardName2').value.trim();
  });
}
function saveStartDate() {
  const val = $('onboardStartDate').value;
  if (val) Store.patch((d) => { d.startDate = val; });
}

function render() {
  $$('.onboard-step').forEach((el, i) => el.classList.toggle('is-active', i === step));
  $$('#onboardDots span').forEach((el, i) => el.classList.toggle('is-active', i === step));
  $('onboardBackBtn').classList.toggle('u-hide', step === 0);
  $('onboardNextBtn').textContent = step === TOTAL_STEPS - 1 ? 'Get started' : 'Continue';
}
