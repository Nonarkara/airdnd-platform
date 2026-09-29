#!/usr/bin/env node
/**
 * Publish every unique, screened photo to Cloudflare R2 and point the site at it.
 *
 *   node scripts/publish_photos.js                         # dry run: report only
 *   node scripts/publish_photos.js --upload                # upload + write the photo map
 *   node scripts/publish_photos.js --archive <dir> …       # extra archive folders
 *
 * Why R2, not the site itself: Cloudflare Pages accepts 20,000 files per
 * deployment and the archive holds ~58,000 photos, so the site has shipped a
 * pruned handful while the full galleries loaded straight from Supabase
 * Storage — the thing being switched off. R2 sits on the same Cloudflare
 * account, charges nothing for downloads, and holds 10 GB free.
 *
 * What "unique" means here: one copy per picture. Identical files collapse by
 * sha256; re-posts that Telegram re-compressed collapse by perceptual
 * fingerprint (scripts/lib/photo_hash.js). The largest copy is kept.
 *
 * What gets published — the project's own rule, "collect everything, display
 * only safe content" (CLAUDE.md):
 *   publish   the picture appears on at least one listing or feed card whose
 *             media passes the directory's safety screen, and on none that fails;
 *   withheld  it appears on a listing whose media is screened out;
 *   archive   it appears on no listing at all — nothing has screened it, so it
 *             stays in the archive (and the Supabase export) unpublished.
 *
 * Objects are content-addressed (photos/<sha256>.jpg) and immutable, so runs
 * are idempotent and re-runs upload only new pictures. A ledger in
 * data/photo_ledger.json remembers every file's fingerprint, so only new or
 * changed files are decoded again.
 *
 * Environment (.env): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET, PHOTO_PUBLIC_BASE_URL (the bucket's public URL, e.g.
 * https://photos.nonarkara.org); optional R2_ENDPOINT.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';

import { clusterPhotos, dHashJpeg, isJpeg, sha256 } from './lib/photo_hash.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
export const LEDGER_PATH = process.env.PHOTO_LEDGER_PATH || path.join(ROOT, 'data', 'photo_ledger.json');
export const MAP_PATH = process.env.PHOTO_MAP_PATH || path.join(ROOT, 'data', 'photo_map.json');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

// ── worker: fingerprint one file ─────────────────────────────────────────────
if (!isMainThread) {
  parentPort.on('message', ({ file }) => {
    try {
      const buf = fs.readFileSync(file);
      const d = isJpeg(buf) ? dHashJpeg(buf) : null;
      parentPort.postMessage({ file, sha: sha256(buf), dhash: d?.hash || null, width: d?.width || null, height: d?.height || null, jpeg: isJpeg(buf) });
    } catch (error) {
      parentPort.postMessage({ file, error: error.message });
    }
  });
}

// ── pure planning ────────────────────────────────────────────────────────────

export function basenameOf(url) {
  const clean = String(url || '').split(/[?#]/)[0];
  try { return decodeURIComponent(path.posix.basename(clean)); } catch { return path.posix.basename(clean); }
}

/**
 * @param {object} args
 * @param {Array<{key:string,sha:string,dhash:?string,bytes:number}>} args.photos  key = file name
 * @param {Array<{urls:string[], safe:boolean}>} args.references  one per listing / feed card
 */
export function planPublication({ photos, references, threshold = 6 }) {
  const canonical = clusterPhotos(photos, { threshold });
  const refs = new Map();
  const known = new Set(photos.map((p) => p.key));
  let missing = 0;
  for (const { urls, safe } of references) {
    for (const url of urls) {
      const name = basenameOf(url);
      if (!known.has(name)) { missing += 1; continue; }
      const r = refs.get(name) || { safe: 0, unsafe: 0 };
      r[safe ? 'safe' : 'unsafe'] += 1;
      refs.set(name, r);
    }
  }

  const clusters = new Map();
  for (const p of photos) {
    const root = canonical.get(p.key);
    const c = clusters.get(root) || { canonical: root, members: [], safe: 0, unsafe: 0 };
    c.members.push(p.key);
    const r = refs.get(p.key);
    if (r) { c.safe += r.safe; c.unsafe += r.unsafe; }
    clusters.set(root, c);
  }
  for (const c of clusters.values()) {
    c.status = c.unsafe > 0 ? 'withheld' : c.safe > 0 ? 'publish' : 'archive';
  }

  const list = [...clusters.values()];
  const count = (status) => list.filter((c) => c.status === status).length;
  return {
    canonical,
    clusters: list,
    stats: {
      files: photos.length,
      uniquePictures: list.length,
      duplicatesCollapsed: photos.length - list.length,
      publish: count('publish'),
      withheld: count('withheld'),
      archiveOnly: count('archive'),
      referencesToMissingFiles: missing,
    },
  };
}

