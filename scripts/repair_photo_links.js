#!/usr/bin/env node
/**
 * Recover the listing↔photo mapping that a snapshot refresh destroyed.
 *
 * ── What broke ──────────────────────────────────────────────────────────────
 *
 * `public/data.json` used to carry an `allPhotoUrls` array per listing — 19,204
 * photo references at commit cdd716c, 18,731 at db69658. The very next refresh
 * (eba339b) wrote 96. The field did not shrink; it vanished, because
 * `refresh_public_snapshot.js` maps only `imageUrl` and silently drops every
 * photo array on the floor. Every refresh since has re-destroyed it.
 *
 * The damage compounded through the build. The vite prune plugin keeps only
 * images that data.json references; seeing 16 resolvable URLs it deleted 2,924
 * of 2,940 photos from `dist/`. The deployed site shipped **16 photos out of
 * 2,940 — half a percent** — which is exactly the symptom reported.
 *
 * Worse, the surviving `imageUrl` values had drifted to a nested
 * `/images/{channel}/{date}/{file}` shape while the files on disk are flat
 * `/images/{file}`, so 90 of 106 hero images were dead links too.
 *
 * ── How this recovers it, without inventing anything ────────────────────────
 *
 * The mapping is not lost, it is in git. Historical snapshots carry both the
 * photo arrays and the listing identity, so this reads them back out of the
 * object store, keys them by identity, and re-attaches.
 *
 * Identity is PHONE FIRST. This project has already learned once that keying
 * listings on anything weaker silently merges distinct businesses and loses
 * real ones (tasks/lessons.md · 2026-08-04): one phone number is one business,
 * regardless of the name a given post used. Canonical key and normalised name
 * are fallbacks, in that order, and a name match additionally requires the same
 * source channel so two unrelated shops sharing a common Thai name cannot swap
 * photographs.
 *
 * Only photos that actually exist on disk are attached. A recovered URL whose
 * file is gone is dropped rather than shipped as a broken <img>.
 *
 * Offline and deterministic. No Supabase, no Telegram, no network.
 *
 *   node scripts/repair_photo_links.js --dry-run
 *   node scripts/repair_photo_links.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const SNAPSHOT = path.join(ROOT, 'public/data.json');
const FEED = path.join(ROOT, 'public/feed.json');

/**
 * Snapshots to mine, newest first. Both are pre-regression and carry
 * `allPhotoUrls`; merging them maximises recovered coverage.
 */
const SOURCE_COMMITS = ['db69658', 'cdd716c', 'b820f26'];

const PHOTO_FIELDS = ['allPhotoUrls', 'photoUrls', 'photo_urls', 'drivePhotoUrls'];
/**
 * A sanity bound, not a display budget. A parlour posting daily for months
 * legitimately accumulates hundreds of photographs, and capping at a tidy-
 * looking number silently discards real data — a 60-photo cap alone held
 * recovery down to 51% when 98% was available. The UI paginates instead.
 */
const MAX_PHOTOS_PER_LISTING = 500;

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const local = digits.startsWith('66') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
  if (local.length < 9 || local.length > 10 || !local.startsWith('0')) return '';
  if (/^0(\d)\1{7,}$/.test(local)) return '';
  return local;
}

export function nameKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^(ร้าน|กลุ่ม)\s*/g, '')
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/** Identity keys for a listing, strongest first. */
export function identityKeys(listing) {
  const keys = [];
  const phone = normalizePhone(listing?.phone);
  if (phone) keys.push(`tel:${phone}`);
  if (listing?.canonicalKey) keys.push(`can:${listing.canonicalKey}`);
  const name = nameKey(listing?.name);
  const channel = String(listing?.sourceChannel ?? '').replace(/^@/, '');
  // Name alone is not identity: it is scoped to the channel that posted it.
  if (name && channel) keys.push(`nm:${name}@${channel}`);
  return keys;
}

export function indexDiskPhotos(dir = IMAGES_DIR) {
  const byBasename = new Map();
  if (!fs.existsSync(dir)) return byBasename;
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
      if (!byBasename.has(entry.name)) {
        byBasename.set(entry.name, `/images/${path.relative(dir, full).split(path.sep).join('/')}`);
      }
    }
  };
  walk(dir);
  return byBasename;
}

