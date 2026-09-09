// gallery.js — the two photo cards on the home screen, the
// full-screen image viewer, favoriting, and adding/removing photos.
//
// iOS fix: the full-screen viewer (#imageViewer) is a `.surface`, so
// it inherits the `position:fixed; inset:0` rule from base.css
// instead of the old `width:100vw;height:100vh` — that mismatch
// between vw/vh and the real visual viewport was the "screen shrinks
// when you tap a photo" bug.

import { $, on, openModal, closeModal, confirmDialog, snackbar } from '../core/dom.js';
import { Store } from '../core/state.js';
import { mediaUrl, saveMedia, removeMedia } from '../services/media.service.js';

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
 *  control is shown, since there's no gallery index to remove. */
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

async function addPhotos(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  for (const file of files) {
    const id = await saveMedia(file);
    Store.patch((d) => { d.gallery.push({ id, favorite: false }); });
  }
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

export function initGallery() {
  on($('mainPhotoTapLayer'), 'click', () => openViewerAt(idx() % Math.max(gallery().length, 1)));
  on($('sidePhotoTapLayer'), 'click', next);
  on($('galleryPrevBtn'), 'click', prev);
  on($('galleryNextBtn'), 'click', next);
  on($('likeToggle'), 'click', toggleLike);
  on($('closeImageViewerBtn'), 'click', closeViewer);
  on($('deletePhotoBtn'), 'click', deleteCurrentFromViewer);

  const addInput = $('galleryAddInput');
  on($('galleryAddBtn'), 'click', () => addInput.click());
  on(addInput, 'change', () => { addPhotos(addInput.files); addInput.value = ''; });

  on($('favoritesBtn'), 'click', () => { renderFavoritesGrid(); openModal('favoritesOverlay'); });
  on($('favoritesCloseBtn'), 'click', () => closeModal('favoritesOverlay'));

  renderGalleryCards();
  Store.subscribe(renderGalleryCards);
}
