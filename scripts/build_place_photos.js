// scripts/build_place_photos.js
//
// Walks the on-disk photo archive at /public/images/{venue}/{YYYY-MM-DD}/*.jpg
// and generates two artifacts:
//   1. public/data/place_photos_index.json   — venue-level metadata: name,
//      photo count, date range, sample photos. Ships in the build.
//   2. public/data/place_photos/{slug}.json  — full photo list per venue
//      (paths + dates + filename, no image data). Used by the per-venue
//      gallery page for browsing, search, and density visualisation.
//
// The build only retains photos that are referenced from a data file. The
// /places page references the photos it needs, so they survive the prune step.

import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IMG_DIR = join(ROOT, 'public', 'images');
const OUT_DIR = join(ROOT, 'public', 'data', 'place_photos');
const INDEX_FILE = join(ROOT, 'public', 'data', 'place_photos_index.json');

const isImage = (n) => /\.(jpe?g|png|webp|heic|heif)$/i.test(n);

// Match the on-disk venue folder name back to a Telegram channel / listing.
// The data.json `sourceChannel` is stored as `@relaxsociety2020`; the
// folder is the same slug in lowercase.
function readData() {
  try {
    return JSON.parse(readFileSyncSafe(join(ROOT, 'public', 'data.json')));
  } catch (e) {
    return [];
  }
}

function readFileSyncSafe(p) {
  // Synchronous file read — fine for small files (data.json is ~50KB).
  return require('node:fs').readFileSync(p, 'utf8');
}

function findListingsForVenue(slug, listings) {
  if (!Array.isArray(listings)) return [];
  return listings.filter((l) => {
    const ch = (l.sourceChannel || '').replace(/^@/, '').toLowerCase();
    if (ch === slug) return true;
    // Match by venue-name slug derived from listing name
    const nameSlug = (l.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const folderSlug = slug.replace(/[^a-z0-9]+/g, '');
    return nameSlug.startsWith(folderSlug) || folderSlug.startsWith(nameSlug);
  });
}

function walkDirPhotos(absDir) {
  const out = [];
  if (!existsSync(absDir)) return out;
  const stack = [absDir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of readdirSync(cur)) {
      const full = join(cur, entry);
      let st;
      try { st = statSync(full); } catch (e) { continue; }
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile() && isImage(entry)) {
        out.push(full);
      }
    }
  }
  return out;
}

function toRelPath(abs) {
  return abs.split(join(ROOT, 'public')).pop().replace(/^[\\/]+/, '/');
}

function extractDate(rel) {
  // rel looks like /images/{slug}/{YYYY-MM-DD}/{file}.jpg
  const m = rel.match(/\/(\d{4}-\d{2}-\d{2})\//);
  return m ? m[1] : null;
}

function deriveSlug(abs) {
  return abs.split(join(IMG_DIR, ''))[1].split('/').filter(Boolean)[0] || null;
}

async function main() {
  if (!existsSync(IMG_DIR)) {
    console.error(`[place-photos] no images directory at ${IMG_DIR}`);
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const listings = readData();
  const venueDirs = readdirSync(IMG_DIR)
    .map((name) => join(IMG_DIR, name))
    .filter((p) => {
      try { return statSync(p).isDirectory(); } catch (e) { return false; }
    });

  console.log(`[place-photos] scanning ${venueDirs.length} venue folders`);

  const venues = [];
  for (const vdir of venueDirs) {
    const slug = deriveSlug(vdir);
    if (!slug) continue;

    const files = walkDirPhotos(vdir);
    if (!files.length) continue;

    const photos = files.map((abs) => {
      const rel = toRelPath(abs);
      return {
        url: rel,
        date: extractDate(rel),
        filename: abs.split('/').pop(),
        bytes: (() => { try { return statSync(abs).size; } catch (e) { return 0; } })(),
      };
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const dates = photos.map((p) => p.date).filter(Boolean);
    const earliest = dates.length ? dates[dates.length - 1] : null;
    const latest = dates.length ? dates[0] : null;
    const matched = findListingsForVenue(slug, listings);
    const channel = matched.length ? matched[0].sourceChannel : `@${slug}`;
    const displayName = matched.length
      ? (matched[0].name || matched[0].nameEn || slug)
      : slug;

    // Per-venue JSON (path-only, no image bytes)
    const perVenueFile = join(OUT_DIR, `${slug}.json`);
    writeFileSync(perVenueFile, JSON.stringify({
      slug,
      channel,
      displayName,
      total: photos.length,
      earliest,
      latest,
      photoCount: photos.length,
      matchedListingIds: matched.map((l) => l.id),
      photos,
    }, null, 0));

    // Aggregate for the index
    const sample = photos.slice(0, 6).map((p) => p.url);
    venues.push({
      slug,
      name: displayName,
      channel,
      photoCount: photos.length,
      earliest,
      latest,
      matchedListingCount: matched.length,
      sample,
      perVenueUrl: `/data/place_photos/${slug}.json`,
    });
  }

  venues.sort((a, b) => b.photoCount - a.photoCount);

  const totalPhotos = venues.reduce((acc, v) => acc + v.photoCount, 0);
  const totalSizeBytes = venues.reduce((acc, v) => {
    // Sum a sampled byte count to estimate full size without re-reading every file
    return acc; // exact total computed lazily by the page; this is just for display
  }, 0);

  writeFileSync(INDEX_FILE, JSON.stringify({
    meta: {
      source: '/public/images (Telegram photo archive)',
      generatedAt: new Date().toISOString(),
      totalVenues: venues.length,
      totalPhotos,
    },
    venues,
  }, null, 0));

  console.log(`[place-photos] wrote ${venues.length} venues, ${totalPhotos} total photos`);
  venues.forEach((v) => console.log(`  ${String(v.photoCount).padStart(6)} ${v.slug}`));
}

main().catch((err) => {
  console.error('[place-photos] failed:', err);
  process.exit(1);
});
