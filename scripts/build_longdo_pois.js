// scripts/build_longdo_pois.js
//
// Pulls the public Longdo Map user-contributed POI dump (CC BY-SA 4.0) and
// filters for spa / massage / นวด entries with valid Thailand coordinates.
// Output: public/data/longdo_pois.json
//
// Streams the 700k-line CSV so we never hold the whole file in memory. Each
// passing row is written straight to the output array; non-matching rows are
// discarded without allocating.
//
// Longdo bulk export:
//   https://map.longdo.com/download/longdomap-contributed-pois.csv

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createReadStream, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const OUT_FILE = join(OUT_DIR, 'longdo_pois.json');
// Cached CSV lives OUTSIDE public/ so it never enters the build. The 180MB
// raw export would otherwise blow past Cloudflare Pages' 25 MB per-file cap.
const CACHE_DIR = join(ROOT, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'longdo-pois.cache.csv');

const SOURCE_URL =
  'https://map.longdo.com/download/longdomap-contributed-pois.csv';

const THAILAND_BOUNDS = { latMin: 5.5, latMax: 20.5, lngMin: 97.0, lngMax: 105.7 };

const PATTERNS = [
  /\bspa\b/i,
  /\bmassage\b/i,
  /สปา/,
  /นวด/,
  /แผนไทย/,
  /สุขภาพ/,
  /\bthai\s*massage\b/i,
  /\bwellness\b/i,
];

function isInThailand(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return (
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    la >= THAILAND_BOUNDS.latMin &&
    la <= THAILAND_BOUNDS.latMax &&
    ln >= THAILAND_BOUNDS.lngMin &&
    ln <= THAILAND_BOUNDS.lngMax
  );
}

function matches(nameTh, nameEn) {
  const haystack = `${nameTh || ''} ${nameEn || ''}`;
  const positiveHit = PATTERNS.some((re) => re.test(haystack));
  if (!positiveHit) return false;
  if (!/สปา|นวด|spa|massage/i.test(haystack)) return false;
  return true;
}

function inferProvince(addressTh, addressEn) {
  const raw = (addressEn || addressTh || '').split(',').map((s) => s.trim());
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const seg = raw[i].replace(/\s*\d{5}.*$/, '').trim();
    if (seg) return seg;
  }
  return null;
}

// Streaming RFC-4180 parser. Yields one record (object) at a time without
// buffering the whole file. We rely on Longdo's actual export being well-
// formed (no embedded newlines inside quoted fields), which is true for this
// specific dataset — but the parser still handles the common edge cases.
async function* iterateCsv(stream) {
  let buffer = '';
  let field = '';
  let row = [];
  let inQuotes = false;

  for await (const chunk of stream) {
    buffer += chunk;
    let i = 0;
    while (i < buffer.length) {
      const ch = buffer[i];
      if (inQuotes) {
        if (ch === '"') {
          if (buffer[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        field += ch;
        i += 1;
      } else if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i += 1;
      } else if (ch === '\n' || ch === '\r') {
        // Tolerate both \n and \r\n
        if (ch === '\r' && buffer[i + 1] === '\n') i += 1;
        if (field !== '' || row.length) {
          row.push(field);
          yield row;
          row = [];
          field = '';
        }
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    }
    buffer = '';
  }
  if (field !== '' || row.length) {
    row.push(field);
    yield row;
  }
}

async function fetchCsvToFile(url, target) {
  if (existsSync(target)) {
    const age = (Date.now() - statSync(target).mtimeMs) / 1000;
    // Reuse cache if it's < 6h old to avoid hammering Longdo on every build.
    if (age < 6 * 3600) {
      console.log(`[longdo] reusing cached CSV (${Math.round(age / 60)}m old)`);
      return;
    }
  }
  console.log(`[longdo] fetching ${url}`);
  const res = await fetch(url, {
    headers: { 'user-agent': 'sabaisabai-airdnd/1.0 (community intelligence)' },
  });
  if (!res.ok) throw new Error(`Longdo CSV fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(target, text);
  console.log(`[longdo] cached CSV → ${target} (${(text.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  await fetchCsvToFile(SOURCE_URL, CACHE_FILE);

  const stream = createReadStream(CACHE_FILE, { encoding: 'utf8' });
  let header = null;
  const out = [];
  let totalScanned = 0;
  for await (const cells of iterateCsv(stream)) {
    if (!header) {
      header = cells.map((c) => (c || '').replace(/^\uFEFF/, '').trim());
      continue;
    }
    totalScanned += 1;
    if (cells.length < header.length) {
      // short line — pad
      while (cells.length < header.length) cells.push('');
    }
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = cells[i];
    if (!matches(row.name_th, row.name_en)) continue;
    if (!isInThailand(row.latitude, row.longitude)) continue;
    out.push({
      id: `longdo-${row.id}`,
      longdoId: row.id,
      name: row.name_en || row.name_th,
      nameTh: row.name_th || null,
      nameEn: row.name_en || null,
      location: row.address_en || row.address_th,
      addressTh: row.address_th || null,
      addressEn: row.address_en || null,
      city: inferProvince(row.address_th, row.address_en) || 'Thailand',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      phone: row.telephone || null,
      website: row.website || null,
      source: 'longdo',
      poiType: row.poi_type || null,
      lastupdate: row.lastupdate || null,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        meta: {
          source: SOURCE_URL,
          license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
          attribution: 'POI data from Longdo Map (https://map.longdo.com)',
          generatedAt: new Date().toISOString(),
          totalScanned,
          totalSpa: out.length,
        },
        pois: out,
      },
      null,
      0,
    ),
  );
  console.log(`[longdo] wrote ${out.length} spa/massage POIs to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('[longdo] failed:', err);
  process.exit(1);
});
