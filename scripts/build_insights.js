/**
 * build_insights.js — compute the deep-insight aggregates that power /insights
 * and the researcher download.
 *
 * Reads a Firestore export (argv[2], default: fetches live) + public/patterns.json,
 * writes:
 *   public/insights.json          — aggregate stats for the Insights page
 *   public/dataset_aggregate.json — per-business aggregate, phones masked,
 *                                   worker persona names EXCLUDED (business
 *                                   names only) — the researcher-grade artifact
 *
 * Usage: node scripts/build_insights.js [firestore_export.json]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, '..', 'public');

async function loadDocs() {
  const p = process.argv[2];
  if (p && fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore, collection, getDocs } = await import('firebase/firestore');
  const app = getApps()[0] || initializeApp({
    projectId: 'sub-i-platform-v3',
    appId: '1:190320143184:web:3ee20b36c95e0e856f5a55',
    apiKey: 'AIzaSyDeleUD1kuPIY4ibNhHMOHQ08QhLGnp7NI',
  });
  const snap = await getDocs(collection(getFirestore(app), 'companions'));
  const docs = [];
  snap.forEach(d => docs.push(d.data()));
  return docs;
}

const normPhone = p => String(p || '').replace(/\D/g, '');
const maskPhone = p => (p.length >= 7 ? `${p.slice(0, 3)}•••${p.slice(-4)}` : '•••');

function minePrices(text) {
  const out = [];
  const matches = String(text || '').matchAll(/(?:฿\s*(\d{2,5})|(\d{2,5})\s*(?:฿|บาท|บ\.|\/ชม))/g);
  for (const m of matches) {
    const v = parseInt(m[1] || m[2], 10);
    if (v >= 100 && v <= 5000) out.push(v);
  }
  return out;
}

// Persona names that read as a person, not a shop — kept OUT of the download.
// Heuristic: no shop-word and short. Conservative: only publish names carrying
// a business word.
const SHOP_WORDS = /spa|massage|นวด|สปา|ร้าน|club|wellness|relax|therapy/i;

const docs = await loadDocs();
const patterns = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(PUB, 'patterns.json'), 'utf8')); }
  catch { return null; }
})();

// ── Per-business rollup ──────────────────────────────────────────────────────
const byPhone = new Map();
for (const d of docs) {
  const p = normPhone(d.phone);
  const key = p || `nophone:${(d.name || '').trim() || d.id}`;
  if (!byPhone.has(key)) {
    byPhone.set(key, {
      phone: p, names: new Set(), first: null, last: null,
      mentions: 0, photos: 0, channels: new Set(), cities: new Set(),
      prices: [], hasLine: false, hasTg: false, hasMaps: false, hours: null,
    });
  }
  const b = byPhone.get(key);
  b.names.add((d.name || '').trim());
  b.mentions += Number(d.mentionCount) || 1;
  b.photos += (d.allPhotoUrls || []).length || (d.imageUrl ? 1 : 0);
  if (d.sourceChannel) b.channels.add(d.sourceChannel);
  if (d.city) b.cities.add(d.city);
  b.prices.push(...minePrices([d.rawText, d.description, d.priceLabel].filter(Boolean).join(' ')));
  b.hasLine ||= Boolean(d.lineUrl);
  b.hasTg ||= Boolean(d.telegramUrl);
  b.hasMaps ||= Boolean(d.mapsUrl);
  b.hours ||= d.hours || null;
  const t = d.postedAt || d.updatedAt;
  if (t) {
    if (!b.first || t < b.first) b.first = t;
    if (!b.last || t > b.last) b.last = t;
  }
}

const businesses = [...byPhone.values()];
const phoneBusinesses = businesses.filter(b => b.phone);

// ── Aggregates ───────────────────────────────────────────────────────────────
const aliasCounts = phoneBusinesses.map(b => b.names.size);
const aliasDist = { '1': 0, '2-4': 0, '5-9': 0, '10-19': 0, '20+': 0 };
for (const n of aliasCounts) {
  if (n === 1) aliasDist['1'] += 1;
  else if (n <= 4) aliasDist['2-4'] += 1;
  else if (n <= 9) aliasDist['5-9'] += 1;
  else if (n <= 19) aliasDist['10-19'] += 1;
  else aliasDist['20+'] += 1;
}

const allPrices = businesses.flatMap(b => b.prices).sort((a, b) => a - b);
const pct = q => (allPrices.length ? allPrices[Math.floor(allPrices.length * q)] : null);
const priceHist = {};
for (const v of allPrices) {
  const bucket = Math.min(1000, Math.floor(v / 100) * 100);
  priceHist[bucket] = (priceHist[bucket] || 0) + 1;
}

const postHours = new Array(24).fill(0);
const postDays = new Array(7).fill(0);
for (const d of docs) {
  const t = d.postedAt || d.updatedAt;
  if (!t) continue;
  const dt = new Date(new Date(t).getTime() + 7 * 3600e3); // UTC+7
  postHours[dt.getUTCHours()] += 1;
  postDays[dt.getUTCDay()] += 1;
}

const closeByHour = {};
let evening = 0, afterMidnight = 0;
for (const d of docs) {
  const m = String(d.hours || '').match(/(?:-|–|ถึง)\s*(\d{1,2})[.:]?(\d{2})?/);
  if (!m) continue;
  const hh = parseInt(m[1], 10);
  if (hh > 24) continue;
  closeByHour[hh] = (closeByHour[hh] || 0) + 1;
  if (hh >= 21 && hh <= 23) evening += 1;
  else if (hh >= 1 && hh <= 5) afterMidnight += 1;
}

const channelCounts = {};
for (const d of docs) {
  const c = d.sourceChannel || 'unknown';
  channelCounts[c] = (channelCounts[c] || 0) + 1;
}
const channelShares = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
const hhi = Math.round(channelShares.reduce((s, [, n]) => s + Math.pow(100 * n / docs.length, 2), 0));

const now = Date.now();
const activeDays = days => phoneBusinesses.filter(b => b.last && (now - new Date(b.last)) < days * 86400e3).length;
const lifespans = phoneBusinesses
  .filter(b => b.first && b.last)
  .map(b => (new Date(b.last) - new Date(b.first)) / 86400e3);

const EUPHEMISMS = {
  aroma: /aroma|อโรมา|อโรม่า/i,
  oil: /(?:^|[^a-z])oil|น้ำมัน/i,
  b2b: /b2b|บอดี้|body ?to ?body|บีทูบี/i,
  shower: /shower|อาบน้ำ|สบู่|soap/i,
  freestyle: /freestyle|ฟรีสไตล์/i,
};
const euphemismCounts = {};
for (const [k, re] of Object.entries(EUPHEMISMS)) {
  euphemismCounts[k] = docs.filter(d => re.test([d.name, d.description, d.rawText].filter(Boolean).join(' '))).length;
}

const contact = {
  phone: Math.round(100 * docs.filter(d => d.phone).length / docs.length),
  line: Math.round(100 * docs.filter(d => d.lineUrl).length / docs.length),
  telegram: Math.round(100 * docs.filter(d => d.telegramUrl).length / docs.length),
  maps: Math.round(100 * docs.filter(d => d.mapsUrl).length / docs.length),
};

const topNetworks = phoneBusinesses
  .map(b => ({
    phoneMasked: maskPhone(b.phone),
    identities: b.names.size,
    businessNames: [...b.names].filter(n => n && SHOP_WORDS.test(n)).slice(0, 4),
  }))
  .sort((a, b) => b.identities - a.identities)
  .slice(0, 6);

const totalPhotos = businesses.reduce((s, b) => s + b.photos, 0);
const messagesTotal = patterns?.counts?.messages || null;

const insights = {
  generatedAt: new Date().toISOString(),
  corpus: {
    personaPosts: docs.length,
    uniqueBusinesses: phoneBusinesses.length,
    duplicationFactor: +(docs.length / Math.max(1, phoneBusinesses.length)).toFixed(1),
    maxAliases: Math.max(...aliasCounts, 0),
    aliasDist,
    photosArchived: totalPhotos,
    messagesTotal,
    channels: channelShares.length,
  },
  prices: {
    mentions: allPrices.length,
    median: pct(0.5), p25: pct(0.25), p75: pct(0.75), p95: pct(0.95),
    hist: priceHist,
  },
  postingHours: postHours,
  postingDays: postDays,
  closing: { byHour: closeByHour, evening, afterMidnight },
  channels: { shares: channelShares.slice(0, 8), hhi },
  activity: {
    active7d: activeDays(7),
    active30d: activeDays(30),
    avgLifespanDays: lifespans.length ? +(lifespans.reduce((a, b) => a + b, 0) / lifespans.length).toFixed(1) : null,
    maxLifespanDays: lifespans.length ? +Math.max(...lifespans).toFixed(1) : null,
  },
  euphemisms: euphemismCounts,
  contact,
  topNetworks,
};

fs.writeFileSync(path.join(PUB, 'insights.json'), JSON.stringify(insights, null, 2));

// ── Researcher download: per-business aggregate, masked, persona names excluded ─
const datasetRows = phoneBusinesses.map(b => ({
  phone_masked: maskPhone(b.phone),
  identity_count: b.names.size,
  business_names: [...b.names].filter(n => n && SHOP_WORDS.test(n)).slice(0, 6),
  first_seen: b.first, last_seen: b.last,
  post_mentions: b.mentions, photo_count: b.photos,
  channels: [...b.channels], cities: [...b.cities],
  price_mentions_thb: b.prices.slice(0, 40),
  has_line: b.hasLine, has_telegram: b.hasTg, has_maps: b.hasMaps,
  stated_hours: b.hours,
})).sort((a, b) => b.post_mentions - a.post_mentions);

fs.writeFileSync(path.join(PUB, 'dataset_aggregate.json'), JSON.stringify({
  title: 'Sabai Sabai — per-business aggregate dataset',
  license: 'Research use. Source: public Telegram channel posts. Phones masked; person-style persona names excluded — business-style names only.',
  generatedAt: insights.generatedAt,
  method: 'Phone-number dedup of persona-posts; see /methodology.',
  row_count: datasetRows.length,
  rows: datasetRows,
}, null, 2));

console.log(`insights.json: ${docs.length} posts → ${phoneBusinesses.length} businesses, ${allPrices.length} price mentions, messages=${messagesTotal}`);
console.log(`dataset_aggregate.json: ${datasetRows.length} rows`);
process.exit(0);
