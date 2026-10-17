#!/usr/bin/env node
/**
 * verify_snapshot.js — say what the build is actually shipping.
 *
 * Until 2026-09 this only checked that data.json was non-empty, which let a
 * snapshot ship with 84 of its 100 photo paths uncommitted, four of twelve
 * channels represented, and a LIVE feed that was a copy of the directory.
 *
 * Now it computes the intake funnel (src/lib/snapshot_funnel.js), prints it,
 * and writes `public/funnel.json` so the hero can disclose the same numbers to
 * readers. It still only *fails* the build on an unusable snapshot; the rest
 * are loud warnings, because a stale-but-honest site beats no site. Pass
 * `--strict` to fail on any warning (useful in CI once the pipeline is back).
 *
 * Usage: node scripts/verify_snapshot.js [--strict] [--quiet]
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { computeSnapshotFunnel } from '../src/lib/snapshot_funnel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const STRICT = process.argv.includes('--strict');
const QUIET = process.argv.includes('--quiet');

function readJson(relPath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(PUBLIC, relPath), 'utf8'));
  } catch {
    return fallback;
  }
}

function trackedImagePaths() {
  try {
    const out = execFileSync('git', ['ls-files', '-z', 'public/images'], { cwd: ROOT, encoding: 'utf8' });
    return out.split('\0').filter(Boolean).map((p) => `/${p.replace(/^public\//, '')}`);
  } catch {
    // Not a git checkout (e.g. a bare deploy dir): fall back to what is on disk.
    const dir = path.join(PUBLIC, 'images');
    const found = [];
    const walk = (d) => {
      if (!fs.existsSync(d)) return;
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else found.push(`/${path.relative(PUBLIC, full)}`);
      }
    };
    walk(dir);
    return found;
  }
}

// The scraper's target list is a module-level constant with import-time side
// effects, so read it as text rather than importing the module.
function configuredChannels() {
  const env = process.env.TELEGRAM_SOURCE_TARGETS || process.env.TELEGRAM_SOURCE_CHANNELS;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'telegram_scraper.js'), 'utf8');
    const block = src.match(/DEFAULT_SOURCE_TARGETS\s*=\s*\[([\s\S]*?)\];/);
    return block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  } catch {
    return [];
  }
}

const listings = readJson('data.json', []);
if (!Array.isArray(listings)) {
  console.error('Snapshot check failed: public/data.json is not an array.');
  process.exit(1);
}

const funnel = computeSnapshotFunnel({
  listings,
  trackedImagePaths: trackedImagePaths(),
  configuredChannels: configuredChannels(),
  corpus: readJson('insights.json')?.corpus || null,
  feedMeta: readJson('feed_meta.json'),
});

// The hero reads this at runtime; keep the payload small.
const { missingPhotoPaths, ...publicFunnel } = funnel;
fs.writeFileSync(path.join(PUBLIC, 'funnel.json'), `${JSON.stringify(publicFunnel, null, 2)}\n`);

if (!QUIET) {
  const s = funnel.shown;
  console.log(
    `[verify-snapshot] cards ${s.cards} · with photo ${s.withPhoto} · photo files committed ${s.photoFilesTracked}, missing ${s.photoFilesMissing}` +
      ` · channels ${s.channelsRepresented}/${funnel.intake.channelsConfigured} · newest post ${funnel.snapshot.newestPostAt || '—'} (${funnel.snapshot.ageDays ?? '—'}d)`,
  );
  if (funnel.archive) {
    const a = funnel.archive;
    console.log(`[verify-snapshot] archive: ${a.messages} messages · ${a.photos} photos · ${a.personaPosts} persona-posts → ${a.businesses} businesses`);
  }
  for (const w of funnel.warnings) console.warn(`[verify-snapshot] WARNING: ${w}`);
  if (missingPhotoPaths.length) {
    console.warn('[verify-snapshot] run `npm run photos:stage` on the machine that scraped these to commit them.');
  }
  console.log('[verify-snapshot] wrote public/funnel.json');
}

if (funnel.shown.cards === 0) {
  console.error('Snapshot check failed: public/data.json is empty.');
  process.exit(1);
}
if (STRICT && funnel.warnings.length > 0) {
  console.error(`Snapshot check failed (--strict): ${funnel.warnings.length} warning(s).`);
  process.exit(1);
}
