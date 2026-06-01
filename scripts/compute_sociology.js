#!/usr/bin/env node
/*
 * Sabai Sabai — compute the sociological patterns from the listing corpus.
 * Reads public/feed.json, public/data.json, public/patterns.json.
 * No Supabase. No env needed. Runs instantly.
 *
 * Outputs public/sociology.json — consumed by src/components/Sociology.jsx.
 *
 * Three research questions:
 *   1. Temporal anxiety   — when do operators post?
 *   2. Posting intervals  — how often does the same parlor re-post?
 *   3. Name semiotics     — what do names and service descriptions reveal?
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

function read(filename) {
  const p = path.join(ROOT, 'public', filename);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`[sociology] Could not read ${filename}: ${e.message}`);
    return null;
  }
}

// ── 1. TEMPORAL ANXIETY ─────────────────────────────────────────────────────

function computeTemporalAnxiety(feed) {
  const hourCounts = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts = Array.from({ length: 7 }, (_, d) => ({ day: d, label: dayLabels[d], count: 0 }));

  const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
  let totalMessages = 0;

  for (const msg of feed) {
    if (!msg.messageDate) continue;
    const utcMs = new Date(msg.messageDate).getTime();
    if (Number.isNaN(utcMs)) continue;
    const bkkMs = utcMs + BKK_OFFSET_MS;
    const bkkDate = new Date(bkkMs);
    hourCounts[bkkDate.getUTCHours()].count++;
    dayCounts[bkkDate.getUTCDay()].count++;
    totalMessages++;
  }

  // 3-hour sliding window for peak anxiety window
  let peakStart = 0;
  let peakMax = 0;
  for (let h = 0; h < 24; h++) {
    const window = (hourCounts[h].count + hourCounts[(h + 1) % 24].count + hourCounts[(h + 2) % 24].count);
    if (window > peakMax) {
      peakMax = window;
      peakStart = h;
    }
  }

  return {
    hourly: hourCounts,
    dayOfWeek: dayCounts,
    peakAnxietyWindow: {
      startHour: peakStart,
      endHour: (peakStart + 2) % 24,
      count: peakMax,
    },
    totalMessages,
  };
}

// ── 2. POSTING INTERVALS / DESPERATION ──────────────────────────────────────

function computeMentionDistribution(patterns) {
  const ops = (patterns && patterns.operators) || [];

  const NOW = new Date('2026-05-26T00:00:00Z');

  const withVelocity = ops
    .filter((op) => op.totalMentions > 0)
    .map((op) => {
      const earliest = op.earliestSeen ? new Date(op.earliestSeen) : null;
      const daysActive = earliest
        ? Math.max(1, Math.round((NOW - earliest) / (1000 * 60 * 60 * 24)))
        : 1;
      return {
        name: op.operatorName || op.aliases?.[0] || '—',
        phone: op.phone || '',
        totalMentions: op.totalMentions,
        daysActive,
        velocity: Math.round((op.totalMentions / daysActive) * 100) / 100,
        channels: op.channelCount || 1,
        earliestSeen: op.earliestSeen || null,
      };
    })
    .sort((a, b) => b.velocity - a.velocity);

  const allCounts = ops.map((op) => op.totalMentions || 0);
  const maxMentions = allCounts.length ? Math.max(...allCounts) : 0;
  const avgMentions = allCounts.length
    ? Math.round(allCounts.reduce((s, n) => s + n, 0) / allCounts.length)
    : 0;

  const bucketDefs = [
    { label: '1', min: 1, max: 1 },
    { label: '2–5', min: 2, max: 5 },
    { label: '6–20', min: 6, max: 20 },
    { label: '21–50', min: 21, max: 50 },
    { label: '51+', min: 51, max: Infinity },
  ];

  const total = allCounts.length;
  const buckets = bucketDefs.map(({ label, min, max }) => {
    const count = allCounts.filter((c) => c >= min && c <= max).length;
    return { label, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });

  return {
    buckets,
    top10ByVelocity: withVelocity.slice(0, 10),
    maxMentions,
    avgMentions,
    totalOperators: ops.length,
  };
}

// ── 3. NAME SEMIOTICS ────────────────────────────────────────────────────────

const NATURE_WORDS = [
  'ฝน', 'ดาว', 'ใบไม้', 'ดอกไม้', 'แสง', 'จันทร์', 'ฟ้า', 'หยก', 'ทะเล',
  'ลม', 'น้ำ', 'กุหลาบ', 'เดือน', 'มาลี', 'คำ', 'หอม', 'นาง', 'ฟ้า',
  'เมฆ', 'พราว', 'อรุณ', 'พระอาทิตย์', 'สายน้ำ',
];

function isEnglishName(name) {
  return /^[A-Za-z0-9\s .&@()'/-]+$/.test(name.trim());
}

function isNongName(name) {
  return name.includes('น้อง');
}

function isNatureName(name) {
  return !isNongName(name) && NATURE_WORDS.some((w) => name.includes(w));
}

function isShopName(name) {
  return !isNongName(name) && !isEnglishName(name) &&
    ['Spa', 'spa', 'นวด', 'Massage', 'massage', 'สปา', 'มาส', 'อโรมา'].some((w) => name.includes(w));
}

function computeNameCorpus(feed, data) {
  const raw = [
    ...feed.map((e) => e.name || ''),
    ...data.map((e) => e.name || ''),
  ]
    .map((n) => n.trim())
    .filter((n) => n.length > 2 && !n.startsWith('http') && !n.startsWith('www') && !n.startsWith('@'));

  const unique = [...new Set(raw)];
  const total = unique.length;

  const nong = unique.filter(isNongName);
  const english = unique.filter((n) => !isNongName(n) && isEnglishName(n));
  const nature = unique.filter(isNatureName);
  const shop = unique.filter(isShopName);
  const other = unique.filter(
    (n) => !isNongName(n) && !isEnglishName(n) && !isNatureName(n) && !isShopName(n),
  );

  // Gallery: curated sample across categories
  const gallery = [
    ...nong.slice(0, 6),
    ...nature.slice(0, 8),
    ...english.slice(0, 8),
    ...shop.slice(0, 8),
  ].slice(0, 30);

  return {
    total,
    nongPrefix: { count: nong.length, pct: Math.round((nong.length / total) * 100), examples: nong.slice(0, 10) },
    englishNames: { count: english.length, pct: Math.round((english.length / total) * 100), examples: english.slice(0, 10) },
    natureNames: { count: nature.length, pct: Math.round((nature.length / total) * 100), examples: nature.slice(0, 10) },
    shopNames: { count: shop.length, pct: Math.round((shop.length / total) * 100), examples: shop.slice(0, 10) },
    other: { count: other.length, pct: Math.round((other.length / total) * 100) },
    gallery,
  };
}

// ── 4. SERVICE LEXICON ───────────────────────────────────────────────────────

const TH_TERMS = [
  'นวดไทย', 'นวดน้ำมัน', 'อโรมา', 'เพื่อสุขภาพ', 'กดจุด', 'นวดเท้า',
  'นวดฝ่าเท้า', 'นวดตัว', 'บอดี้', 'ฟรีสไตล์', 'น้องใหม่', 'หุ่นดี',
  'จองคิว', 'ผ่อนคลาย', 'สาวสวย', 'ราคาพิเศษ', 'เปิดให้บริการ',
  'ไม่เร่งงาน', 'บริการพิเศษ', 'อาบอบนวด', 'นวด', 'สปา',
];

const EN_TERMS = [
  'massage', 'spa', 'oil massage', 'aroma', 'thai massage', 'foot massage',
  'body to body', 'b2b', 'relaxing', 'model', 'outcall', 'healthy',
  'new girl', 'booking', 'special', 'gfe',
];

function computeServiceLexicon(feed, data) {
  const allText = [
    ...feed.map((e) => (e.description || '') + ' ' + (e.name || '')),
    ...data.map((e) => (e.description || '') + ' ' + (e.name || '')),
    ...data.flatMap((e) => [...(e.serviceTags || []), ...(e.tags || [])]),
  ]
    .join(' ')
    .toLowerCase();

  const results = [];

  for (const term of TH_TERMS) {
    const regex = new RegExp(term, 'g');
    const count = (allText.match(regex) || []).length;
    if (count > 0) results.push({ term, count, lang: 'TH' });
  }

  for (const term of EN_TERMS) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const count = (allText.match(regex) || []).length;
    if (count > 0) results.push({ term, count, lang: 'EN' });
  }

  results.sort((a, b) => b.count - a.count);

  const top40 = results.slice(0, 40);
  return {
    top40,
    thaiCount: top40.filter((t) => t.lang === 'TH').length,
    englishCount: top40.filter((t) => t.lang === 'EN').length,
  };
}

// ── 5. CROSS-POSTING ─────────────────────────────────────────────────────────

function computeCrossPosting(feed, patterns) {
  const crossPosted = feed.filter((e) => {
    const cp = e.crossPostedOn;
    return Array.isArray(cp) && cp.length > 0;
  });

  const multiChannel = ((patterns && patterns.operators) || []).filter(
    (op) => (op.channelCount || 1) > 1,
  );

  return {
    crossPostedCount: crossPosted.length,
    totalMessages: feed.length,
    crossPostRate: feed.length ? Math.round((crossPosted.length / feed.length) * 100) : 0,
    multiChannelOperators: multiChannel.length,
    totalOperators: ((patterns && patterns.operators) || []).length,
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sociology] Loading source files…');
  const feed = read('feed.json') || [];
  const data = read('data.json') || [];
  const patterns = read('patterns.json');

  console.log(`[sociology] feed: ${feed.length} messages | data: ${data.length} listings | operators: ${(patterns?.operators || []).length}`);

  const temporal = computeTemporalAnxiety(feed);
  console.log(`[sociology] temporal: peak at ${temporal.peakAnxietyWindow.startHour}:00–${temporal.peakAnxietyWindow.endHour}:00 (${temporal.peakAnxietyWindow.count} msgs)`);

  const mentions = computeMentionDistribution(patterns);
  console.log(`[sociology] mentions: max ${mentions.maxMentions}, avg ${mentions.avgMentions}, top velocity ${mentions.top10ByVelocity[0]?.velocity}/day`);

  const names = computeNameCorpus(feed, data);
  console.log(`[sociology] names: ${names.total} unique | น้อง ${names.nongPrefix.count} | EN ${names.englishNames.count} | nature ${names.natureNames.count}`);

  const lexicon = computeServiceLexicon(feed, data);
  console.log(`[sociology] lexicon: ${lexicon.top40.length} terms (TH:${lexicon.thaiCount} EN:${lexicon.englishCount})`);

  const crossPosting = computeCrossPosting(feed, patterns);
  console.log(`[sociology] cross-posting: ${crossPosting.crossPostRate}% of messages (${crossPosting.crossPostedCount}/${crossPosting.totalMessages})`);

  const out = {
    generatedAt: new Date().toISOString(),
    temporal,
    mentions,
    names,
    lexicon,
    crossPosting,
  };

  const outPath = path.join(ROOT, 'public', 'sociology.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[sociology] ✓ Written to ${outPath}`);
}

main().catch((e) => {
  console.error('[sociology] Fatal:', e);
  process.exit(1);
});
