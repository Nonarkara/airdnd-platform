/**
 * Two fingerprints per photo.
 *
 * sha256 — the bytes. Identical files collapse to one. This alone is weak for
 *   this corpus: operators re-post the same staff photos daily, and Telegram
 *   re-compresses every upload, so a re-post is a different file.
 *
 * dHash — what the picture looks like. Downscale to 9×8 greyscale and record,
 *   for each row, whether each pixel is brighter than its right neighbour: 64
 *   bits that survive re-compression, resizing and small colour shifts. Two
 *   photos within a few bits of each other are the same picture.
 *
 * Pure JavaScript (jpeg-js) so it runs on any machine with no native build.
 */

import crypto from 'node:crypto';
import jpeg from 'jpeg-js';

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function isJpeg(buffer) {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/** Area-average an RGBA image down to w×h greyscale (Rec. 601 luma). */
function downscaleGrey({ width, height, data }, w, h) {
  const out = new Float64Array(w * h);
  for (let ty = 0; ty < h; ty += 1) {
    const y0 = Math.floor((ty * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * height) / h));
    for (let tx = 0; tx < w; tx += 1) {
      const x0 = Math.floor((tx * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * width) / w));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          n += 1;
        }
      }
      out[ty * w + tx] = sum / n;
    }
  }
  return out;
}

/** 64-bit difference hash as 16 hex characters, from decoded RGBA pixels. */
export function dHashFromPixels(image) {
  const grey = downscaleGrey(image, 9, 8);
  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      bits += grey[y * 9 + x] > grey[y * 9 + x + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** dHash of a JPEG buffer, or null when it cannot be decoded. */
export function dHashJpeg(buffer) {
  if (!isJpeg(buffer)) return null;
  try {
    // maxMemoryUsageInMB guards against a malformed header claiming a huge image.
    const image = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
    return { hash: dHashFromPixels(image), width: image.width, height: image.height };
  } catch {
    return null;
  }
}

const POP = new Uint8Array(16).map((_, i) => ((i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1)));

export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < 16; i += 1) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)];
  return d;
}

/**
 * Group photos that are the same picture.
 *
 * Exact duplicates (same sha256) first; then near duplicates (dHash within
 * `threshold` bits). Candidate pairs come from 8 bands of 8 bits: two hashes
 * within 7 bits must agree exactly on at least one band (pigeonhole), so no
 * all-pairs comparison is needed and nothing within the threshold is missed.
 *
 * @param {Array<{key:string, sha:string, dhash?:string|null, bytes:number}>} photos
 * @returns {Map<string,string>} photo key → the key of its cluster's canonical
 *   photo (the largest file, i.e. the least-compressed copy).
 */
export function clusterPhotos(photos, { threshold = 6 } = {}) {
  if (threshold > 7) throw new Error('threshold above 7 breaks the banding guarantee');
  const parent = new Map(photos.map((p) => [p.key, p.key]));
  const find = (k) => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = k;
    while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  const bySha = new Map();
  for (const p of photos) {
    if (bySha.has(p.sha)) union(p.key, bySha.get(p.sha));
    else bySha.set(p.sha, p.key);
  }

  const hashed = photos.filter((p) => p.dhash);
  const bands = Array.from({ length: 8 }, () => new Map());
  for (const p of hashed) {
    for (let b = 0; b < 8; b += 1) {
      const band = p.dhash.slice(b * 2, b * 2 + 2);
      const bucket = bands[b].get(band) || [];
      for (const other of bucket) {
        if (find(other.key) !== find(p.key) && hamming(other.dhash, p.dhash) <= threshold) union(other.key, p.key);
      }
      bucket.push(p);
      bands[b].set(band, bucket);
    }
  }

  const best = new Map();
  for (const p of photos) {
    const root = find(p.key);
    const current = best.get(root);
    if (!current || p.bytes > current.bytes || (p.bytes === current.bytes && p.key < current.key)) best.set(root, p);
  }
  return new Map(photos.map((p) => [p.key, best.get(find(p.key)).key]));
}