// ── IO ───────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (IMAGE_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function saveJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(value));
  fs.renameSync(`${file}.tmp`, file);
}

async function fingerprintAll(files, ledger, log) {
  const todo = files.filter((f) => {
    const st = fs.statSync(f);
    const entry = ledger.files[f];
    return !entry || entry.size !== st.size || entry.mtimeMs !== st.mtimeMs;
  });
  if (todo.length === 0) return;
  const size = Math.max(1, Math.min(os.cpus().length - 1, 12));
  const workers = Array.from({ length: size }, () => new Worker(__filename));
  let next = 0;
  let done = 0;
  await new Promise((resolve) => {
    const feed = (w) => {
      if (next >= todo.length) { w.terminate(); if (done === todo.length) resolve(); return; }
      w.postMessage({ file: todo[next] });
      next += 1;
    };
    for (const w of workers) {
      w.on('message', (m) => {
        const st = fs.statSync(m.file);
        ledger.files[m.file] = m.error
          ? { size: st.size, mtimeMs: st.mtimeMs, error: m.error }
          : { size: st.size, mtimeMs: st.mtimeMs, sha: m.sha, dhash: m.dhash, width: m.width, height: m.height, jpeg: m.jpeg };
        done += 1;
        if (done % 500 === 0 || done === todo.length) { log(`fingerprinted ${done}/${todo.length}`); saveJson(LEDGER_PATH, ledger); }
        if (done === todo.length) resolve();
        feed(w);
      });
      feed(w);
    }
  });
  await Promise.all(workers.map((w) => w.terminate()));
}

async function loadReferences() {
  const { openDataClient } = await import('./lib/data_store.js');
  const { canonicalizePublicListings } = await import('../src/lib/listing_contract.js');
  const { getListingGalleryUrls, isListingMediaSafe } = await import('../src/lib/listings.js');
  const client = await openDataClient('publish_photos');
  const { data, error } = await client.from('companions').select('*').limit(10000);
  if (error) throw new Error(`companions: ${error.message}`);
  const listings = canonicalizePublicListings(data || [], { source: 'snapshot', allowUnverified: true });
  const refs = listings.map((l) => ({ urls: getListingGalleryUrls(l), safe: isListingMediaSafe(l) }));
  const feed = loadJson(path.join(ROOT, 'public', 'feed.json'), []);
  const cards = Array.isArray(feed) ? feed : (feed.cards || []);
  for (const card of cards) refs.push({ urls: card.photoUrls || [], safe: isListingMediaSafe(card) });
  return refs;
}

