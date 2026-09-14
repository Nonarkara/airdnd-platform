#!/usr/bin/env node
/**
 * Fetch open-license face photos for OTOP provinces (and optionally categories).
 *
 * Source of truth: Wikimedia Commons API only.
 * Licenses accepted: Public Domain / CC0 / CC BY / CC BY-SA (any version).
 * NEVER hotlink commercial stock, NEVER invent documentary product photos.
 *
 * Query seeds come from otop_province_faces.json (real category mix + repeated
 * product names) — not from folklore lists of "famous" products.
 *
 * Writes:
 *   otop/public/media/provinces/<code>.json   — per-province manifest
 *   otop/public/media/provinces/index.json    — national index
 *   otop/public/media/categories/<id>.json    — optional category archetypes
 *
 * Images: by default store Wikimedia thumb URLs (stable, lean). Pass --cache
 * to download 640px thumbs under otop/public/media/provinces/img/ (still lean).
 *
 * Usage:
 *   node scripts/otop/fetch-province-media.mjs
 *   node scripts/otop/fetch-province-media.mjs --limit 5
 *   node scripts/otop/fetch-province-media.mjs --cache --per-province 2
 *   node scripts/otop/fetch-province-media.mjs --categories
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const FACES = path.join(ROOT, 'otop/public/otop_province_faces.json');
const OUT_DIR = path.join(ROOT, 'otop/public/media/provinces');
const CAT_DIR = path.join(ROOT, 'otop/public/media/categories');
const IMG_DIR = path.join(OUT_DIR, 'img');

const UA = 'OTOP-registry/1.0 (Thai civic open data; https://github.com/Nonarkara/airdnd-platform)';
const API = 'https://commons.wikimedia.org/w/api.php';

const ALLOWED_LICENSE = /^(Public domain|PD|CC0|CC[-\s]?BY(?:-SA)?(?:\s+\d+(\.\d+)?)?)$/i;

const args = process.argv.slice(2);
const LIMIT = Number(args.find((_, i, a) => a[i - 1] === '--limit') ?? 0) || 0;
const PER = Number(args.find((_, i, a) => a[i - 1] === '--per-province') ?? 2) || 2;
const DO_CACHE = args.includes('--cache');
const DO_CATS = args.includes('--categories');
const REFETCH = args.includes('--refetch');

/** Craft-grounded fallbacks when faces have thin product names — still category-level, not invented fame. */
const CATEGORY_QUERY = {
  textile: ['Thai silk weaving', 'ผ้าไหม ทอมือ', 'Thai handwoven textile', 'ผ้าบาติก เขียนมือ', 'Thai batik cloth'],
  food: ['Thai market food stall', 'อาหารพื้นบ้าน ไทย', 'Thai dried fruit', 'OTOP food Thailand'],
  beverage: ['Thai herbal tea', 'ชาสมุนไพร ไทย', 'Thai coffee beans'],
  craft: ['Thai bamboo basketry', 'จักสานไม้ไผ่', 'Thai rattan craft', 'เครื่องปั้นดินเผา ไทย'],
  herbal: ['Thai herbal compress', 'ลูกประคบ สมุนไพร', 'Thai spa herbs'],
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function licenseOk(shortName) {
  if (!shortName) return false;
  const s = shortName.trim();
  if (/CC[-\s]?BY-NC/i.test(s)) return false;
  if (/CC[-\s]?BY-ND/i.test(s)) return false;
  return ALLOWED_LICENSE.test(s);
}

/** Reject Commons hits that are clearly not craft / food / place faces. */
const REJECT_TITLE = /boeing|airbus|aircraft|airplane|airport|airline|taxiing|737|a320|locomotive|freight train|motorway|highway interchange|container ship|naval ship|warship|fighter jet|helicopter/i;


async function commonsSearch(query, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime|user',
    iiurlwidth: '640',
  });
  const res = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status} for ${query}`);
  const data = await res.json();
  return Object.values(data.query?.pages ?? {});
}

function cleanUrl(u) {
  if (!u) return u;
  try {
    const url = new URL(u);
    url.search = '';
    return url.toString();
  } catch {
    return u.split('?')[0];
  }
}

function relevanceScore(title, description, face) {
  const hay = `${title} ${description}`.toLowerCase();
  let score = 0;
  if (face?.en && hay.includes(face.en.toLowerCase())) score += 5;
  if (face?.th && hay.includes(face.th)) score += 5;
  if (/thailand|ไทย|siam|otop|โอทอป/.test(hay)) score += 3;
  if (/silk|ไหม|weav|ทอ|batik|บาติก|basketry|จักสาน|ceramic|ปั้น|celadon|ศิลาดล|herbal|สมุนไพร|market|ตลาด|craft|หัตถกรรม|umbrella|ร่ม/.test(hay)) score += 2;
  // Soft-penalize clearly off-country place names when Thailand/province missing.
  if (score < 3 && /(vietnam|laos|cambodia|myanmar|china|india|indonesia|malaysia)\b/i.test(hay)) {
    score -= 4;
  }
  return score;
}

function pickFromPages(pages, seenTitles, face = null) {
  const hits = [];
  for (const page of pages) {
    if (!page.title || seenTitles.has(page.title)) continue;
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(ii.mime || '')) continue;
    const meta = ii.extmetadata || {};
    const license = meta.LicenseShortName?.value || meta.License?.value || '';
    if (!licenseOk(license)) continue;
    const artist = stripHtml(meta.Artist?.value || meta.Credit?.value || ii.user || 'Unknown');
    const licenseUrl = meta.LicenseUrl?.value
      || ( /public domain|cc0|pd/i.test(license)
        ? 'https://creativecommons.org/publicdomain/mark/1.0/'
        : null);
    const description = stripHtml(meta.ImageDescription?.value || page.title.replace(/^File:/, ''));
    const score = relevanceScore(page.title, description, face);
    // Drop clearly off-topic foreign hits when we have no Thailand/province signal.
    if (score < 0) continue;
    if (REJECT_TITLE.test(page.title) || REJECT_TITLE.test(description)) continue;
    const thumbUrl = cleanUrl(ii.thumburl || ii.url);
    if (!thumbUrl) continue;
    hits.push({
      title: page.title,
      filePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%3A/g, ':')}`,
      description,
      author: artist.slice(0, 160),
      license: license.trim(),
      licenseUrl,
      source: 'Wikimedia Commons',
      thumbUrl,
      fullUrl: cleanUrl(ii.url),
      width: ii.thumbwidth || ii.width || null,
      height: ii.thumbheight || ii.height || null,
      mime: ii.mime,
      relevance: score,
      isExactProducer: false,
      representation: 'illustrative',
      representationNote:
        'Open-license photograph of a craft, place, or product type associated with this province\'s registry mix — not a photo of a specific listed producer.',
    });
  }
  hits.sort((a, b) => b.relevance - a.relevance);
  return hits;
}

