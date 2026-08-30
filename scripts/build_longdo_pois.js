#!/usr/bin/env node
/**
 * Build public/data/longdo_pois.json from:
 *   1. Longdo category 145 (สปา) — https://map.longdo.com/poilist/145
 *   2. The public user-contributed CSV dump (CC BY-SA 4.0)
 *
 * Streams the ~180 MB CSV to .cache/ (never into public/) so Cloudflare's
 * 25 MB/file cap is not hit. Official list IDs join the dump by numeric id
 * (A10048342 → 10048342) for coordinates.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'data');
const OUT_FILE = join(OUT_DIR, 'longdo_pois.json');
const CACHE_DIR = join(ROOT, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'longdo-pois.cache.csv');

const CSV_URL = 'https://map.longdo.com/download/longdomap-contributed-pois.csv';
const LIST_URL = 'https://map.longdo.com/poilist/145';
const UA = 'sabaisabai-airdnd/1.0 (community intelligence; CC BY-SA attribution)';
const THAILAND = { latMin: 5.5, latMax: 20.5, lngMin: 97.0, lngMax: 105.7 };
const HOTEL_TYPE = /hotel|inn|resort/i;
const SPA_TYPE = /(^|,\s*)spa(\s*,|$)/i;
const MASSAGE_NAME = /นวด|\bmassage\b|\bspa\b|สปา/i;
const CACHE_MAX_AGE_S = 6 * 3600;

const PROVINCE_FIX = {
  Bangkok: 'Bangkok',
  กรุงเทพมหานคร: 'Bangkok',
  กรุงเทพ: 'Bangkok',
  'Chon Buri': 'Chonburi',
  Chonburi: 'Chonburi',
  'Chiang Mai': 'Chiang Mai',
  'Nonthaburi': 'Nonthaburi',
  Phuket: 'Phuket',
};

function inThailand(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln)
    && la >= THAILAND.latMin && la <= THAILAND.latMax
    && ln >= THAILAND.lngMin && ln <= THAILAND.lngMax;
}

function inferProvince(addressTh, addressEn) {
  const english = String(addressEn || '');
  const thai = String(addressTh || '');
  const enParts = english.split(',').map((s) => s.replace(/\s*\d{5}.*$/, '').replace(/\bThailand\b/i, '').trim()).filter(Boolean);
  if (enParts.length) {
    const cand = enParts[enParts.length - 1];
    if (cand && !/^\d+$/.test(cand)) return PROVINCE_FIX[cand] || cand;
  }
  const thaiProv = thai.match(/จ\.\s*([^\s\d]+)/) || thai.match(/จังหวัด\s*([^\s\d]+)/);
  if (thaiProv) return PROVINCE_FIX[thaiProv[1]] || thaiProv[1];
  return 'Thailand';
}

function numericId(value) {
  const raw = String(value || '').trim();
  const stripped = raw.replace(/^A/i, '');
  return /^\d+$/.test(stripped) ? stripped : '';
}

async function fetchCsvToFile(url, target) {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (existsSync(target)) {
    const age = (Date.now() - statSync(target).mtimeMs) / 1000;
    if (age < CACHE_MAX_AGE_S && statSync(target).size > 10_000_000) {
      console.log(`[longdo] reusing cached CSV (${Math.round(age / 60)}m old, ${(statSync(target).size / 1e6).toFixed(0)} MB)`);
      return;
    }
  }
  console.log(`[longdo] streaming ${url}`);
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok || !res.body) throw new Error(`CSV fetch failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));
  console.log(`[longdo] cached CSV → ${target} (${(statSync(target).size / 1e6).toFixed(1)} MB)`);
}

async function* iterateCsv(stream) {
  let field = '';
  let row = [];
  let inQuotes = false;
  for await (const chunk of stream) {
    const text = typeof chunk === 'string' ? chunk : String(chunk);
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        if (row.some(Boolean)) yield row;
        row = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.some(Boolean)) yield row;
  }
}

function parseListPage(html) {
  const items = [];
  const blocks = html.split(/showPOILocation\('/).slice(1);
  for (const block of blocks) {
    const id = block.match(/^([^']+)'/)?.[1];
    // Skip the JS function definition and any non-POI id.
    if (!id || !/^A?\d+$/i.test(id)) continue;
    const nameTh = block.match(/;">([^<]*)<\/a>/)?.[1]
      || block.match(/>([^<]+)<\/a>/)?.[1]
      || '';
    const nameEn = block.match(/ชื่อสถานที่ภาษาอังกฤษ:\s*([^<]+)/)?.[1]?.trim() || '';
    const addressTh = block.match(/alt="th"[^>]*>\s*:\s*([^<]+)/)?.[1]?.trim() || '';
    const addressEn = block.match(/alt="en"[^>]*>\s*:\s*([^<]+)/)?.[1]?.trim() || '';
    const phoneRaw = block.match(/โทรศัพท์:\s*([^<]+)/)?.[1]?.trim() || '';
    const phone = !phoneRaw || phoneRaw === '-' ? null : phoneRaw;
    const decodedTh = decodeEntities(nameTh).trim();
    const decodedEn = decodeEntities(nameEn).trim();
    if (!decodedTh && !decodedEn) continue;
    items.push({
      longdoId: id,
      nameTh: decodedTh || null,
      nameEn: decodedEn || null,
      addressTh: decodeEntities(addressTh).trim() || null,
      addressEn: decodeEntities(addressEn).trim() || null,
      phone,
    });
  }
  return items;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function lastPageFromHtml(html) {
  const pages = [...html.matchAll(/poilist\/145\?page=(\d+)/g)].map((m) => Number(m[1]));
  return pages.length ? Math.max(...pages) : 1;
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function scrapeOfficialList() {
  console.log(`[longdo] scraping ${LIST_URL}`);
  const first = await fetchHtml(`${LIST_URL}?page=1`);
  const last = lastPageFromHtml(first);
  const byId = new Map();
  const ingest = (html) => {
    for (const item of parseListPage(html)) {
      if (!byId.has(item.longdoId)) byId.set(item.longdoId, item);
    }
  };
  ingest(first);

  const pending = [];
  for (let page = 2; page <= last; page += 1) pending.push(page);
  const concurrency = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const page = pending[cursor];
      cursor += 1;
      try {
        ingest(await fetchHtml(`${LIST_URL}?page=${page}`));
      } catch (err) {
        console.warn(`[longdo] page ${page} failed: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
  console.log(`[longdo] official category 145: ${byId.size} spas across ${last} pages`);
  return byId;
}

function keepCsvRow(row, officialNumeric) {
  const id = numericId(row.id);
  if (officialNumeric.has(id)) return true;
  const type = row.poi_type || '';
  if (SPA_TYPE.test(type) && !HOTEL_TYPE.test(type)) return true;
  const haystack = `${row.name_th || ''} ${row.name_en || ''}`;
  if (MASSAGE_NAME.test(haystack) && !HOTEL_TYPE.test(type) && /นวด|\bmassage\b/i.test(haystack)) return true;
  return false;
}

function toPoi(row, official) {
  const id = numericId(row.id);
  const longdoId = official?.longdoId || `A${id}`;
  const nameEn = official?.nameEn || row.name_en || null;
  const nameTh = official?.nameTh || row.name_th || null;
  const addressEn = official?.addressEn || row.address_en || null;
  const addressTh = official?.addressTh || row.address_th || null;
  return {
    id: `longdo-${longdoId}`,
    longdoId,
    name: nameEn || nameTh,
    nameTh,
    nameEn,
    location: addressEn || addressTh,
    addressTh,
    addressEn,
    city: inferProvince(addressTh, addressEn),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: official?.phone || row.telephone || null,
    website: row.website || null,
    source: 'longdo',
    poiType: row.poi_type || 'spa',
    lastupdate: row.lastupdate || null,
    fromOfficialList: Boolean(official),
  };
}

async function coordsFromDetail(longdoId) {
  const html = await fetchHtml(`https://map.longdo.com/p/${longdoId}`);
  const lat = html.match(/[?&]lat=([\d.-]+)/)?.[1];
  const lng = html.match(/[?&]long=([\d.-]+)/)?.[1];
  if (!inThailand(lat, lng)) return null;
  return { latitude: Number(lat), longitude: Number(lng) };
}

async function main() {
  const official = await scrapeOfficialList();
  const officialNumeric = new Set([...official.keys()].map(numericId).filter(Boolean));

  await fetchCsvToFile(CSV_URL, CACHE_FILE);

  const stream = createReadStream(CACHE_FILE, { encoding: 'utf8' });
  let header = null;
  const byNumeric = new Map();
  let totalScanned = 0;
  for await (const cells of iterateCsv(stream)) {
    if (!header) {
      header = cells.map((c) => String(c || '').replace(/^\uFEFF/, '').trim());
      continue;
    }
    totalScanned += 1;
    while (cells.length < header.length) cells.push('');
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = cells[i];
    if (!keepCsvRow(row, officialNumeric)) continue;
    if (!inThailand(row.latitude, row.longitude)) continue;
    const id = numericId(row.id);
    if (!id) continue;
    const match = official.get(`A${id}`) || official.get(id) || null;
    byNumeric.set(id, toPoi(row, match));
  }

  const missing = [];
  for (const [longdoId, item] of official) {
    const id = numericId(longdoId);
    if (id && byNumeric.has(id)) continue;
    missing.push(item);
  }

  console.log(`[longdo] CSV kept ${byNumeric.size} / ${totalScanned}; ${missing.length} official IDs need detail lookup`);
  const concurrency = 6;
  let mi = 0;
  async function detailWorker() {
    while (mi < missing.length) {
      const item = missing[mi];
      mi += 1;
      try {
        const coords = await coordsFromDetail(item.longdoId);
        if (!coords) continue;
        byNumeric.set(numericId(item.longdoId) || item.longdoId, toPoi({
          id: numericId(item.longdoId),
          name_th: item.nameTh,
          name_en: item.nameEn,
          address_th: item.addressTh,
          address_en: item.addressEn,
          telephone: item.phone,
          poi_type: 'spa',
          latitude: coords.latitude,
          longitude: coords.longitude,
        }, item));
      } catch (err) {
        console.warn(`[longdo] detail ${item.longdoId}: ${err.message}`);
      }
    }
  }
  if (missing.length) {
    await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, () => detailWorker()));
  }

  const pois = [...byNumeric.values()]
    .filter((p) => p.name && inThailand(p.latitude, p.longitude))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify({
    meta: {
      source: LIST_URL,
      csv: CSV_URL,
      license: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)',
      attribution: 'POI data from Longdo Map (https://map.longdo.com)',
      generatedAt: new Date().toISOString(),
      totalScanned,
      officialList: official.size,
      totalSpa: pois.length,
    },
    pois,
  }));
  console.log(`[longdo] wrote ${pois.length} spa/massage POIs → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('[longdo] failed:', err);
  process.exit(1);
});
