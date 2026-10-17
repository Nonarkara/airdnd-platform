#!/usr/bin/env node
/**
 * stage_snapshot_photos.js — make the photos the snapshot points at actually ship.
 *
 * Why this exists: `.gitignore` excludes `public/images/` wholesale (the full
 * archive is tens of thousands of files), and `photo_storage.js` falls back to a
 * local `/images/<channel>/<date>/<file>` path whenever the Supabase Storage
 * upload fails. The snapshot refresh keeps that path because the file exists on
 * the machine that ran it, the commit carries `data.json` but never the image,
 * and production renders an empty photo cell. As of the 2026-09 audit, 84 of
 * the 100 photo paths in `data.json` had never been committed.
 *
 * This script closes that loop: every local image path referenced by
 * `public/data.json` or `public/feed.json` that exists on disk is force-added
 * to git (`git add -f`, because the directory is ignored), and every path that
 * does not exist is reported so it is never a silent 404 again.
 *
 * Not to be confused with `sync_active_photos.js`, the one-off July migration
 * that moved `/photos/` files into `/images/` and rewrote Firestore URLs.
 *
 * Usage: node scripts/stage_snapshot_photos.js [--dry-run] [--json]
 *   --dry-run  report without staging anything
 *   --json     print a machine-readable summary
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DRY_RUN = process.argv.includes('--dry-run');
const JSON_OUT = process.argv.includes('--json');

function readJsonArray(relPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(PUBLIC, relPath), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Every field the frontend or the build-time pruner reads a photo URL from.
function collectLocalPhotoPaths(items) {
  const out = new Set();
  for (const item of items) {
    const candidates = [
      item?.imageUrl,
      item?.displayPrimaryPhoto,
      ...(Array.isArray(item?.photoUrls) ? item.photoUrls : []),
      ...(Array.isArray(item?.allPhotoUrls) ? item.allPhotoUrls : []),
    ];
    for (const url of candidates) {
      if (typeof url === 'string' && url.startsWith('/images/')) {
        out.add(url);
      }
    }
  }
  return [...out];
}

function trackedSet() {
  const stdout = execFileSync('git', ['ls-files', '-z', 'public/images'], { cwd: ROOT, encoding: 'utf8' });
  return new Set(stdout.split('\0').filter(Boolean).map((p) => `/${p.replace(/^public\//, '')}`));
}

export function stageSnapshotPhotos({ dryRun = DRY_RUN } = {}) {
  const referenced = collectLocalPhotoPaths([...readJsonArray('data.json'), ...readJsonArray('feed.json')]);
  const tracked = trackedSet();

  const alreadyTracked = [];
  const toStage = [];
  const missing = [];
  for (const url of referenced) {
    const abs = path.join(PUBLIC, url.replace(/^\/+/, ''));
    if (tracked.has(url)) alreadyTracked.push(url);
    else if (fs.existsSync(abs)) toStage.push(url);
    else missing.push(url);
  }

  if (!dryRun && toStage.length > 0) {
    // -f because public/images/ is gitignored by design; we only ever force-add
    // the handful of files the snapshot actually points at.
    const rel = toStage.map((u) => path.join('public', u.replace(/^\/+/, '')));
    for (let i = 0; i < rel.length; i += 200) {
      execFileSync('git', ['add', '-f', '--', ...rel.slice(i, i + 200)], { cwd: ROOT, stdio: 'inherit' });
    }
  }

  return {
    referenced: referenced.length,
    alreadyTracked: alreadyTracked.length,
    staged: dryRun ? 0 : toStage.length,
    stageable: toStage.length,
    missing: missing.length,
    missingPaths: missing,
    dryRun,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = stageSnapshotPhotos();
  if (JSON_OUT) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `[stage-snapshot-photos] referenced ${result.referenced} · already tracked ${result.alreadyTracked}` +
        ` · ${result.dryRun ? 'stageable' : 'staged'} ${result.stageable} · missing on this machine ${result.missing}`,
    );
    if (result.missing > 0) {
      console.log('[stage-snapshot-photos] these paths are in the snapshot but not on disk here — they will 404 in production:');
      for (const p of result.missingPaths.slice(0, 20)) console.log(`  ${p}`);
      if (result.missingPaths.length > 20) console.log(`  … and ${result.missingPaths.length - 20} more`);
      console.log('[stage-snapshot-photos] run this on the machine that scraped them (the local photo cache), then commit.');
    }
  }
}