async function main() {
  const argv = process.argv.slice(2);
  const upload = argv.includes('--upload');
  // --only-archive: use just the folders given, not the Mac's default archive.
  const archives = argv.includes('--only-archive') ? [] : [path.join(ROOT, 'public', 'images')];
  argv.forEach((a, i) => { if (a === '--archive' && argv[i + 1]) archives.push(path.resolve(argv[i + 1])); });

  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
  const log = (line) => process.stdout.write(`\r${line.padEnd(64)}`);

  const files = [...new Set(archives.flatMap((dir) => walk(dir)))];
  console.log(`${files.length} photo files in ${archives.length} archive folder(s)`);
  const ledger = loadJson(LEDGER_PATH, { version: 1, files: {}, uploaded: {} });
  await fingerprintAll(files, ledger, log);
  process.stdout.write('\n');
  saveJson(LEDGER_PATH, ledger);

  // One entry per file name: the same stored file can sit in several archive
  // folders (Mac archive, Supabase export). Keep the largest.
  const byName = new Map();
  for (const file of files) {
    const e = ledger.files[file];
    if (!e || e.error) continue;
    const key = path.basename(file);
    const prev = byName.get(key);
    if (!prev || e.size > prev.bytes) byName.set(key, { key, file, sha: e.sha, dhash: e.dhash, bytes: e.size, jpeg: e.jpeg });
  }
  const photos = [...byName.values()];
  const plan = planPublication({ photos, references: await loadReferences() });
  const s = plan.stats;
  console.log(`\nfiles ${s.files} → unique pictures ${s.uniquePictures} (${s.duplicatesCollapsed} duplicates collapsed)`);
  console.log(`publish ${s.publish} · withheld by safety screen ${s.withheld} · archive only (on no listing) ${s.archiveOnly}`);
  if (s.referencesToMissingFiles) console.log(`${s.referencesToMissingFiles} listing photo links point at files not in these folders — add the Supabase export with --archive`);

  if (!upload) {
    console.log('\nDry run — nothing uploaded. Re-run with --upload to publish.');
    return;
  }

  const baseUrl = String(process.env.PHOTO_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) throw new Error('set PHOTO_PUBLIC_BASE_URL (the R2 bucket\'s public URL) in .env');
  const { createR2Client } = await import('./lib/r2_client.js');
  const r2 = createR2Client({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT || undefined, // e.g. an EU-jurisdiction endpoint
  });

  const publish = plan.clusters.filter((c) => c.status === 'publish');
  const objectKey = (photo) => `photos/${photo.sha}${photo.jpeg ? '.jpg' : path.extname(photo.key).toLowerCase()}`;
  const contentType = (photo) => (photo.jpeg ? 'image/jpeg' : { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' }[path.extname(photo.key).toLowerCase()] || 'application/octet-stream');
  const failed = [];
  let uploaded = 0;
  let skipped = 0;
  const queue = [...publish];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const photo = byName.get(c.canonical);
      const key = objectKey(photo);
      try {
        if (ledger.uploaded[key] || await r2.exists(key)) {
          skipped += 1;
        } else {
          await r2.put(key, fs.readFileSync(photo.file), {
            contentType: contentType(photo),
            cacheControl: 'public, max-age=31536000, immutable',
          });
          uploaded += 1;
        }
        ledger.uploaded[key] = true;
      } catch (error) {
        failed.push({ key, reason: error.message });
      }
      const n = uploaded + skipped + failed.length;
      if (n % 100 === 0 || n === publish.length) { log(`uploaded ${uploaded} · already there ${skipped} · failed ${failed.length} / ${publish.length}`); saveJson(LEDGER_PATH, ledger); }
    }
  }));
  process.stdout.write('\n');
  saveJson(LEDGER_PATH, ledger);

  // The map names only objects confirmed in the bucket, so the site never links
  // to a photo that is not there.
  const map = {};
  for (const c of publish) {
    const photo = byName.get(c.canonical);
    const key = objectKey(photo);
    if (!ledger.uploaded[key]) continue;
    for (const member of c.members) map[member] = `${baseUrl}/${key}`;
  }
  saveJson(MAP_PATH, { version: 1, generatedAt: new Date().toISOString(), baseUrl, stats: s, map });
  console.log(`photo map: ${Object.keys(map).length} file names → ${publish.length - failed.length} published pictures (${path.relative(ROOT, MAP_PATH)})`);
  if (failed.length) {
    console.log(`${failed.length} uploads failed — run the same command again to retry. First: ${failed[0].key}: ${failed[0].reason}`);
    process.exitCode = 1;
  } else {
    console.log('COMPLETE — refresh the snapshot / Firestore sync to put the new links on the site.');
  }
}

if (isMainThread && process.argv[1] === __filename) {
  main().catch((error) => { console.error(`\n${error.message}`); process.exit(1); });
}