function readCommitSnapshot(commit) {
  try {
    const text = execSync(`git show ${commit}:public/data.json`, {
      encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, cwd: ROOT,
    });
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** identity key -> ordered, de-duplicated list of photo basenames. */
export function buildPhotoLedger(snapshots) {
  const ledger = new Map();

  for (const listings of snapshots) {
    for (const listing of listings) {
      const urls = [];
      if (listing.imageUrl) urls.push(listing.imageUrl);
      for (const field of PHOTO_FIELDS) {
        if (Array.isArray(listing[field])) urls.push(...listing[field]);
      }
      if (urls.length === 0) continue;

      const basenames = urls.filter(Boolean).map((u) => path.basename(String(u)));
      for (const key of identityKeys(listing)) {
        if (!ledger.has(key)) ledger.set(key, []);
        const bucket = ledger.get(key);
        for (const basename of basenames) if (!bucket.includes(basename)) bucket.push(basename);
      }
    }
  }

  return ledger;
}

export function repair(listings, ledger, diskIndex) {
  const stats = {
    listings: listings.length,
    matchedBy: { tel: 0, can: 0, nm: 0, none: 0 },
    heroRepaired: 0, heroKept: 0, heroLost: 0,
    photosAttached: 0, recoveredButMissingOnDisk: 0,
  };
  const reachable = new Set();

  const repaired = listings.map((listing) => {
    const keys = identityKeys(listing);
    // Union every identity this listing can support, rather than stopping at
    // the strongest. A listing that matches on phone may ALSO carry photos
    // filed under a canonical key from an earlier snapshot generation, and
    // breaking on the first hit throws those away.
    const recovered = [];
    let basis = 'none';

    for (const key of keys) {
      const hit = ledger.get(key);
      if (!hit || hit.length === 0) continue;
      if (basis === 'none') basis = key.slice(0, 3);
      for (const basename of hit) if (!recovered.includes(basename)) recovered.push(basename);
    }
    stats.matchedBy[basis] = (stats.matchedBy[basis] ?? 0) + 1;

    // The listing's own current hero, if its file is still present.
    const currentHero = listing.imageUrl ? diskIndex.get(path.basename(listing.imageUrl)) : null;

    const urls = [];
    if (currentHero) urls.push(currentHero);
    for (const basename of recovered) {
      const onDisk = diskIndex.get(basename);
      if (!onDisk) { stats.recoveredButMissingOnDisk += 1; continue; }
      if (!urls.includes(onDisk)) urls.push(onDisk);
    }

    const photoUrls = urls.slice(0, MAX_PHOTOS_PER_LISTING);
    for (const url of photoUrls) reachable.add(url);
    stats.photosAttached += photoUrls.length;

    if (currentHero) stats.heroKept += 1;
    else if (photoUrls.length) stats.heroRepaired += 1;
    else stats.heroLost += 1;

    return {
      ...listing,
      // A dead link is worse than an absent one: a broken <img> is a visible
      // defect, a null is a handled state the components already render.
      imageUrl: photoUrls[0] ?? null,
      photoUrls,
      photoCount: photoUrls.length,
    };
  });

  return { repaired, stats, reachable };
}

function main() {
  if (!fs.existsSync(SNAPSHOT)) {
    console.error('[repair] public/data.json not found');
    process.exitCode = 1;
    return;
  }

  const listings = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const diskIndex = indexDiskPhotos();
  console.log(`[repair] ${diskIndex.size} photo files on disk`);

  const snapshots = [];
  for (const commit of SOURCE_COMMITS) {
    const snapshot = readCommitSnapshot(commit);
    if (!snapshot) { console.warn(`[repair] could not read ${commit}:public/data.json — skipping`); continue; }
    const refs = snapshot.reduce((n, l) => n + PHOTO_FIELDS.reduce((m, f) => m + (l[f]?.length ?? 0), 0), 0);
    console.log(`[repair] mined ${commit}: ${snapshot.length} listings, ${refs} photo references`);
    snapshots.push(snapshot);
  }

  if (snapshots.length === 0) {
    console.error('[repair] no historical snapshot could be read; nothing to recover from');
    process.exitCode = 1;
    return;
  }

  const ledger = buildPhotoLedger(snapshots);
  const before = listings.filter((l) => l.imageUrl && diskIndex.has(path.basename(l.imageUrl))).length;
  const { repaired, stats, reachable } = repair(listings, ledger, diskIndex);

  console.log(`[repair] identity ledger: ${ledger.size} keys`);
  console.log(`[repair] matched by — phone ${stats.matchedBy.tel}, canonical ${stats.matchedBy.can}, name+channel ${stats.matchedBy.nm}, unmatched ${stats.matchedBy.none}`);
  console.log(`[repair] heroes — ${stats.heroKept} still valid, ${stats.heroRepaired} restored, ${stats.heroLost} with no photo on disk`);
  console.log(`[repair] ${stats.recoveredButMissingOnDisk} recovered references had no file on disk and were dropped`);
  console.log(`[repair] photos reachable from data.json: ${reachable.size} of ${diskIndex.size} (${((reachable.size / diskIndex.size) * 100).toFixed(1)}%) — was ${before}`);

  if (dryRun) { console.log('[repair] --dry-run: nothing written'); return; }

  fs.writeFileSync(SNAPSHOT, JSON.stringify(repaired, null, 2));
  console.log('[repair] wrote public/data.json');

  repairFeed(ledger, diskIndex);
}

/**
 * The LIVE feed is a separate artefact with the same disease: 81 of its 97
 * photo URLs point at the pre-flattening directory layout and 404. Resolve what
 * can be resolved by filename, top up from the recovered ledger by phone, and
 * DROP the rest — a broken <img> on the live tab is a visible defect, an absent
 * one is a state the grid already handles.
 */
function repairFeed(ledger, diskIndex) {
  if (!fs.existsSync(FEED)) return;

  const feed = JSON.parse(fs.readFileSync(FEED, 'utf8'));
  if (!Array.isArray(feed)) return;

  let before = 0;
  let after = 0;
  let dropped = 0;

  const repaired = feed.map((post) => {
    const original = Array.isArray(post.photoUrls) ? post.photoUrls : [];
    before += original.length;

    const urls = [];
    for (const url of original) {
      const onDisk = diskIndex.get(path.basename(String(url)));
      if (onDisk) { if (!urls.includes(onDisk)) urls.push(onDisk); }
      else dropped += 1;
    }

    // Top up from the recovered ledger so a post whose own photos are gone can
    // still show the venue it is about.
    if (urls.length === 0) {
      for (const key of identityKeys(post)) {
        const hit = ledger.get(key);
        if (!hit) continue;
        for (const basename of hit) {
          const onDisk = diskIndex.get(basename);
          if (onDisk && !urls.includes(onDisk)) urls.push(onDisk);
          if (urls.length >= 8) break;
        }
        if (urls.length) break;
      }
    }

    after += urls.length;
    return { ...post, photoUrls: urls };
  });

  fs.writeFileSync(FEED, JSON.stringify(repaired, null, 2));
  console.log(`[repair] feed.json: ${before} photo refs in, ${after} out (${dropped} dead links removed)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
