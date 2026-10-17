#!/usr/bin/env node
/**
 * sync_media.js — publish every photo the public snapshots reference to the
 * free `airdnd-media` Cloudflare Pages project (https://airdnd-media.pages.dev).
 *
 * Photo files live on the M3 only:
 *   1. PHOTO_ROOT (default /Volumes/Data/AirDnD/photos) — written by the intake
 *      (scripts/photo_storage.js → <root>/listing-photos/telegram/...)
 *   2. MEDIA_EXPORT_DIR (default the verified 2026-10-16 Supabase Storage export)
 *
 * The media site is rebuilt in MEDIA_BUILD_DIR with ONLY the referenced files
 * (Pages free tier: 20,000 files, 25 MiB each), then deployed with wrangler.
 * Wrangler uploads only changed files, so repeat runs are cheap. A manifest
 * hash skips the deploy entirely when nothing changed.
 *
 * Usage: node scripts/sync_media.js [--dry-run] [--force]
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHOTO_ROOT = process.env.PHOTO_ROOT || '/Volumes/Data/AirDnD/photos';
const EXPORT_DIR = process.env.MEDIA_EXPORT_DIR || '/Volumes/Data/AirDnD/exports/storage-20261016-1121/objects';
const BUILD_DIR = process.env.MEDIA_BUILD_DIR || '/Volumes/Data/AirDnD/media-build/site';
const PROJECT = process.env.MEDIA_PAGES_PROJECT || 'airdnd-media';
const MEDIA_PREFIX = 'https://airdnd-media.pages.dev/';
const MAX_FILES = 19_500;
const MAX_BYTES = 25 * 1024 * 1024;
const DRY = process.argv.includes('--dry-run');
const PRUNE = process.argv.includes('--prune-snapshots');
// While the legacy bucket still answers, pull referenced photos that exist
// nowhere on the M3 into PHOTO_ROOT so they survive the Supabase shutdown.
const LEGACY_BASE = process.env.LEGACY_STORAGE_BASE || 'https://fehdtfncbutesgadjsxp.supabase.co/storage/v1/object/public/';
const FORCE = process.argv.includes('--force');

function walkJson(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return ['images', 'mockups', 'og', 'heroes'].includes(e.name) ? [] : walkJson(full);
    return e.name.endsWith('.json') ? [full] : [];
  });
}

const keys = new Set();
const pattern = /https:\/\/airdnd-media\.pages\.dev\/([^"\\\s?#]+)/g;
for (const file of walkJson(path.join(ROOT, 'public'))) {
  for (const m of fs.readFileSync(file, 'utf8').matchAll(pattern)) keys.add(decodeURIComponent(m[1]));
}
if (keys.size > MAX_FILES) {
  console.error(`✖ ${keys.size} referenced photos exceeds the ${MAX_FILES} Pages file budget — trim the snapshot first.`);
  process.exit(1);
}

async function fetchLegacy(key) {
  if (DRY || !LEGACY_BASE) return null;
  try {
    const res = await fetch(LEGACY_BASE + key.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const dest = path.join(PHOTO_ROOT, key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return dest;
  } catch {
    return null;
  }
}

const missing = [];
const tooBig = [];
const wanted = new Map();
let fetched = 0;
for (const key of keys) {
  if (key.includes('..')) continue;
  let source = [path.join(PHOTO_ROOT, key), path.join(EXPORT_DIR, key)].find((p) => fs.existsSync(p));
  if (!source) { source = await fetchLegacy(key); if (source) fetched += 1; }
  if (!source) { missing.push(key); continue; }
  if (fs.statSync(source).size > MAX_BYTES) { tooBig.push(key); continue; }
  wanted.set(key, source);
}

const manifest = crypto.createHash('sha256')
  .update([...wanted.keys()].sort().map((k) => `${k}:${fs.statSync(wanted.get(k)).size}`).join('\n'))
  .digest('hex');
const manifestFile = path.join(path.dirname(BUILD_DIR), '.media-manifest');
const previous = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8').trim() : '';

console.log(`media: ${keys.size} referenced · ${wanted.size} available (${fetched} rescued from legacy bucket) · ${missing.length} missing · ${tooBig.length} over 25 MiB`);

// --prune-snapshots: drop photo URLs we cannot serve, so the site never shows
// a broken image; a listing whose hero is gone falls back to its next photo.
const unavailable = new Set([...missing, ...tooBig].map((k) => MEDIA_PREFIX + k));
if (PRUNE && unavailable.size && !DRY) {
  const prune = (value) => {
    if (Array.isArray(value)) return value.filter((v) => !(typeof v === 'string' && unavailable.has(v))).map(prune);
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = typeof v === 'string' && unavailable.has(v) ? null : prune(v);
      if ('imageUrl' in out && !out.imageUrl && Array.isArray(out.allPhotoUrls) && out.allPhotoUrls.length) out.imageUrl = out.allPhotoUrls[0];
      return out;
    }
    return value;
  };
  for (const name of ['data.json', 'feed.json']) {
    const file = path.join(ROOT, 'public', name);
    const pretty = name === 'data.json' ? 2 : 0;
    fs.writeFileSync(file, JSON.stringify(prune(JSON.parse(fs.readFileSync(file, 'utf8'))), null, pretty));
  }
  // Place galleries: drop unservable photos from each shard and the index samples.
  const galleryDir = path.join(ROOT, 'public', 'data', 'place_photos');
  const galleryFiles = fs.existsSync(galleryDir) ? fs.readdirSync(galleryDir).filter((f) => f.endsWith('.json')).map((f) => path.join(galleryDir, f)) : [];
  for (const file of galleryFiles) {
    const shard = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(shard.photos)) continue;
    shard.photos = shard.photos.filter((p) => !unavailable.has(p.url));
    shard.photoCount = shard.photos.length;
    fs.writeFileSync(file, JSON.stringify(shard));
  }
  const indexFile = path.join(ROOT, 'public', 'data', 'place_photos_index.json');
  if (fs.existsSync(indexFile)) {
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    for (const v of index.venues || []) if (Array.isArray(v.sample)) v.sample = v.sample.filter((u) => !unavailable.has(u));
    fs.writeFileSync(indexFile, JSON.stringify(index));
  }
  console.log(`media: pruned ${unavailable.size} unavailable photo URL(s) from data.json/feed.json/place galleries`);
}
if (missing.length) console.log(`  missing (first 5): ${missing.slice(0, 5).join(', ')}`);
if (manifest === previous && !FORCE) {
  console.log('media: unchanged since last deploy — skipping');
  process.exit(0);
}
if (DRY) process.exit(0);

fs.rmSync(BUILD_DIR, { recursive: true, force: true });
for (const [key, source] of wanted) {
  const dest = path.join(BUILD_DIR, key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try { fs.linkSync(source, dest); } catch { fs.copyFileSync(source, dest); }
}
fs.writeFileSync(path.join(BUILD_DIR, '_headers'),
  '/*\n  Access-Control-Allow-Origin: *\n  Cache-Control: public, max-age=31536000, immutable\n');

execFileSync('npx', ['wrangler', 'pages', 'deploy', BUILD_DIR, '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true'],
  { cwd: path.dirname(BUILD_DIR), stdio: 'inherit' });
fs.writeFileSync(manifestFile, manifest + '\n');
console.log(`media: deployed ${wanted.size} files to ${MEDIA_PREFIX}`);
