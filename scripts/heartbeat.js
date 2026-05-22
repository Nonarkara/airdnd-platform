#!/usr/bin/env node
/*
 * Sabai Sabai — overnight heartbeat.
 *
 * Runs every 30 min via launchd. Three jobs in priority order:
 *   1. Pull a fresh snapshot from Supabase → public/data.json
 *   2. Compute pipeline-health metrics (data freshness, listing count,
 *      coordinate coverage, signal/noise per channel) and append them to
 *      logs/heartbeat.jsonl as one JSON line per run.
 *   3. If the freshest listing in Supabase is more than 4 hours old, write
 *      a stall flag to logs/heartbeat.stall — the launchd job's stderr is
 *      tee'd into Console so the operator can spot it after sleep.
 *
 * Stays on the side of doing-no-harm: only inserts to logs/, only reads
 * from Supabase, never touches `companions` or migrations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { canonicalizePublicListings } from '../src/lib/listing_contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const STALL_THRESHOLD_MS = 4 * 60 * 60 * 1000;   // 4 hours
const CHILD_JOB_TIMEOUT_MS = 60 * 1000;
const LOG_DIR = path.join(ROOT, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function pullSnapshot() {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw new Error(`supabase: ${error.message}`);
  return data || [];
}

function writeSnapshot(rows) {
  const publicListings = canonicalizePublicListings(rows, { source: 'snapshot' });
  const slim = publicListings.map((l) => ({
    id: l.id,
    canonicalKey: l.canonicalKey,
    name: l.name,
    age: l.age,
    location: l.location,
    city: l.city,
    priceLabel: l.priceLabel,
    priceValue: l.priceValue,
    description: l.description,
    tags: l.tags,
    metrics: l.metrics,
    imageUrl: l.imageUrl,
    rating: l.rating,
    reviews: l.reviews,
    updatedAt: l.updatedAt,
    postedAt: l.postedAt,
    createdAt: l.createdAt,
    userFeedbackSummary: l.userFeedbackSummary,
    serviceTags: l.serviceTags,
    sourceChannel: l.sourceChannel,
    sourceTarget: l.sourceTarget,
    phone: l.phone,
    hours: l.hours,
    lineUrl: l.lineUrl,
    telegramUrl: l.telegramUrl,
    mapsUrl: l.mapsUrl,
    latitude: l.latitude,
    longitude: l.longitude,
    isSafeImage: l.isSafeImage,
    mentionCount: l.mentionCount,
  })).sort((left, right) => {
    const leftTime = new Date(left.postedAt || left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.postedAt || right.updatedAt || right.createdAt || 0).getTime();
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
  fs.writeFileSync(path.join(ROOT, 'public', 'data.json'), JSON.stringify(slim, null, 2));
  return slim.length;
}

function computeHealth(rows) {
  const total = rows.length;
  if (total === 0) return { total: 0, ok: false };
  const newest = rows.reduce((latest, r) => {
    const t = new Date(r.updated_at || r.created_at).getTime();
    return Number.isFinite(t) && t > latest ? t : latest;
  }, 0);
  const ageMs = Date.now() - newest;
  const withCoords = rows.filter((r) => r.latitude && r.longitude).length;
  const withPhone = rows.filter((r) => r.phone).length;
  const stale = ageMs > STALL_THRESHOLD_MS;
  // Per-channel signal-to-noise approximation: ratio of unique listings to
  // total mentions on that channel — higher = more genuine discovery.
  const channelStats = new Map();
  rows.forEach((r) => {
    const ch = r.source_channel || 'unknown';
    const stat = channelStats.get(ch) || { listings: 0, mentions: 0 };
    stat.listings += 1;
    stat.mentions += Number(r.mention_count) || 1;
    channelStats.set(ch, stat);
  });
  const channelSnr = [...channelStats.entries()]
    .map(([ch, s]) => ({ ch, listings: s.listings, mentions: s.mentions, snr: s.listings / s.mentions }))
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 6);
  return {
    ok: !stale,
    total,
    newestAt: new Date(newest).toISOString(),
    ageHours: +(ageMs / 3_600_000).toFixed(2),
    coordRate: +(withCoords / total).toFixed(3),
    phoneRate: +(withPhone / total).toFixed(3),
    channelSnr,
    stale,
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  let entry = { startedAt, snapshotCount: null, error: null };
  try {
    const rows = await pullSnapshot();
    const written = writeSnapshot(rows);
    entry.snapshotCount = written;
    entry = { ...entry, ...computeHealth(rows) };
    if (entry.stale) {
      fs.writeFileSync(
        path.join(LOG_DIR, 'heartbeat.stall'),
        JSON.stringify(entry, null, 2),
      );
    } else {
      try { fs.unlinkSync(path.join(LOG_DIR, 'heartbeat.stall')); } catch (e) { /* ignore */ }
    }
    // Refresh the feed snapshot — keeps the abundance feed fresh.
    try {
      execSync('node scripts/refresh_feed_snapshot.js', {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: CHILD_JOB_TIMEOUT_MS,
      });
      entry.feedRegenerated = true;
    } catch (err) {
      entry.feedRegenerated = false;
      entry.feedError = err.message?.slice(0, 200);
    }
    // Recompute the six product patterns (Methodology §08).
    try {
      execSync('node scripts/compute_patterns.js', {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: CHILD_JOB_TIMEOUT_MS,
      });
      entry.patternsRegenerated = true;
    } catch (err) {
      entry.patternsRegenerated = false;
      entry.patternsError = err.message?.slice(0, 200);
    }
    // Auto-regenerate OG cards when data changes — keeps share previews fresh.
    try {
      execSync('node scripts/generate_og_cards.js', {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: CHILD_JOB_TIMEOUT_MS,
      });
      entry.ogCardsRegenerated = true;
    } catch (err) {
      entry.ogCardsRegenerated = false;
      entry.ogCardsError = err.message?.slice(0, 200);
    }
  } catch (err) {
    entry.error = err.message;
  } finally {
    entry.finishedAt = new Date().toISOString();
    fs.appendFileSync(
      path.join(LOG_DIR, 'heartbeat.jsonl'),
      `${JSON.stringify(entry)}\n`,
    );
    console.log(JSON.stringify({ summary: { ok: entry.ok ?? false, total: entry.snapshotCount, ageHours: entry.ageHours, error: entry.error } }));
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
