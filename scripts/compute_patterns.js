#!/usr/bin/env node
/*
 * Sabai Sabai — compute the six product patterns described in
 * Methodology §08. Reads everything once, computes each pattern as a
 * discrete data set, writes one consolidated public/patterns.json that
 * the Analytics page renders client-side.
 *
 * Design choice: bake the heavy mining at build time, not runtime, so
 * the live site doesn't have to query the corpus on every visit.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDataClient } from './lib/data_store.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

// Reads whichever store the scraper writes to (LOCAL_DB=1 → local SQLite).
const supabase = await openDataClient('compute_patterns');

const PAGE = 1000;
async function pullAll(table, columns = '*') {
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 100_000) break;
  }
  return all;
}

function normPhone(s) { return String(s || '').replace(/\D/g, ''); }
function normName(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

// ── Pattern 1 — Operator Profile Builder ─────────────────────────────────
// Group by phone_normalized; treat each phone as one operator entity.
// One operator with multiple staff aliases / branches becomes one card.
function operatorProfiles(companions) {
  const byPhone = new Map();
  for (const c of companions) {
    const key = normPhone(c.phone_normalized || c.phone);
    if (!key || key.length < 8) continue;
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(c);
  }
  return [...byPhone.entries()]
    .filter(([, ls]) => ls.length >= 1)
    .map(([phone, listings]) => {
      const channels = new Set(listings.map((l) => l.source_channel).filter(Boolean));
      const totalMentions = listings.reduce((s, l) => s + (Number(l.mention_count) || 0), 0);
      const cities = [...new Set(listings.map((l) => l.city).filter(Boolean))];
      const aliases = listings.map((l) => l.name).filter(Boolean);
      const ids = listings.map((l) => l.id);
      const earliest = listings.reduce((min, l) => {
        const t = new Date(l.created_at).getTime();
        return Number.isFinite(t) && t < min ? t : min;
      }, Infinity);
      return {
        phone,
        operatorName: aliases[0] || `Operator ${phone.slice(-4)}`,
        branchCount: listings.length,
        aliasCount: new Set(aliases.map(normName)).size,
        aliases: aliases.slice(0, 12),
        channelCount: channels.size,
        channels: [...channels],
        cities,
        totalMentions,
        earliestSeen: Number.isFinite(earliest) ? new Date(earliest).toISOString() : null,
        listingIds: ids,
      };
    })
    .sort((a, b) => b.branchCount - a.branchCount || b.totalMentions - a.totalMentions);
}

// ── Pattern 2 — Provider Reputation Index ────────────────────────────────
// Mine Thai nicknames (น้องX / แม่X / พี่X / อ.X) and bare 2-12 char Thai
// names from descriptions + raw text. Each nickname → tracked entity with
// the listings it appears in, channels, and earliest/latest mention dates.
function providerReputation(companions) {
  const honorific = /(?:น้อง|แม่|พี่|อ\.\s*)([฀-๿\w]{2,16})/g;
  const STOP = new Set(['นวด','สปา','ร้าน','ใหม่','ใหญ่','สวย','สาว','สูง','สด','สบาย','sabai','sabaisabai','spa','massage','line','เปิด','โปรโมชั่น','โปรโมชั่นจองตอนนี้']);
  const idx = new Map();      // nickname → {listings: Set, mentions, channels: Set, earliest, latest}
  for (const c of companions) {
    const sources = [c.name, c.description, c.raw_text, c.discussion_notes].filter(Boolean).join(' ');
    const nicks = new Set();
    let m;
    while ((m = honorific.exec(sources)) !== null) {
      const nm = m[1].trim();
      if (nm.length >= 2 && !STOP.has(nm.toLowerCase())) nicks.add(nm);
    }
    nicks.forEach((n) => {
      const e = idx.get(n) || { listings: new Set(), channels: new Set(), mentions: 0, earliest: Infinity, latest: 0 };
      e.listings.add(c.id);
      if (c.source_channel) e.channels.add(c.source_channel);
      e.mentions += Number(c.mention_count) || 1;
      const ts = new Date(c.updated_at || c.created_at).getTime();
      if (Number.isFinite(ts)) {
        if (ts < e.earliest) e.earliest = ts;
        if (ts > e.latest) e.latest = ts;
      }
      idx.set(n, e);
    });
  }
  return [...idx.entries()]
    .map(([nickname, e]) => ({
      nickname,
      listingCount: e.listings.size,
      listingIds: [...e.listings],
      channelCount: e.channels.size,
      channels: [...e.channels],
      mentions: e.mentions,
      earliest: Number.isFinite(e.earliest) ? new Date(e.earliest).toISOString() : null,
      latest: e.latest > 0 ? new Date(e.latest).toISOString() : null,
      ageDays: Number.isFinite(e.earliest) && e.latest > 0 ? +((e.latest - e.earliest) / 86_400_000).toFixed(1) : 0,
    }))
    .filter((p) => p.listingCount >= 1)
    .sort((a, b) => b.listingCount - a.listingCount || b.mentions - a.mentions)
    .slice(0, 60);
}

// ── Pattern 3 — Channel Tiers ────────────────────────────────────────────
// SNR = unique listings / total mentions. Boutique = high SNR + low total
// volume. Aggregator = high volume + low SNR. Discovery rate is the inverse
// of redundancy — both have product use, framed differently.
function channelTiers(companions, messages) {
  const byChannel = new Map();
  for (const c of companions) {
    const ch = c.source_channel || 'unknown';
    const stat = byChannel.get(ch) || { channel: ch, listings: 0, mentions: 0, msgsTotal: 0, msgsListing: 0, msgsDiscussion: 0, msgsFeedback: 0, msgsSpam: 0 };
    stat.listings += 1;
    stat.mentions += Number(c.mention_count) || 1;
    byChannel.set(ch, stat);
  }
  for (const m of messages) {
    const ch = m.channel_name || 'unknown';
    const stat = byChannel.get(ch) || { channel: ch, listings: 0, mentions: 0, msgsTotal: 0, msgsListing: 0, msgsDiscussion: 0, msgsFeedback: 0, msgsSpam: 0 };
    stat.msgsTotal += 1;
    if (m.message_type === 'listing') stat.msgsListing += 1;
    else if (m.message_type === 'discussion') stat.msgsDiscussion += 1;
    else if (m.message_type === 'feedback') stat.msgsFeedback += 1;
    else if (m.message_type === 'spam') stat.msgsSpam += 1;
    byChannel.set(ch, stat);
  }
  const all = [...byChannel.values()].map((s) => ({
    ...s,
    snr: s.msgsTotal > 0 ? +(s.msgsListing / s.msgsTotal).toFixed(3) : 0,
    spamRate: s.msgsTotal > 0 ? +(s.msgsSpam / s.msgsTotal).toFixed(3) : 0,
  }));
  // Tier classification. Aggregators = msgsTotal > 1500. Boutique = msgsTotal ≤ 1500 with ≥ 5 listings.
  const aggregators = all.filter((s) => s.msgsTotal > 1500).sort((a, b) => b.msgsTotal - a.msgsTotal);
  const boutique = all.filter((s) => s.msgsTotal <= 1500 && s.listings >= 1).sort((a, b) => b.snr - a.snr || b.listings - a.listings);
  return { aggregators, boutique, all };
}

// ── Pattern 4 — Geographic Heat Forecasting ──────────────────────────────
// Soi/road/district mentions across the corpus. Compute a "heat" rank
// and an advisory label per area: HOT (top quartile), WARM, COOL, EMERGING.
function geoHeat(companions, messages) {
  const SOI_RE = /(?:ซ\.|ซอย)\s*([฀-๿a-zA-Z0-9]{1,30})/g;
  const ROAD_RE = /(?:ถ\.|ถนน)\s*([฀-๿a-zA-Z0-9]{1,30})/g;
  const counts = { soi: new Map(), road: new Map() };
  const collect = (text, re, bucket) => {
    if (!text) return;
    let m;
    while ((m = re.exec(text)) !== null) {
      const term = (m[1] || m[0]).trim();
      if (term && term.length <= 28) bucket.set(term, (bucket.get(term) || 0) + 1);
    }
  };
  for (const m of messages) {
    if (!['listing', 'discussion', 'feedback'].includes(m.message_type)) continue;
    collect(m.message_text || '', SOI_RE, counts.soi);
    collect(m.message_text || '', ROAD_RE, counts.road);
  }
  for (const c of companions) {
    collect(c.location || '', SOI_RE, counts.soi);
    collect(c.location || '', ROAD_RE, counts.road);
  }
  const shape = (m) => {
    const arr = [...m.entries()].sort((a, b) => b[1] - a[1]);
    if (arr.length === 0) return [];
    const max = arr[0][1];
    const q1 = arr[Math.floor(arr.length * 0.25)]?.[1] || 0;
    const q3 = arr[Math.floor(arr.length * 0.75)]?.[1] || 0;
    return arr.slice(0, 25).map(([term, count]) => {
      let advisory;
      if (count >= q1) advisory = 'HOT';
      else if (count >= q3) advisory = 'WARM';
      else advisory = 'EMERGING';
      const heat = max > 0 ? +((count / max) * 100).toFixed(1) : 0;
      return { term, count, heat, advisory };
    });
  };
  return { soi: shape(counts.soi), road: shape(counts.road) };
}

// ── Pattern 5 — Photo-Reuse Fingerprinting ───────────────────────────────
// Same image_url shared across multiple listings = strong duplicate signal.
// Same original_filename across multiple linked_companion_ids in
// photo_archive = same source upload reused. Returns a per-listing
// authenticity penalty count.
function photoFingerprint(companions, photos) {
  const urlOwners = new Map();
  for (const c of companions) {
    if (!c.image_url || c.image_url.startsWith('/mockups/')) continue;
    if (!urlOwners.has(c.image_url)) urlOwners.set(c.image_url, []);
    urlOwners.get(c.image_url).push({ id: c.id, name: c.name });
  }
  const reusedHero = [...urlOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([url, owners]) => ({ url, listingCount: owners.length, listings: owners }));

  const filenameOwners = new Map();
  for (const p of photos) {
    if (!p.original_filename || p.linked_companion_id == null) continue;
    if (!filenameOwners.has(p.original_filename)) filenameOwners.set(p.original_filename, new Set());
    filenameOwners.get(p.original_filename).add(p.linked_companion_id);
  }
  const reusedFilenames = [...filenameOwners.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([fn, owners]) => ({ filename: fn, listingCount: owners.size, listings: [...owners] }));

  // Per-listing penalty: how many of its hero / filename slots are shared with another listing.
  const penaltyByListing = new Map();
  for (const { listings } of reusedHero) {
    for (const l of listings) {
      penaltyByListing.set(l.id, (penaltyByListing.get(l.id) || 0) + 1);
    }
  }
  return {
    reusedHero,
    reusedFilenames: reusedFilenames.slice(0, 40),
    penalisedListingCount: penaltyByListing.size,
  };
}

// ── Pattern 6 — Whisper Network Safety ───────────────────────────────────
// Mine discussion / feedback messages for negative idioms. Match each hit
// to a listing by fuzzy name overlap (since linked_companion_id is null
// today — see findings §1.1). Surface as per-listing safety advisory.
const NEGATIVE_IDIOMS = [
  // Thai
  ['อย่าไป', 'don\'t go', 'avoid'],
  ['อย่าจอง', 'don\'t book', 'do not book'],
  ['ไม่ดี', 'not good', 'low quality'],
  ['ไม่แนะนำ', 'do not recommend', 'avoid'],
  ['ห้ามไป', 'do not go', 'forbidden'],
  ['โดนหลอก', 'was scammed', 'scam'],
  ['ไม่จริง', 'not real', 'fake'],
  ['ปลอม', 'fake', 'counterfeit'],
  ['งานเร่ง', 'rushed service', 'rushed'],
  ['ไม่สะอาด', 'not clean', 'unclean'],
  ['แพง', 'expensive', 'overpriced'],
  ['โกง', 'cheated', 'fraud'],
  ['น้องไม่ดี', 'masseuse poor', 'poor masseuse'],
  // English
  ['scam', 'scam alert', 'scam'],
  ['fake', 'fake images', 'fake'],
  ['bait and switch', 'bait and switch', 'bait-switch'],
  ['rude', 'rude staff', 'rude'],
];
function whisperSafety(companions, messages) {
  const idiomHitsByListing = new Map();        // listing id → array of hits
  const seenIdiomCount = new Map();             // idiom → total occurrences
  const lookup = NEGATIVE_IDIOMS.map(([thai, en, label]) => ({
    re: new RegExp(thai.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
    label,
  }));

  // Build a name index for fast fuzzy lookup
  const nameIndex = companions.map((c) => ({
    id: c.id,
    name: c.name,
    nameLow: normName(c.name),
    phoneNorm: normPhone(c.phone_normalized || c.phone),
  })).filter((c) => c.nameLow && c.nameLow.length >= 4);

  for (const m of messages) {
    if (!['discussion', 'feedback'].includes(m.message_type)) continue;
    const txt = m.message_text || '';
    if (!txt) continue;
    const hits = [];
    for (const { re, label } of lookup) {
      if (re.test(txt)) {
        hits.push(label);
        seenIdiomCount.set(label, (seenIdiomCount.get(label) || 0) + 1);
      }
    }
    if (hits.length === 0) continue;
    // Match listing by name overlap in this message text
    const lowText = txt.toLowerCase();
    for (const c of nameIndex) {
      if (c.nameLow.length >= 6 && lowText.includes(c.nameLow)) {
        const arr = idiomHitsByListing.get(c.id) || [];
        for (const h of hits) {
          arr.push({
            idiom: h,
            channel: m.channel_name,
            messageDate: m.message_date,
            snippet: txt.slice(0, 220),
          });
        }
        idiomHitsByListing.set(c.id, arr);
        break;          // one listing match per message is enough
      }
    }
  }
  return {
    idiomFrequency: [...seenIdiomCount.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    flaggedListings: [...idiomHitsByListing.entries()].map(([id, hits]) => ({
      id,
      flagCount: hits.length,
      idioms: [...new Set(hits.map((h) => h.idiom))],
      mostRecent: hits.sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate)).slice(0, 3),
    })).sort((a, b) => b.flagCount - a.flagCount),
  };
}

// ── Driver ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Compute patterns ===');
  const t0 = Date.now();

  console.log('pulling companions...');
  const companions = await pullAll('companions');
  console.log(`  ${companions.length}`);
  console.log('pulling channel_messages...');
  const messages = await pullAll('channel_messages',
    'id,channel_name,message_type,message_text,message_date,linked_companion_id,grouped_id,has_media');
  console.log(`  ${messages.length}`);
  console.log('pulling photo_archive...');
  const photos = await pullAll('photo_archive',
    'id,linked_companion_id,original_filename,file_size_bytes');
  console.log(`  ${photos.length}`);

  console.log('computing patterns...');
  const out = {
    generatedAt: new Date().toISOString(),
    counts: { companions: companions.length, messages: messages.length, photos: photos.length },
    operators: operatorProfiles(companions),
    providers: providerReputation(companions),
    channelTiers: channelTiers(companions, messages),
    geoHeat: geoHeat(companions, messages),
    photoFingerprint: photoFingerprint(companions, photos),
    whisperSafety: whisperSafety(companions, messages),
  };

  fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'public', 'patterns.json'), JSON.stringify(out, null, 0));
  const stat = fs.statSync(path.join(ROOT, 'public', 'patterns.json'));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s · patterns.json ${(stat.size / 1024).toFixed(1)} kB`);
  console.log(`  operators: ${out.operators.length}, providers: ${out.providers.length}`);
  console.log(`  channels: ${out.channelTiers.aggregators.length} aggregators + ${out.channelTiers.boutique.length} boutique`);
  console.log(`  geo: ${out.geoHeat.soi.length} sois + ${out.geoHeat.road.length} roads`);
  console.log(`  photos: ${out.photoFingerprint.reusedHero.length} reused hero, ${out.photoFingerprint.reusedFilenames.length} reused filenames`);
  console.log(`  whisper: ${out.whisperSafety.flaggedListings.length} flagged listings, ${out.whisperSafety.idiomFrequency.length} idioms tracked`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
