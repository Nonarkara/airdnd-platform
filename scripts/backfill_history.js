/**
 * backfill_history.js — one-shot historical Telegram backfill.
 *
 * Fetches ALL historical messages from each source channel, going back in time
 * in 100-message batches, and passes them through the full listing_pipeline.js
 * flow (parse → enrich → dedup → upsert to Supabase).
 *
 * Run: node scripts/backfill_history.js [--dry-run]
 *   --dry-run: parse and extract without writing to Supabase
 *
 * Expect ~15-30 min for a full backfill of 3,000-4,000 messages.
 * Output: tmp/backfill-report.json
 *
 * IMPORTANT: Telegram session must exist. Run scripts/userbot.js first if needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  insertListingsIfPossible,
  normalizeExtractedListings,
} from './listing_pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 600;   // be polite to Telegram's rate limiter
const MAX_MESSAGES_PER_CHANNEL = 5000; // safety ceiling

// Same channels as the live scraper
const CHANNELS = [
  '@relaxsociety2020',
  '@keawjaojormmassage',
  '@relaxsocietymassage',
  '@naarsom',
  '@chanelmassage',
  '@dreamgirlspav2',
  '@newmassagerama5',
];

const supabase = process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY)
  : null;

if (!supabase && !DRY_RUN) {
  console.error('Missing Supabase credentials. Use --dry-run or add keys to .env.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAllMessages(client, channelUsername) {
  const messages = [];
  let offsetId = 0;
  let page = 0;

  console.log(`\n  Fetching ${channelUsername}…`);

  while (messages.length < MAX_MESSAGES_PER_CHANNEL) {
    try {
      const batch = await client.getMessages(channelUsername, {
        limit: BATCH_SIZE,
        offsetId: offsetId || undefined,
        reverse: false, // newest first
      });

      if (!batch || batch.length === 0) break;

      const raw = [...batch];
      messages.push(...raw);
      offsetId = Math.min(...raw.map((m) => Number(m.id) || Infinity));

      page += 1;
      process.stdout.write(`    page ${page}: +${raw.length} msgs (total ${messages.length})\r`);

      await sleep(BATCH_DELAY_MS);
    } catch (err) {
      console.error(`\n  Error fetching page ${page} of ${channelUsername}: ${err.message}`);
      break;
    }
  }

  console.log(`\n  Done: ${messages.length} messages from ${channelUsername}`);
  return messages;
}

// Very light text extractor — pull raw text + photo info for the pipeline.
function messageToListingInput(msg, channelUsername) {
  const rawText = msg.message || msg.text || '';
  const photos = [];
  if (msg.photo) {
    photos.push({ telegramFileId: msg.photo.id, grouped_id: msg.groupedId });
  }
  return {
    rawText,
    photos,
    sourceChannel: channelUsername,
    messageId: Number(msg.id),
    messageDate: msg.date ? new Date(msg.date * 1000).toISOString() : null,
    senderId: msg.fromId ? String(msg.fromId.userId || msg.fromId.channelId || '') : null,
    groupedId: msg.groupedId ? String(msg.groupedId) : null,
  };
}

async function main() {
  console.log('=== SABAI SABAI HISTORICAL BACKFILL ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE (writing to Supabase)'}`);
  console.log(`Channels: ${CHANNELS.join(', ')}`);
  console.log(`Batch size: ${BATCH_SIZE} · Delay: ${BATCH_DELAY_MS}ms · Max per channel: ${MAX_MESSAGES_PER_CHANNEL}`);
  console.log('');

  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 3, autoReconnect: true },
  );

  await client.connect();
  console.log('Telegram connected.\n');

  const report = {
    startedAt: new Date().toISOString(),
    dryRun: DRY_RUN,
    channels: [],
    totals: { messages: 0, listings: 0, inserted: 0, skipped: 0, rejected: 0 },
  };

  for (const channel of CHANNELS) {
    const channelReport = { channel, messages: 0, listings: 0, inserted: 0, skipped: 0, error: null };

    try {
      const messages = await fetchAllMessages(client, channel);
      channelReport.messages = messages.length;
      report.totals.messages += messages.length;

      // Convert to the shape listing_pipeline.js expects
      const inputs = messages
        .filter((m) => m.message || m.photo)
        .map((m) => messageToListingInput(m, channel));

      // Cluster by grouped_id (album messages from same post) then normalize
      const clusterMap = new Map();
      for (const inp of inputs) {
        const key = inp.groupedId || String(inp.messageId);
        if (!clusterMap.has(key)) clusterMap.set(key, { rawText: '', photos: [], sourceChannel: channel, messageDate: inp.messageDate, senderId: inp.senderId });
        const cluster = clusterMap.get(key);
        if (inp.rawText) cluster.rawText += (cluster.rawText ? '\n' : '') + inp.rawText;
        cluster.photos.push(...inp.photos);
      }

      const clusters = [...clusterMap.values()].filter((c) => c.rawText.trim().length > 5);
      const normalized = normalizeExtractedListings(clusters);
      channelReport.listings = normalized.length;
      report.totals.listings += normalized.length;

      console.log(`  ${channel}: ${messages.length} msgs → ${clusters.length} clusters → ${normalized.length} candidate listings`);

      if (!DRY_RUN && supabase && normalized.length > 0) {
        const syncResult = await insertListingsIfPossible(supabase, normalized);
        channelReport.inserted = syncResult.inserted || 0;
        channelReport.skipped = syncResult.skipped || 0;
        report.totals.inserted += channelReport.inserted;
        report.totals.skipped += channelReport.skipped;
        report.totals.rejected += syncResult.rejected || 0;
        console.log(`    → inserted: ${channelReport.inserted}, skipped: ${channelReport.skipped}`);
      }
    } catch (err) {
      channelReport.error = err.message;
      console.error(`  ERROR on ${channel}: ${err.message}`);
    }

    report.channels.push(channelReport);
  }

  await client.disconnect();

  report.finishedAt = new Date().toISOString();
  const duration = ((new Date(report.finishedAt) - new Date(report.startedAt)) / 1000).toFixed(0);
  report.durationSeconds = Number(duration);

  console.log('\n=== BACKFILL COMPLETE ===');
  console.log(`Total messages fetched: ${report.totals.messages}`);
  console.log(`Candidate listings:     ${report.totals.listings}`);
  if (!DRY_RUN) {
    console.log(`Inserted to Supabase:   ${report.totals.inserted}`);
    console.log(`Skipped (duplicates):   ${report.totals.skipped}`);
    console.log(`Rejected (quality):     ${report.totals.rejected}`);
  }
  console.log(`Duration: ${duration}s`);

  fs.mkdirSync('tmp', { recursive: true });
  fs.writeFileSync('tmp/backfill-report.json', JSON.stringify(report, null, 2));
  console.log('\nReport: tmp/backfill-report.json');

  if (!DRY_RUN) {
    console.log('\nNext steps:');
    console.log('  1. node scripts/integrity_check.js');
    console.log('  2. npm run snapshot:refresh  (or use the inline refresh command)');
    console.log('  3. npm run build && npx wrangler pages deploy dist --project-name sabaisabai-airdnd');
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
