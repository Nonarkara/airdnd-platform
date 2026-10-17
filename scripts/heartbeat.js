#!/usr/bin/env node
/*
 * Sabai Sabai — overnight heartbeat.
 *
 * Runs every 30 min via launchd. Three jobs in priority order:
 *   1. Pull a fresh snapshot from Supabase, falling back to the snapshot
 *      written by the Telegram collector when Supabase is unavailable.
 *   2. Compute pipeline-health metrics (collector pulse, data freshness,
 *      listing count, coordinate coverage, signal/noise per channel) and
 *      append them to logs/heartbeat.jsonl as one JSON line per run.
 *   3. If the Telegram collector pulse is stale, write a stall flag to
 *      logs/heartbeat.stall. Quiet source channels are not a system failure.
 *
 * Stays on the side of doing-no-harm: reads remote stores, writes only local
 * snapshots and logs, and never touches `companions` or migrations.
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
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const STALL_THRESHOLD_MS = 4 * 60 * 60 * 1000;   // 4 hours
const COLLECTOR_STALE_MS = 5 * 60 * 1000;          // 5 missed 30s cycles
const CHILD_JOB_TIMEOUT_MS = 60 * 1000;
const LOG_DIR = path.join(ROOT, 'logs');
const SNAPSHOT_FILE = path.join(ROOT, 'public', 'data.json');
const COLLECTOR_STATE_FILE = path.join(ROOT, '.sabai-scraper-state.json');
const ALERT_COOLDOWN_FILE = path.join(LOG_DIR, 'heartbeat.alert.last');
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;  // don't re-alert within 4h
fs.mkdirSync(LOG_DIR, { recursive: true });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const NOTIFY_CHAT_ID = process.env.TELEGRAM_NOTIFY_CHAT_ID;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ── Operator alerting ────────────────────────────────────────────────────────
// Sends Telegram alerts when the pipeline is degraded. Rate-limited: no
// re-alert within 4 hours (ALERT_COOLDOWN_MS) to avoid spam during outages.

function canAlert() {
  try {
    const last = Number(fs.readFileSync(ALERT_COOLDOWN_FILE, 'utf8').trim());
    return Date.now() - last > ALERT_COOLDOWN_MS;
  } catch {
    return true; // no file = first alert
  }
}

function markAlerted() {
  fs.writeFileSync(ALERT_COOLDOWN_FILE, String(Date.now()));
}

async function sendAlert(text) {
  if (!BOT_TOKEN || !NOTIFY_CHAT_ID) return;
  if (!canAlert()) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: NOTIFY_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    markAlerted();
  } catch {
    // alerting failure is non-fatal — the system continues
  }
}

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
  // Keep the gallery: canonicalize() already merges Supabase photo_urls into
  // allPhotoUrls. Dropping the field here meant this 30-min writer stripped
  // every gallery the scraper had just attached — photos never reached deploy.
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
    allPhotoUrls: [...new Set(l.allPhotoUrls || [])].slice(0, 12),
    rating: l.rating,
    reviews: l.reviews,
    aliasNames: Array.isArray(l.aliasNames) ? l.aliasNames : [],
    aliasCount: l.aliasCount || ((l.aliasNames?.length || 0) + 1),
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

function readLocalSnapshot() {
  const rows = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('local snapshot is empty');
  }
  return rows;
}

function summarizeError(error) {
  return String(error?.message || error || 'unknown error')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function computeHealth(rows, nowMs = Date.now()) {
  const total = rows.length;
  if (total === 0) return { total: 0, ok: false };
  const newest = rows.reduce((latest, r) => {
    const t = new Date(
      r.postedAt || r.posted_at || r.updatedAt || r.updated_at || r.createdAt || r.created_at,
    ).getTime();
    return Number.isFinite(t) && t > latest ? t : latest;
  }, 0);
  const ageMs = nowMs - newest;
  const withCoords = rows.filter((r) => r.latitude && r.longitude).length;
  const withPhone = rows.filter((r) => r.phone).length;
  const dataStale = ageMs > STALL_THRESHOLD_MS;
  // Per-channel signal-to-noise approximation: ratio of unique listings to
  // total mentions on that channel — higher = more genuine discovery.
  const channelStats = new Map();
  rows.forEach((r) => {
    const ch = r.sourceChannel || r.source_channel || 'unknown';
    const stat = channelStats.get(ch) || { listings: 0, mentions: 0 };
    stat.listings += 1;
    stat.mentions += Number(r.mentionCount || r.mention_count) || 1;
    channelStats.set(ch, stat);
  });
  const channelSnr = [...channelStats.entries()]
    .map(([ch, s]) => ({ ch, listings: s.listings, mentions: s.mentions, snr: s.listings / s.mentions }))
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 6);
  return {
    ok: total > 0 && newest > 0,
    total,
    newestAt: new Date(newest).toISOString(),
    ageHours: +(ageMs / 3_600_000).toFixed(2),
    coordRate: +(withCoords / total).toFixed(3),
    phoneRate: +(withPhone / total).toFixed(3),
    channelSnr,
    dataStale,
  };
}

export function computeCollectorHealth(
  stateFile = COLLECTOR_STATE_FILE,
  nowMs = Date.now(),
  staleAfterMs = COLLECTOR_STALE_MS,
) {
  try {
    const stat = fs.statSync(stateFile);
    const ageMs = Math.max(0, nowMs - stat.mtimeMs);
    return {
      ok: ageMs <= staleAfterMs,
      pulseAt: stat.mtime.toISOString(),
      pulseAgeMinutes: +(ageMs / 60_000).toFixed(2),
    };
  } catch (error) {
    return {
      ok: false,
      pulseAt: null,
      pulseAgeMinutes: null,
      error: error.message,
    };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  let entry = { startedAt, snapshotCount: null, error: null, warning: null };
  try {
    let rows;
    try {
      rows = await pullSnapshot();
      entry.snapshotCount = writeSnapshot(rows);
      entry.dataSource = 'supabase';
    } catch (error) {
      rows = readLocalSnapshot();
      entry.snapshotCount = rows.length;
      entry.dataSource = 'telegram-snapshot';
      entry.warning = `Supabase unavailable; using Telegram snapshot: ${summarizeError(error)}`;
      await sendAlert(
        `🔴 <b>Sabai Sabai Supabase unreachable</b>\n`
        + `Falling back to local snapshot.\n`
        + `Error: ${summarizeError(error)}`,
      );
    }

    const dataHealth = computeHealth(rows);
    const collector = computeCollectorHealth();
    entry = {
      ...entry,
      ...dataHealth,
      collector,
      ok: dataHealth.ok && collector.ok,
      stale: !collector.ok,
    };

    // Alert on data staleness (>4h) even if collector is alive — the pipeline
    // may be running but producing no new listings.
    if (dataHealth.dataStale && !entry.stale) {
      await sendAlert(
        `🟡 <b>Sabai Sabai data stale</b>\n`
        + `Newest listing: ${entry.ageHours ?? '?'}h ago\n`
        + `Collector pulse: ${entry.collector?.pulseAgeMinutes ?? '?'} min ago\n`
        + `Listings: ${entry.total ?? '?'}`,
      );
    }

    if (entry.stale) {
      fs.writeFileSync(
        path.join(LOG_DIR, 'heartbeat.stall'),
        JSON.stringify(entry, null, 2),
      );
      await sendAlert(
        `⚠️ <b>Sabai Sabai scraper stall</b>\n`
        + `Collector last active: ${entry.collector?.pulseAgeMinutes ?? '?'} min ago\n`
        + `Data age: ${entry.ageHours ?? '?'}h\n`
        + `Listings: ${entry.total ?? '?'}`,
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

    // ── Auto-backfill on detected intake gaps ──────────────────────────────
    // The scraper flags pendingBackfill in state when catch-up pages can't
    // close a gap. The heartbeat runs the backfill here (heavier job, 5 min
    // timeout) so the scraper loop stays fast.
    try {
      const stateRaw = fs.readFileSync(COLLECTOR_STATE_FILE, 'utf8');
      const state = JSON.parse(stateRaw);
      if (state.pendingBackfill && Object.keys(state.pendingBackfill).length > 0) {
        const targets = Object.keys(state.pendingBackfill);
        entry.backfillTargets = targets;
        execSync('node scripts/backfill_history.js', {
          cwd: ROOT,
          stdio: 'pipe',
          timeout: 5 * 60 * 1000,  // 5 min for backfill
        });
        // Clear the pending flag after successful backfill.
        delete state.pendingBackfill;
        fs.writeFileSync(COLLECTOR_STATE_FILE, JSON.stringify(state, null, 2));
        entry.backfillRan = true;
      }
    } catch (err) {
      entry.backfillRan = false;
      entry.backfillError = err.message?.slice(0, 200);
    }

    // Alert if critical child jobs failed (feed + patterns are essential).
    if (!entry.feedRegenerated && !entry.patternsRegenerated) {
      await sendAlert(
        `🟠 <b>Sabai Sabai child jobs failing</b>\n`
        + `Feed: ${entry.feedError || 'ok'}\n`
        + `Patterns: ${entry.patternsError || 'ok'}`,
      );
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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
