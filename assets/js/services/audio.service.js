// audio.service.js — wraps the <audio> element and the Web Audio
// visualizer.
//
// iOS fix: Safari has a long-standing WebKit bug where routing an
// <audio> element through the Web Audio API (createMediaElementSource)
// plays silently unless `crossOrigin` is set on the element *before*
// its `src` is assigned and *before* the node graph is created. We do
// both, in that order, below. We also only create the AudioContext
// lazily on the first user-initiated play() (not on page load), since
// iOS Safari requires an AudioContext to be created/resumed inside a
// direct user-gesture call stack or it stays permanently suspended.

let audioEl = null;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let dataArray = null;
let rafId = null;

export function initAudioElement(el) {
  audioEl = el;
  audioEl.crossOrigin = 'anonymous'; // must be set before src / graph wiring
  audioEl.preload = 'metadata';
}

export function getAudioElement() {
  return audioEl;
}

function ensureGraph() {
  if (audioCtx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
  dataArray = new Uint8Array(analyser.frequencyBinCount);
}

export async function play() {
  ensureGraph();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch { /* ignore */ }
  }
  await audioEl.play();
  startVisualizer();
}

export function pause() {
  audioEl.pause();
  stopVisualizer();
}

export function setSrc(url) {
  if (audioEl.src !== url) audioEl.src = url;
}

let onFrame = null;
export function onVisualizerFrame(cb) {
  onFrame = cb;
}

function startVisualizer() {
  cancelAnimationFrame(rafId);
  const tick = () => {
    rafId = requestAnimationFrame(tick);
    if (!analyser || audioEl.paused) return;
    analyser.getByteFrequencyData(dataArray);
    if (onFrame) onFrame(dataArray);
  };
  tick();
}
function stopVisualizer() {
  cancelAnimationFrame(rafId);
  if (onFrame) onFrame(null); // let the UI collapse the bars
}
