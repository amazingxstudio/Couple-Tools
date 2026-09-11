// chime.service.js — a small, pleasant notification sound, synthesized
// on the fly with the Web Audio API instead of shipping an audio file.
// That keeps it dependency-free and means there's nothing to fetch
// before it can play, which matters for a PWA that should work
// fully offline.

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(ac, freq, startAt, duration, gainPeak = 0.18) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** A soft two-note "twinkle" — used for special-day reminders. */
export function playChime() {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  tone(ac, 987.77, now, 0.55);        // B5
  tone(ac, 1318.51, now + 0.14, 0.6); // E6
  tone(ac, 1567.98, now + 0.28, 0.7, 0.14); // G6, softer tail
}
