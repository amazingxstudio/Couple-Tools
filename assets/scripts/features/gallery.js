// gallery.js — the two photo cards on the home screen, the
// full-screen image viewer, favoriting, and adding/removing photos.
//
// iOS fix: the full-screen viewer (#imageViewer) is a `.surface`, so
// it inherits the `position:fixed; inset:0` rule from base.css
// instead of the old `width:100vw;height:100vh` — that mismatch
// between vw/vh and the real visual viewport was the "screen shrinks
// when you tap a photo" bug.

import { $, $$, on, onLongPress, openModal, closeModal, confirmDialog, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';

let gallerySelection = new Set();

function gallery() { return Store.data.gallery; }
function idx() { return Store.data.currentImgIndex || 0; }

export async function renderGalleryCards() {
  const g = gallery();
  const mainWrap = $('mainPhotoCard');
  const sideWrap = $('sidePhotoCard');
  const likeBtn = $('likeToggle');

  if (!g.length) {
    setPlaceholder(mainWrap, true);
    setPlaceholder(sideWrap, true);
    likeBtn.classList.add('u-hide');
    return;
  }
  likeBtn.classList.remove('u-hide');

  const i = idx() % g.length;
  const next = g[(i + 1) % g.length];
  await paintCard(mainWrap, g[i].id);
  await paintCard(sideWrap, next.id);
  likeBtn.classList.toggle('is-liked', !!g[i].favorite);

  // Warm the URL cache for every photo in the background so swiping
  // through the gallery (either card-to-card or in the full-screen
  // viewer) never has to wait on an IndexedDB read mid-swipe — that
  // wait was the "big white box flashes" the photo browsing used to have.
  prefetchGallery();
}

let prefetchedOnce = false;
async function prefetchGallery() {
  if (prefetchedOnce) return;
  prefetchedOnce = true;
  const g = gallery();
  await Promise.all(g.map((item) => mediaUrl(item.id)));
}

function setPlaceholder(wrap, show) {
  const fill = wrap.querySelector('.photo-fill');
  const ph = wrap.querySelector('.photo-placeholder');
  if (show) { fill.style.backgroundImage = ''; ph.classList.remove('u-hide'); }
  else { ph.classList.add('u-hide'); }
}

async function paintCard(wrap, mediaId) {
  const url = await mediaUrl(mediaId);
  const fill = wrap.querySelector('.photo-fill');
  if (url) { fill.style.backgroundImage = `url("${url}")`; setPlaceholder(wrap, false); }
  else { setPlaceholder(wrap, true); }
}

function next() {
  const g = gallery();
  if (!g.length) return;
  Store.patch((d) => { d.currentImgIndex = ((d.currentImgIndex || 0) + 1) % g.length; });
  renderGalleryCards();
}
function prev() {
  const g = gallery();
  if (!g.length) return;
  Store.patch((d) => { d.currentImgIndex = (((d.currentImgIndex || 0) - 1) + g.length) % g.length; });
  renderGalleryCards();
}

function toggleLike() {
  const g = gallery();
  if (!g.length) return;
  const i = idx() % g.length;
  Store.patch((d) => { d.gallery[i].favorite = !d.gallery[i].favorite; });
  renderGalleryCards();
}

async function openViewerAt(i) {
  const g = gallery();
  if (!g.length) return;
  await prefetchGallery();
  const url = await mediaUrl(g[i].id);
  if (!url) return;
  $('fullImage').src = url;
  $('imageViewer').dataset.index = i;
  $('imageViewer').dataset.mode = 'gallery';
  $('deletePhotoBtn').classList.remove('u-hide');
  $('imageViewer').classList.add('is-open');
}

/** Opens the same full-screen viewer for an image that isn't part of
 *  the main gallery array (e.g. a calendar memory photo). No delete
 *  control is shown, since there's no gallery index to remove, and
 *  swiping between photos is disabled (there's no sibling list). */
export function openImageViewerUrl(url) {
  if (!url) return;
  $('fullImage').src = url;
  $('imageViewer').dataset.mode = 'external';
  $('deletePhotoBtn').classList.add('u-hide');
  $('imageViewer').classList.add('is-open');
}

export function closeViewer() {
  $('imageViewer').classList.remove('is-open');
}

/** Slides to the next/previous photo inside the full-screen viewer.
 *  Every neighbouring URL is already warm in the media cache (see
 *  prefetchGallery), so this swap is effectively instant — the image
 *  just slides in from the swipe direction instead of the old
 *  "blank box while it loads" flash. */
async function shiftViewer(dir) {
  const g = gallery();
  if ($('imageViewer').dataset.mode !== 'gallery' || g.length < 2) return;
  let i = Number($('imageViewer').dataset.index) || 0;
  i = ((i + dir) % g.length + g.length) % g.length;
  const url = await mediaUrl(g[i].id);
  const img = $('fullImage');
  $('imageViewer').dataset.index = i;
  img.style.transition = 'none';
  img.style.transform = `translateX(${dir * 34}px)`;
  img.style.opacity = '0.15';
  img.src = url;
  void img.offsetWidth; // force reflow so the transition below actually animates
  img.style.transition = 'transform 0.22s cubic-bezier(0.2,0.8,0.2,1), opacity 0.22s ease';
  img.style.transform = 'translateX(0)';
  img.style.opacity = '1';
  Store.patch((d) => { d.currentImgIndex = i; });
}

function wireViewerSwipe() {
  const viewport = $('ivViewport');
  const img = $('fullImage');
  let startX = 0, startY = 0, dx = 0, dragging = false, horizontal = false;

  const start = (x, y) => { startX = x; startY = y; dx = 0; dragging = true; horizontal = false; img.style.transition = 'none'; };
  const move = (x, y) => {
    if (!dragging) return;
    const dyAbs = Math.abs(y - startY);
    dx = x - startX;
    if (!horizontal && Math.abs(dx) > 8 && Math.abs(dx) > dyAbs) horizontal = true;
    if (horizontal && $('imageViewer').dataset.mode === 'gallery' && gallery().length > 1) {
      img.style.transform = `translateX(${dx * 0.5}px)`;
    }
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (horizontal && $('imageViewer').dataset.mode === 'gallery' && gallery().length > 1 && Math.abs(dx) > 64) {
      shiftViewer(dx < 0 ? 1 : -1);
    } else {
      img.style.transition = 'transform 0.2s ease';
      img.style.transform = 'translateX(0)';
    }
  };

  viewport.addEventListener('touchstart', (e) => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  viewport.addEventListener('touchmove', (e) => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  viewport.addEventListener('touchend', end);
  viewport.addEventListener('touchcancel', end);
}

async function addPhotos(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  for (const file of files) {
    const id = await saveMedia(file);
    Store.patch((d) => { d.gallery.push({ id, favorite: false }); });
  }
  prefetchedOnce = false;
  renderGalleryCards();
  snackbar(`Added ${files.length} photo${files.length > 1 ? 's' : ''}`);
}

async function deleteCurrentFromViewer() {
  if ($('imageViewer').dataset.mode !== 'gallery') return;
  const g = gallery();
  const i = Number($('imageViewer').dataset.index);
  if (Number.isNaN(i) || !g[i]) return;
  const ok = await confirmDialog('Remove this photo? This cannot be undone.', 'Remove');
  if (!ok) return;
  const [removed] = Store.data.gallery.splice(i, 1);
  await removeMedia(removed.id);
  Store.patch((d) => {
    d.gallery = d.gallery; // already spliced above on the live reference
    if (d.currentImgIndex >= d.gallery.length) d.currentImgIndex = 0;
  });
  prefetchedOnce = false;
  closeViewer();
  renderGalleryCards();
  renderFavoritesGrid();
}

export async function renderFavoritesGrid() {
  const g = gallery();
  const favs = g.map((item, i) => ({ ...item, i })).filter((x) => x.favorite);
  const grid = $('favoritesGrid');
  const empty = $('favoritesEmpty');
  if (!favs.length) { grid.innerHTML = ''; empty.classList.remove('u-hide'); return; }
  empty.classList.add('u-hide');
  const urls = await Promise.all(favs.map((f) => mediaUrl(f.id)));
  grid.innerHTML = favs.map((f, n) => `<img class="memory-thumb" data-i="${f.i}" src="${urls[n]}" alt="Favorite photo">`).join('');
  grid.querySelectorAll('img').forEach((img) => {
    img.addEventListener('click', () => { closeModal('favoritesOverlay'); openViewerAt(Number(img.dataset.i)); });
  });
}

// ---------------------------------------------------------------------
// Gallery manager: long-pressing the "up next" card opens a full grid
// of every photo, where you can tap one to view it, or long-press to
// start multi-selecting photos to delete.
// ---------------------------------------------------------------------

async function renderGalleryManager() {
  const g = gallery();
  const grid = $('galleryManagerGrid');
  const empty = $('galleryManagerEmpty');
  exitGallerySelection();
  if (!g.length) { grid.innerHTML = ''; empty.classList.remove('u-hide'); return; }
  empty.classList.add('u-hide');
  const urls = await Promise.all(g.map((item) => mediaUrl(item.id)));
  grid.innerHTML = g.map((item, i) => `
    <div class="memory-thumb-wrap" data-i="${i}">
      <img class="memory-thumb" src="${urls[i] || ''}" alt="">
      <span class="memory-thumb-check"><svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
    </div>`).join('');
  $$('.memory-thumb-wrap', grid).forEach((wrap) => {
    on(wrap, 'click', () => {
      if (gallerySelection.size) toggleGallerySelect(wrap);
      else { closeModal('galleryManagerOverlay'); openViewerAt(Number(wrap.dataset.i)); }
    });
    onLongPress(wrap, () => toggleGallerySelect(wrap));
  });
}

function toggleGallerySelect(wrap) {
  const i = wrap.dataset.i;
  if (gallerySelection.has(i)) { gallerySelection.delete(i); wrap.classList.remove('is-selected'); }
  else { gallerySelection.add(i); wrap.classList.add('is-selected'); }
  syncGalleryActionBar();
}

function syncGalleryActionBar() {
  const bar = $('galleryManagerActionBar');
  bar.classList.toggle('u-hide', gallerySelection.size === 0);
  $('galleryManagerSelCount').textContent = `${gallerySelection.size} selected`;
}

function exitGallerySelection() {
  gallerySelection.clear();
  syncGalleryActionBar();
}

async function deleteSelectedGalleryPhotos() {
  const indices = Array.from(gallerySelection).map(Number).sort((a, b) => b - a);
  if (!indices.length) return;
  const ok = await confirmDialog(`Remove ${indices.length} photo${indices.length > 1 ? 's' : ''}? This cannot be undone.`, 'Remove');
  if (!ok) return;
  for (const i of indices) {
    const [removed] = Store.data.gallery.splice(i, 1);
    if (removed) await removeMedia(removed.id);
  }
  Store.patch((d) => {
    d.gallery = d.gallery;
    if (d.currentImgIndex >= d.gallery.length) d.currentImgIndex = 0;
  });
  prefetchedOnce = false;
  renderGalleryCards();
  renderFavoritesGrid();
  await renderGalleryManager();
  snackbar(indices.length > 1 ? 'Photos removed' : 'Photo removed');
}

export function initGallery() {
  on($('mainPhotoTapLayer'), 'click', () => openViewerAt(idx() % Math.max(gallery().length, 1)));
  on($('sidePhotoTapLayer'), 'click', next);
  onLongPress($('sidePhotoCard'), () => { renderGalleryManager(); openModal('galleryManagerOverlay'); });
  on($('galleryPrevBtn'), 'click', prev);
  on($('galleryNextBtn'), 'click', next);
  on($('likeToggle'), 'click', toggleLike);
  on($('closeImageViewerBtn'), 'click', closeViewer);
  on($('deletePhotoBtn'), 'click', deleteCurrentFromViewer);
  wireViewerSwipe();

  const addInput = $('galleryAddInput');
  on($('galleryAddBtn'), 'click', () => addInput.click());
  on(addInput, 'change', () => { addPhotos(addInput.files); addInput.value = ''; });

  on($('favoritesBtn'), 'click', () => { renderFavoritesGrid(); openModal('favoritesOverlay'); });
  on($('favoritesCloseBtn'), 'click', () => closeModal('favoritesOverlay'));

  on($('galleryManagerCloseBtn'), 'click', () => closeModal('galleryManagerOverlay'));
  on($('galleryManagerDeleteBtn'), 'click', deleteSelectedGalleryPhotos);
  on($('galleryManagerCancelSelBtn'), 'click', exitGallerySelection);

  renderGalleryCards();
  Store.subscribe(renderGalleryCards);
}
