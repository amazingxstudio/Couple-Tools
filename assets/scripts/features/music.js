// music.js — the music bar on the home screen: playback, the
// Web-Audio visualizer, playlist management, and ID3 album art.

import { $, $$, on, openModal, closeModal, snackbar, confirmDialog } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia, extractAlbumArt } from '../services/media.service.js';
import * as Audio from '../services/audio.service.js';

function songs() { return Store.data.songs; }
function curIndex() { return Store.data.currentSongIndex || 0; }
let isPlaying = false;

export function initMusic() {
  Audio.initAudioElement($('audioPlayer'));
  Audio.onVisualizerFrame(drawVisualizer);

  on($('playPauseBtn'), 'click', togglePlay);
  on($('nextSongBtn'), 'click', () => changeSong(1));
  on($('prevSongBtn'), 'click', () => changeSong(-1));
  on($('shuffleBtn'), 'click', toggleShuffle);
  on($('loopBtn'), 'click', toggleLoop);
  on($('songListBtn'), 'click', () => { renderSongList(); openModal('songListOverlay'); });
  on($('songListCloseBtn'), 'click', () => closeModal('songListOverlay'));
  on($('favSongBtn'), 'click', toggleFavoriteCurrent);

  const input = $('addSongInput');
  on($('addSongBtn'), 'click', () => input.click());
  on(input, 'change', () => { addSongs(input.files); input.value = ''; });

  $('audioPlayer').addEventListener('ended', () => changeSong(1));

  renderPlayerBar();
  Store.subscribe(renderPlayerBar);
}

async function addSongs(fileList) {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('audio/'));
  if (!files.length) return;
  for (const file of files) {
    const id = await saveMedia(file);
    let albumArtId = null;
    const artBlob = await extractAlbumArt(file);
    if (artBlob) albumArtId = await saveMedia(artBlob);
    const name = file.name.replace(/\.[^/.]+$/, '');
    Store.patch((d) => { d.songs.push({ id, name, albumArtId, favorite: false }); });
  }
  renderPlayerBar();
  renderSongList();
  snackbar(`Added ${files.length} song${files.length > 1 ? 's' : ''}`);
}

async function loadCurrentIntoPlayer() {
  const list = songs();
  if (!list.length) { Audio.setSrc(''); return; }
  const s = list[curIndex() % list.length];
  const url = await mediaUrl(s.id);
  if (url) Audio.setSrc(url);
}

async function togglePlay() {
  if (!songs().length) { snackbar('Add a song first'); return; }
  await loadCurrentIntoPlayer();
  if (isPlaying) { Audio.pause(); isPlaying = false; }
  else { await Audio.play(); isPlaying = true; }
  renderPlayerBar();
}

async function changeSong(dir) {
  const list = songs();
  if (!list.length) return;
  let nextIndex;
  if (Store.data.shuffleMode) {
    nextIndex = Math.floor(Math.random() * list.length);
  } else {
    nextIndex = (curIndex() + dir + list.length) % list.length;
  }
  Store.patch((d) => { d.currentSongIndex = nextIndex; });
  await loadCurrentIntoPlayer();
  if (isPlaying) await Audio.play();
  renderPlayerBar();
}

function toggleShuffle() {
  Store.patch((d) => { d.shuffleMode = !d.shuffleMode; });
  $('shuffleBtn').classList.toggle('is-active', Store.data.shuffleMode);
}
function toggleLoop() {
  const modes = ['all', 'one', 'off'];
  const cur = modes.indexOf(Store.data.loopMode);
  const next = modes[(cur + 1) % modes.length];
  Store.patch((d) => { d.loopMode = next; });
  $('loopBtn').classList.toggle('is-active', next !== 'off');
}
function toggleFavoriteCurrent() {
  const list = songs();
  if (!list.length) return;
  const i = curIndex() % list.length;
  Store.patch((d) => { d.songs[i].favorite = !d.songs[i].favorite; });
  renderPlayerBar();
}

async function removeSong(i) {
  const ok = await confirmDialog('Remove this song?', 'Remove');
  if (!ok) return;
  const [removed] = Store.data.songs.splice(i, 1);
  await removeMedia(removed.id);
  if (removed.albumArtId) await removeMedia(removed.albumArtId);
  Store.patch((d) => {
    d.songs = d.songs;
    if (d.currentSongIndex >= d.songs.length) d.currentSongIndex = 0;
  });
  renderSongList();
  renderPlayerBar();
}

export async function renderPlayerBar() {
  const list = songs();
  const empty = !list.length;
  $('musicCard').classList.toggle('u-hide', empty);
  if (empty) return;

  const s = list[curIndex() % list.length];
  $('songMarquee').textContent = s.name;
  fitMarquee();

  const artEl = $('albumArt');
  if (s.albumArtId) {
    const url = await mediaUrl(s.albumArtId);
    artEl.innerHTML = url ? `<img src="${url}" alt="">` : defaultArtSvg();
  } else {
    artEl.innerHTML = defaultArtSvg();
  }

  $('playPauseIcon').innerHTML = isPlaying
    ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>'
    : '<path d="M8 5v14l11-7z"/>';
  $('shuffleBtn').classList.toggle('is-active', Store.data.shuffleMode);
  $('loopBtn').classList.toggle('is-active', Store.data.loopMode !== 'off');
  $('favSongBtn').classList.toggle('is-fav', !!s.favorite);
}

function defaultArtSvg() {
  return '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>';
}

function fitMarquee() {
  const mask = $('songMarqueeMask');
  const text = $('songMarquee');
  text.style.animation = 'none';
  text.style.transform = 'translateX(0)';
  requestAnimationFrame(() => {
    const overflow = text.scrollWidth - mask.clientWidth;
    if (overflow > 8) {
      text.style.setProperty('--marquee-dist', `-${overflow + 16}px`);
      text.style.animation = `marqueeScroll ${Math.max(4, overflow / 30)}s linear infinite alternate`;
    }
  });
}

function drawVisualizer(dataArray) {
  const bars = $$('.v-bar');
  if (!dataArray) { bars.forEach((b) => (b.style.height = '4px')); return; }
  const step = Math.floor(dataArray.length / bars.length);
  bars.forEach((bar, i) => {
    const v = dataArray[i * step] || 0;
    bar.style.height = Math.max(4, (v / 255) * 16) + 'px';
  });
}

export function renderSongList() {
  const list = songs();
  const wrap = $('songListItems');
  if (!list.length) {
    wrap.innerHTML = '<div class="empty-state">No songs yet — add your first one.</div>';
    return;
  }
  wrap.innerHTML = list.map((s, i) => `
    <div class="tag-pill" style="width:100%;justify-content:space-between;padding:10px 12px;margin-bottom:8px;${i === curIndex() ? `border-color:var(--accent)` : ''}">
      <span data-play="${i}" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;">${s.favorite ? '\u2605 ' : ''}${escapeAttr(s.name)}</span>
      <button data-remove="${i}" aria-label="Remove"><svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-play]').forEach((el) => {
    el.addEventListener('click', async () => {
      Store.patch((d) => { d.currentSongIndex = Number(el.dataset.play); });
      await loadCurrentIntoPlayer();
      if (isPlaying) await Audio.play();
      renderPlayerBar();
      renderSongList();
    });
  });
  wrap.querySelectorAll('[data-remove]').forEach((el) => {
    el.addEventListener('click', () => removeSong(Number(el.dataset.remove)));
  });
}

function escapeAttr(s) {
  return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
