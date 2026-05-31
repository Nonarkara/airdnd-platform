#!/usr/bin/env node
/*
 * Sabai Sabai — Field Research Engine.
 *
 * Dr Non gives the framework; the data crunches itself. This script pulls the
 * raw Telegram archive from Supabase (channel_messages, ~85k messages, 2020→
 * present) and computes an unsupervised sociological read of an informal-labour
 * market that has never been measured this way:
 *
 *   1. TEMPORAL RHYTHM   — when do operators actually broadcast? Hour-of-day and
 *      day-of-week in Bangkok time; the daily volume; the "pilot post" rate
 *      (operator-days with a single solo post vs. flooding days).
 *   2. POSTING INTERVALS — the gap between one operator's consecutive posts;
 *      burstiness; the fastest re-post; the compulsive re-broadcasters.
 *   3. REPEAT & CROSS-POST — text-fingerprinting finds identical posts repeated
 *      over time and the same post sprayed across multiple channels.
 *   4. DEMAND QUERIES    — what customers actually ask: booking vs. price vs.
 *      availability vs. location vs. hours. The market's revealed priorities.
 *
 * Output: public/research.json — consumed by the Field Notes page + a subtle
 * hero insight. No human crunches anything; the equation runs on its own.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const TZ_OFFSET_HOURS = 7; // Bangkok = UTC+7
const PAGE = 1000;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[research] Missing Supabase credentials in .env');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- helpers ---------------------------------------------------------------

function bkk(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + TZ_OFFSET_HOURS * 3600 * 1000);
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function round(n, p = 1) {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

// Fingerprint a post so identical broadcasts collapse together regardless of
// emoji/whitespace noise. Keeps Thai/Latin/digits; strips the rest.
function fingerprint(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^฀-๿a-z0-9]+/g, '')
    .slice(0, 160);
}

async function pullAll(type, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('channel_messages')
      .select(columns)
      .eq('message_type', type)
      .order('message_date', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(`[research] pull ${type} error:`, error.message); break; }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function countIlike(type, patterns) {
  let total = 0;
  for (const p of patterns) {
    const { count } = await sb
      .from('channel_messages')
      .select('*', { count: 'exact', head: true })
      .eq('message_type', type)
      .ilike('message_text', p);
    total += count || 0;
  }
  return total;
}

// ---- analyses --------------------------------------------------------------

function computeTemporal(listings) {
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const dow = DAY_LABELS.map((label, i) => ({ day: i, label, count: 0 }));
  const perDay = new Map();           // YYYY-MM-DD -> count
  const opDay = new Map();            // op|day -> count (for pilot-post rate)

  for (const m of listings) {
    const d = bkk(m.message_date);
    if (!d) continue;
    hourly[d.getUTCHours()].count += 1;
    dow[d.getUTCDay()].count += 1;
    const dayKey = d.toISOString().slice(0, 10);
    perDay.set(dayKey, (perDay.get(dayKey) || 0) + 1);
    const op = m.channel_name || m.sender_id || 'unknown';
    const odk = `${op}|${dayKey}`;
    opDay.set(odk, (opDay.get(odk) || 0) + 1);
  }

  // 3-hour peak window
  let peak = { startHour: 0, count: -1 };
  for (let h = 0; h < 24; h += 1) {
    const c = hourly[h].count + hourly[(h + 1) % 24].count + hourly[(h + 2) % 24].count;
    if (c > peak.count) peak = { startHour: h, endHour: (h + 3) % 24, count: c };
  }

  const dayCounts = [...perDay.values()];
  const opDayCounts = [...opDay.values()];
  const pilotDays = opDayCounts.filter((c) => c === 1).length;
  const floodDays = opDayCounts.filter((c) => c >= 5).length;

  return {
    hourly,
    dayOfWeek: dow,
    peakWindow: peak,
    totalPosts: listings.length,
    activeDays: perDay.size,
    postsPerDay: { median: round(median(dayCounts)), max: Math.max(0, ...dayCounts), mean: round(dayCounts.reduce((a, b) => a + b, 0) / (dayCounts.length || 1)) },
    pilotPostRate: round((pilotDays / (opDayCounts.length || 1)) * 100),
    floodDayRate: round((floodDays / (opDayCounts.length || 1)) * 100),
    maxPostsInOperatorDay: Math.max(0, ...opDayCounts),
  };
}

function computeIntervals(listings) {
  // group consecutive posts per operator (channel), compute hour gaps
  const byOp = new Map();
  for (const m of listings) {
    const op = m.channel_name || m.sender_id || 'unknown';
    if (!byOp.has(op)) byOp.set(op, []);
    const d = bkk(m.message_date);
    if (d) byOp.get(op).push(d.getTime());
  }
  const allGaps = [];
  const opStats = [];
  for (const [op, times] of byOp) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < times.length; i += 1) {
      const h = (times[i] - times[i - 1]) / 3600000;
      if (h >= 0 && h < 24 * 60) { gaps.push(h); allGaps.push(h); }
    }
    if (!gaps.length) continue;
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
    opStats.push({
      operator: op,
      posts: times.length,
      medianGapHours: round(median(gaps)),
      minGapMinutes: round(Math.min(...gaps) * 60),
      burstiness: round(mean > 0 ? Math.sqrt(variance) / mean : 0, 2), // CV
    });
  }
  opStats.sort((a, b) => b.posts - a.posts);

  // interval distribution buckets (hours)
  const buckets = [
    { label: '< 1h', lo: 0, hi: 1, count: 0 },
    { label: '1–3h', lo: 1, hi: 3, count: 0 },
    { label: '3–6h', lo: 3, hi: 6, count: 0 },
    { label: '6–12h', lo: 6, hi: 12, count: 0 },
    { label: '12–24h', lo: 12, hi: 24, count: 0 },
    { label: '> 24h', lo: 24, hi: Infinity, count: 0 },
  ];
  for (const g of allGaps) {
    const b = buckets.find((x) => g >= x.lo && g < x.hi);
    if (b) b.count += 1;
  }
  const totalGaps = allGaps.length || 1;
  buckets.forEach((b) => { b.pct = round((b.count / totalGaps) * 100); });

  return {
    medianIntervalHours: round(median(allGaps)),
    fastestRepostMinutes: round(Math.min(Infinity, ...allGaps) * 60),
    buckets,
    topRepeaters: opStats.slice(0, 10),
    operatorsTracked: opStats.length,
  };
}

function computeRepeatAndCross(listings) {
  const groups = new Map(); // fingerprint -> { channels:Set, times:[], count }
  for (const m of listings) {
    const fp = fingerprint(m.message_text);
    if (fp.length < 24) continue; // ignore trivially short posts
    if (!groups.has(fp)) groups.set(fp, { channels: new Set(), times: [], count: 0, sample: m.message_text });
    const g = groups.get(fp);
    g.channels.add(m.channel_name || 'unknown');
    const d = bkk(m.message_date);
    if (d) g.times.push(d.getTime());
    g.count += 1;
  }

  let totalPosts = 0;
  let duplicatePosts = 0;
  let crossPostedGroups = 0;
  let maxRepeats = 0;
  let maxChannels = 0;
  const repeatGaps = [];
  const channelSpreads = [];
  for (const g of groups.values()) {
    totalPosts += g.count;
    if (g.count > 1) duplicatePosts += g.count - 1;
    if (g.count > maxRepeats) maxRepeats = g.count;
    const nCh = g.channels.size;
    if (nCh > 1) { crossPostedGroups += 1; channelSpreads.push(nCh); }
    if (nCh > maxChannels) maxChannels = nCh;
    if (g.times.length > 1) {
      g.times.sort((a, b) => a - b);
      for (let i = 1; i < g.times.length; i += 1) {
        const h = (g.times[i] - g.times[i - 1]) / 3600000;
        if (h >= 0 && h < 24 * 90) repeatGaps.push(h);
      }
    }
  }
  return {
    uniquePosts: groups.size,
    totalPosts,
    repeatRate: round((duplicatePosts / (totalPosts || 1)) * 100),
    maxRepeatsOfOnePost: maxRepeats,
    medianRepeatGapHours: round(median(repeatGaps)),
    crossPostedGroups,
    crossPostRate: round((crossPostedGroups / (groups.size || 1)) * 100),
    maxChannelsForOnePost: maxChannels,
    avgChannelsWhenCrossed: round(channelSpreads.reduce((a, b) => a + b, 0) / (channelSpreads.length || 1), 2),
  };
}

function pickExamples(messages, patterns, n = 4) {
  const out = [];
  for (const m of messages) {
    const t = (m.message_text || '').trim();
    if (t.length < 5 || t.length > 80) continue;
    if (patterns.some((p) => t.includes(p))) {
      const clean = t.replace(/\s+/g, ' ');
      if (!out.includes(clean)) out.push(clean);
    }
    if (out.length >= n) break;
  }
  return out;
}

async function computeQueries(convo) {
  // intent dictionaries (Thai)
  const intents = [
    { id: 'booking', label: 'Booking / queue', kw: ['จอง', 'นัด', 'คิวว่าง', 'วอล์คอิน', 'วอล์กอิน'], pats: ['%จอง%', '%นัด%', '%คิวว่าง%'] },
    { id: 'inquire', label: 'General inquiry', kw: ['สอบถาม'], pats: ['%สอบถาม%'] },
    { id: 'price', label: 'Price / cost', kw: ['ราคา', 'เท่าไหร่', 'เท่าไร', 'กี่บาท', 'ค่าบริการ', 'ค่าใช้จ่าย'], pats: ['%ราคา%', '%เท่าไหร่%', '%เท่าไร%', '%กี่บาท%', '%ค่าบริการ%', '%ค่าใช้จ่าย%'] },
    { id: 'availability', label: 'Availability', kw: ['ว่างไหม', 'ว่างมั้ย', 'มีน้อง', 'มีคิว', 'ว่างมั้ยคะ'], pats: ['%ว่างไหม%', '%ว่างมั้ย%', '%มีน้อง%', '%มีคิว%'] },
    { id: 'location', label: 'Location', kw: ['ที่ไหน', 'อยู่ไหน', 'แถวไหน', 'พิกัด'], pats: ['%ที่ไหน%', '%อยู่ไหน%', '%แถวไหน%'] },
    { id: 'hours', label: 'Hours', kw: ['กี่โมง', 'เปิดกี่', 'ปิดกี่'], pats: ['%กี่โมง%', '%เปิดกี่%', '%ปิดกี่%'] },
  ];

  const results = [];
  for (const it of intents) {
    // count across discussion + feedback in the DB (authoritative)
    const cDisc = await countIlike('discussion', it.pats);
    const cFeed = await countIlike('feedback', it.pats);
    const examples = pickExamples(convo, it.kw, 4);
    results.push({ id: it.id, label: it.label, count: cDisc + cFeed, examples });
  }
  results.sort((a, b) => b.count - a.count);
  const total = results.reduce((s, r) => s + r.count, 0) || 1;
  results.forEach((r) => { r.pct = round((r.count / total) * 100); });

  const booking = results.find((r) => r.id === 'booking')?.count || 0;
  const price = results.find((r) => r.id === 'price')?.count || 0;
  return { intents: results, bookingToPriceRatio: round(booking / (price || 1), 1) };
}

// ---- main ------------------------------------------------------------------

async function main() {
  console.log('[research] pulling corpus from Supabase…');

  const [{ count: total }, listings, discussions, feedback] = await Promise.all([
    sb.from('channel_messages').select('*', { count: 'exact', head: true }),
    pullAll('listing', 'channel_name, sender_id, message_date, cluster_id, message_text'),
    pullAll('discussion', 'channel_name, message_date, message_text'),
    pullAll('feedback', 'channel_name, message_date, message_text'),
  ]);

  console.log(`[research] listings=${listings.length} discussions=${discussions.length} feedback=${feedback.length} total=${total}`);

  const convo = [...discussions, ...feedback];
  const dates = listings.map((m) => m.message_date).filter(Boolean).sort();
  const channels = new Set(listings.map((m) => m.channel_name).filter(Boolean));

  const temporal = computeTemporal(listings);
  const intervals = computeIntervals(listings);
  const repeat = computeRepeatAndCross(listings);
  const queries = await computeQueries(convo);

  const out = {
    generatedAt: new Date().toISOString(),
    corpus: {
      totalMessages: total,
      listingPosts: listings.length,
      conversations: convo.length,
      channels: channels.size,
      firstSeen: dates[0] || null,
      lastSeen: dates[dates.length - 1] || null,
    },
    temporal,
    intervals,
    repeat,
    queries,
  };

  const outPath = path.join(ROOT, 'public', 'research.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`[research] wrote ${outPath}`);
  console.log(JSON.stringify({
    peakWindow: temporal.peakWindow,
    pilotPostRate: temporal.pilotPostRate,
    medianInterval: intervals.medianIntervalHours,
    fastestRepostMin: intervals.fastestRepostMinutes,
    repeatRate: repeat.repeatRate,
    maxRepeats: repeat.maxRepeatsOfOnePost,
    crossPostRate: repeat.crossPostRate,
    bookingToPrice: queries.bookingToPriceRatio,
    topQuery: queries.intents[0]?.label,
  }, null, 2));
}

main().catch((e) => { console.error('[research] fatal:', e); process.exit(1); });
