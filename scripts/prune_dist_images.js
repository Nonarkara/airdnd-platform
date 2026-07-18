/**
 * prune_dist_images.js — keep dist/images under the Cloudflare Pages 20k-file
 * limit by shipping only images the deployed frontend can actually display:
 * per unique business (phone-deduped), the hero image plus the first
 * GALLERY_CAP gallery photos, from both the Firestore export (if present in
 * the scratch path or passed as argv[2]) and public/data.json.
 *
 * The /images/ folder is a *fallback cache* (used when Supabase Storage is
 * down) — partial coverage is by design; full archive stays in public/images
 * locally and is never deployed.
 *
 * Usage: node scripts/prune_dist_images.js [firestore_export.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_IMAGES = path.join(__dirname, '..', 'dist', 'images');
const DATA_JSON = path.join(__dirname, '..', 'public', 'data.json');
const GALLERY_CAP = 8;

const keep = new Set();
const base = (u) => (typeof u === 'string' && u ? u.split('/').pop() : null);

function addListing(l) {
  const hero = base(l.imageUrl || l.image_url);
  if (hero) keep.add(hero);
  const gallery = l.allPhotoUrls || l.photo_urls || [];
  // Newest-first so the fallback cache matches what the gallery shows first
  [...gallery].reverse().slice(0, GALLERY_CAP).forEach((u) => {
    const b = base(u);
    if (b) keep.add(b);
  });
}

function dedupeByPhone(listings) {
  const seen = new Set();
  const out = [];
  for (const l of listings) {
    const p = String(l.phone || '').replace(/\D/g, '');
    if (p) {
      if (seen.has(p)) { out.push({ imageUrl: l.imageUrl || l.image_url }); continue; }
      seen.add(p);
    }
    out.push(l);
  }
  return out;
}

// Snapshot listings
try {
  const snap = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const rows = Array.isArray(snap) ? snap : snap.companions || [];
  dedupeByPhone(rows).forEach(addListing);
} catch { /* no snapshot */ }

// Optional Firestore export (newest docs first is not guaranteed — cap total)
const exportPath = process.argv[2];
if (exportPath && fs.existsSync(exportPath)) {
  try {
    const docs = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    docs.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    dedupeByPhone(docs).forEach(addListing);
  } catch { /* ignore malformed export */ }
}

if (!fs.existsSync(DIST_IMAGES)) {
  console.log('[prune-images] dist/images not found — nothing to prune');
  process.exit(0);
}

let kept = 0;
let removed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p);
      if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
    } else if (keep.has(entry.name)) {
      kept += 1;
    } else {
      fs.rmSync(p);
      removed += 1;
    }
  }
}
walk(DIST_IMAGES);
console.log(`[prune-images] keep-list ${keep.size} · kept ${kept} · removed ${removed}`);
