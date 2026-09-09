// media.service.js — stores photos/audio/wallpapers as native Blobs
// and hands back cheap, cached object URLs for <img>/<audio> sources.
//
// iOS fix: the old app stored every image and song as a base64 string
// glued into one JSON document. Base64 inflates binary data by ~33%
// and forces the whole document to be re-parsed/re-stringified on
// every save. Storing native Blobs, one per key, avoids both costs
// and is the storage pattern IndexedDB is actually designed for.

import { mediaStore } from './db.js';
import { uid } from '../core/utils.js';

const urlCache = new Map(); // mediaId -> object URL, created lazily

/** Save a File/Blob under a fresh id. Returns the id. */
export async function saveMedia(blob) {
  const id = uid();
  await mediaStore.setItem(id, blob);
  return id;
}

/** Store a Blob under a *specific* id — used only by backup restore,
 *  where the id must match what's already referenced in the restored
 *  appData JSON. */
export async function putMediaWithId(id, blob) {
  await mediaStore.setItem(id, blob);
  revokeUrl(id);
}

/** Replace the blob at an existing id (keeps references like gallery order intact). */
export async function replaceMedia(id, blob) {
  await mediaStore.setItem(id, blob);
  revokeUrl(id);
}

/** Get a usable <img>/<audio> src for a stored media id (or null). */
export async function mediaUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const blob = await mediaStore.getItem(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function getMediaBlob(id) {
  if (!id) return null;
  return mediaStore.getItem(id);
}

export async function removeMedia(id) {
  if (!id) return;
  revokeUrl(id);
  await mediaStore.removeItem(id);
}

function revokeUrl(id) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** Best-effort ID3 album art extraction. Works directly on the Blob —
 *  no base64 round-trip needed (jsmediatags accepts Blob/File input). */
export function extractAlbumArt(blob) {
  return new Promise((resolve) => {
    if (typeof jsmediatags === 'undefined') { resolve(null); return; }
    try {
      jsmediatags.read(blob, {
        onSuccess: (tag) => {
          const picture = tag?.tags?.picture;
          if (!picture) { resolve(null); return; }
          const bytes = new Uint8Array(picture.data);
          const artBlob = new Blob([bytes], { type: picture.format || 'image/jpeg' });
          resolve(artBlob);
        },
        onError: () => resolve(null),
      });
    } catch {
      resolve(null);
    }
  });
}