async function findMediaForQueries(queries, need, seenTitles, face = null) {
  const found = [];
  for (const q of queries) {
    if (found.length >= need) break;
    try {
      const pages = await commonsSearch(q, 10);
      const hits = pickFromPages(pages, seenTitles, face);
      for (const h of hits) {
        if (found.length >= need) break;
        // Prefer Thailand/province-grounded hits; keep weaker ones only if still short.
        if (h.relevance <= 0 && found.length > 0) continue;
        seenTitles.add(h.title);
        found.push({ ...h, query: q });
      }
      // Early exit once we have enough province/Thailand-grounded photos.
      if (found.filter((f) => f.relevance >= 3).length >= need) break;
    } catch (e) {
      console.warn(`  warn: query "${q}" → ${e.message}`);
    }
    await sleep(280); // be polite to Commons
  }
  return found;
}

async function maybeCache(hit, code, index) {
  if (!DO_CACHE) {
    return { ...hit, localPath: null, url: hit.thumbUrl };
  }
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const ext = (hit.mime || 'image/jpeg').includes('png') ? 'png' : 'jpg';
  const fname = `${String(code).padStart(2, '0')}-${index}.${ext}`;
  const dest = path.join(IMG_DIR, fname);
  const res = await fetch(hit.thumbUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Skip absurdly large thumbs — keep the corpus lean.
  if (buf.length > 800_000) {
    console.warn(`  skip cache (too large ${(buf.length / 1024).toFixed(0)}KB): ${hit.title}`);
    return { ...hit, localPath: null, url: hit.thumbUrl };
  }
  fs.writeFileSync(dest, buf);
  return {
    ...hit,
    localPath: `media/provinces/img/${fname}`,
    url: `/media/provinces/img/${fname}`,
    cachedBytes: buf.length,
  };
}

function buildQueries(face) {
  const seeds = [...(face.mediaQuerySeeds || [])];
  const catId = face.dominantCategory?.id;
  if (catId && CATEGORY_QUERY[catId]) {
    for (const q of CATEGORY_QUERY[catId]) {
      seeds.push(`${face.en} ${q}`);
      seeds.push(q);
    }
  }
  // Deduplicate while preserving order
  const seen = new Set();
  return seeds.filter((q) => {
    const k = q.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchProvince(face, globalSeen) {
  const code = face.code;
  const manifestPath = path.join(OUT_DIR, `${code}.json`);
  if (!REFETCH && fs.existsSync(manifestPath)) {
    const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if ((existing.photos?.length ?? 0) > 0 || existing.status === 'no_safe_hit') {
      return existing;
    }
  }

  const queries = buildQueries(face);
  const raw = await findMediaForQueries(queries, PER, globalSeen, face);
  const photos = [];
  for (let i = 0; i < raw.length; i++) {
    try {
      photos.push(await maybeCache(raw[i], code, i + 1));
      await sleep(150);
    } catch (e) {
      console.warn(`  cache fail ${code}: ${e.message}`);
      photos.push({ ...raw[i], localPath: null, url: raw[i].thumbUrl });
    }
  }

  const manifest = {
    code: face.code,
    iso: face.iso,
    th: face.th,
    en: face.en,
    dominantCategory: face.dominantCategory,
    fetchedAt: new Date().toISOString(),
    status: photos.length > 0 ? 'ok' : 'no_safe_hit',
    honesty: {
      note: photos.length
        ? 'Photos are open-license illustrations tied to this province\'s registry category/product mix. They are not photographs of specific listed OTOP producers unless isExactProducer is true.'
        : 'No open-license Commons hit matched this province\'s query seeds. The UI must show a placeholder — never a wrong product photo.',
    },
    queriesAttempted: queries.slice(0, 8),
    photos: photos.map((p) => ({
      title: p.title,
      description: p.description,
      author: p.author,
      license: p.license,
      licenseUrl: p.licenseUrl,
      source: p.source,
      filePage: p.filePage,
      url: p.url || p.thumbUrl,
      thumbUrl: p.thumbUrl,
      localPath: p.localPath,
      query: p.query,
      isExactProducer: false,
      representation: 'illustrative',
      representationNote: p.representationNote,
    })),
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

async function fetchCategories() {
  fs.mkdirSync(CAT_DIR, { recursive: true });
  const index = [];
  const seen = new Set();
  for (const [id, queries] of Object.entries(CATEGORY_QUERY)) {
    const raw = await findMediaForQueries(queries, 1, seen, { en: 'Thailand', th: 'ไทย' });
    const photo = raw[0]
      ? {
          ...raw[0],
          url: raw[0].thumbUrl,
          localPath: null,
          isExactProducer: false,
          representation: 'illustrative',
          representationNote:
            'Category archetype from Wikimedia Commons — not a specific producer\'s product.',
        }
      : null;
    const manifest = {
      id,
      fetchedAt: new Date().toISOString(),
      status: photo ? 'ok' : 'no_safe_hit',
      photos: photo ? [photo] : [],
    };
    fs.writeFileSync(path.join(CAT_DIR, `${id}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
    index.push({ id, status: manifest.status, photos: manifest.photos.length });
    console.log(`  category ${id}: ${manifest.status}`);
  }
  fs.writeFileSync(path.join(CAT_DIR, 'index.json'), `${JSON.stringify({ builtAt: new Date().toISOString(), categories: index }, null, 2)}\n`);
}

async function main() {
  if (!fs.existsSync(FACES)) {
    console.error('missing otop_province_faces.json — run: node scripts/otop/province-faces.js');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const faces = JSON.parse(fs.readFileSync(FACES, 'utf8'));
  let list = faces.provinces ?? [];
  if (LIMIT > 0) list = list.slice(0, LIMIT);

  console.log(`fetch-province-media: ${list.length} provinces · ${PER} photo(s) each · cache=${DO_CACHE}`);
  const globalSeen = new Set();
  const index = [];
  let withPhotos = 0;
  let noHit = 0;

  for (const face of list) {
    process.stdout.write(`  ${face.code} ${face.en}… `);
    try {
      const m = await fetchProvince(face, globalSeen);
      const n = m.photos?.length ?? 0;
      if (n > 0) withPhotos++;
      else noHit++;
      index.push({
        code: m.code,
        iso: m.iso,
        th: m.th,
        en: m.en,
        status: m.status,
        photos: n,
        dominantCategory: m.dominantCategory?.id ?? null,
      });
      console.log(m.status === 'ok' ? `${n} photo(s)` : 'no safe hit');
    } catch (e) {
      noHit++;
      index.push({ code: face.code, iso: face.iso, th: face.th, en: face.en, status: 'error', photos: 0, error: e.message });
      console.log(`ERROR ${e.message}`);
    }
  }

  const national = {
    builtAt: new Date().toISOString(),
    source: 'Wikimedia Commons',
    licensePolicy: 'CC BY / CC BY-SA / Public Domain / CC0 only',
    cacheMode: DO_CACHE ? 'local-thumbs' : 'remote-thumbs',
    perProvince: PER,
    counts: {
      provinces: index.length,
      withPhotos,
      noSafeHit: noHit,
      photos: index.reduce((s, r) => s + (r.photos || 0), 0),
    },
    honesty:
      'Each province manifest lists attribution + license URL. Missing hits must render a placeholder. Illustrative craft photos are never claimed as a named producer\'s product shot.',
    provinces: index,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(national, null, 2)}\n`);
  console.log(`done: ${withPhotos}/${index.length} provinces with licensed photos → media/provinces/index.json`);

  if (DO_CATS) {
    console.log('fetching category archetypes…');
    await fetchCategories();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
