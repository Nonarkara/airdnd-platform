#!/usr/bin/env node
/**
 * backfill_local.js — fill a hole in the M3's LOCAL archive from Telegram history.
 *
 * Writes only where the live intake (scripts/telegram_scraper.js) writes:
 *   - channel_messages rows in the local Postgres (DATABASE_URL, default localhost/airdnd)
 *   - photo files under PHOTO_ROOT + photo_archive rows (via scripts/photo_storage.js)
 * It never imports @supabase/* and refuses a DATABASE_URL that points at Supabase.
 * No AI enrichment and no listing extraction: raw messages + photos only. The
 * publisher's feed / gallery builders pick the rows up on their next cycle.
 *
 * Safety:
 *   - reuses TELEGRAM_SESSION from .env with connect() only; never logs in,
 *     never prompts, never writes or prints the session. Run it on the M3 (same
 *     IP as the intake) so the shared session is not used from two addresses.
 *   - swap-gated: refuses to start, and pauses (saves state, exits 4) between
 *     pages, when swap use is above --swap-max (default 90%).
 *   - rate-limited: one page (--batch, default 100) every --delay-ms (1500 ms),
 *     photos one at a time with --photo-delay-ms (400 ms) between them.
 *   - FLOOD_WAIT: sleeps the requested time + 3 s and retries; a wait longer
 *     than --max-flood-wait (900 s) saves state and exits 3 so it can resume later.
 *   - resumable: per-channel progress in --state (default
 *     /Volumes/Data/AirDnD/state/backfill-local.json), committed after each page.
 *     Re-run the same command to continue. Already-stored messages and photos
 *     are skipped (checked against the DB before writing; inserts are also
 *     ON CONFLICT DO NOTHING).
 *
 * Usage (from the intake checkout on the M3):
 *   NODE_OPTIONS=--max-old-space-size=384 node scripts/backfill_local.js \
 *     --since 2026-10-11T15:00:00+07:00 --until 2026-10-18T12:00:00+07:00 [--dry-run]
 * Options: --channels a,b  --no-photos  --batch N  --delay-ms N  --photo-delay-ms N
 *          --swap-max PCT  --max-flood-wait S  --max-pages N  --state PATH
 * Exit codes: 0 done · 1 error · 2 refused (swap/auth/config) · 3 long flood wait · 4 paused (swap/signal)
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  parseSwapUsage, swapGate, floodWaitSeconds, slicePage, missingMessages, isImageMessage,
  windowKey, channelState, withChannelState, parseIsoToSec,
} from '../src/lib/backfill_plan.js';
import { classifyMessageType } from '../src/lib/message_classifier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env'), quiet: true });

// AI enrichment is off for the whole run: this script never calls a model, and
// these are cleared so nothing imported below can reach one either.
process.env.AI_ENRICHMENT_PER_CYCLE = '0';
for (const k of ['LOCAL_AI_URL', 'LOCAL_AI_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete process.env[k];
// The retired Supabase must never receive a write from this script.
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY']) delete process.env[k];

const DEFAULT_TARGETS = [
  '@relaxsociety2020', 'dialog:2025289026', '@keawjaojormmassage', 'dialog:2381945815',
  'dialog:2491020966', '@relaxsocietymassage', 'dialog:2647876733', '@naarsom',
  '@chanelmassage', '@dreamgirlspav2', 'dialog:3769808713', '@newmassagerama5',
];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
const flag = (name) => process.argv.includes(`--${name}`);
const intArg = (name, fallback) => {
  const n = Number.parseInt(arg(name, fallback), 10);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non-negative integer`);
  return n;
};

const ts = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' });
const log = (msg) => console.log(`[${ts()}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class StopRun extends Error {
  constructor(code, message) { super(message); this.exitCode = code; }
}

function readSwap() {
  try {
    if (process.platform === 'darwin') return parseSwapUsage(execFileSync('sysctl', ['vm.swapusage'], { encoding: 'utf8' }));
    const info = fs.readFileSync('/proc/meminfo', 'utf8');
    const kb = (k) => Number((new RegExp(`^${k}:\\s+(\\d+)`, 'm').exec(info) || [])[1]);
    const total = kb('SwapTotal') / 1024;
    const used = total - kb('SwapFree') / 1024;
    return Number.isFinite(total) ? { totalMb: total, usedMb: used, pct: total ? (used / total) * 100 : 0 } : null;
  } catch {
    return null;
  }
}

function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}

// Same label rules as telegram_scraper.js so rows line up with the intake's.
const isChannelEntity = (e) => Boolean(e?.broadcast || e?.megagroup);
const entityId = (e) => String(e?.id || e?.channelId || e?.chatId || '');
const entityTitle = (e) => e?.title || [e?.firstName, e?.lastName].filter(Boolean).join(' ') || '';
function sourceLabel(target, entity) {
  if (target.type === 'username' && target.lookupValue) return `@${target.lookupValue}`;
  return (entity?.username ? `@${entity.username}` : '') || entityTitle(entity) || target.token;
}

async function main() {
  const sinceIso = arg('since');
  if (!sinceIso || sinceIso === true) throw new StopRun(2, '--since is required (ISO time, e.g. 2026-10-11T15:00:00+07:00)');
  const untilIso = arg('until', new Date().toISOString());
  const sinceSec = parseIsoToSec(sinceIso, '--since');
  const untilSec = parseIsoToSec(untilIso, '--until');
  if (untilSec <= sinceSec) throw new StopRun(2, '--until must be after --since');

  const dryRun = flag('dry-run');
  const photos = !flag('no-photos');
  const batch = Math.min(100, Math.max(1, intArg('batch', 100)));
  const delayMs = intArg('delay-ms', 1500);
  const photoDelayMs = intArg('photo-delay-ms', 400);
  const swapMax = Number(arg('swap-max', 90));
  const maxFloodWait = intArg('max-flood-wait', 900);
  const maxPages = intArg('max-pages', 500);
  const stateFile = String(arg('state', process.env.BACKFILL_STATE || '/Volumes/Data/AirDnD/state/backfill-local.json'));
  const tokens = String(arg('channels', process.env.TELEGRAM_SOURCE_TARGETS || DEFAULT_TARGETS.join(',')))
    .split(',').map((s) => s.trim()).filter(Boolean);

  const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/airdnd';
  if (/supabase\.(co|com|in)/i.test(dbUrl)) throw new StopRun(2, 'DATABASE_URL points at Supabase; this backfill only writes to the local Postgres');

  const gate = swapGate(readSwap(), swapMax);
  if (!gate.ok) throw new StopRun(2, `refusing to start: ${gate.reason}. Try again when the M3 has swap headroom.`);
  log(`swap gate ok — ${gate.reason}`);

  const apiId = Number.parseInt(process.env.TELEGRAM_API_ID, 10);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const session = process.env.TELEGRAM_SESSION;
  if (!apiId || !apiHash || !session) throw new StopRun(2, 'TELEGRAM_API_ID / TELEGRAM_API_HASH / TELEGRAM_SESSION missing from .env (run telegram_login.mjs once; this script never logs in)');

  // Lock so two backfills never share the session or the state file.
  const lockDir = `${stateFile}.lock`;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  try { fs.mkdirSync(lockDir); } catch { throw new StopRun(2, `another backfill holds ${lockDir} (remove it if no backfill is running)`); }
  const releaseLock = () => { try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* ignore */ } };
  process.on('exit', releaseLock);

  let stopping = false;
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopping = true; log(`${sig} — finishing the current page, then saving state`); });

  // Imported late so the env scrubbing above applies to them.
  const { TelegramClient, Logger } = await import('telegram');
  const { LogLevel } = await import('telegram/extensions/Logger.js');
  const { StringSession } = await import('telegram/sessions/index.js');
  const { createDataClient, closeDataClient } = await import('./lib/local_db.js');
  const store = await import('./photo_storage.js');
  const db = createDataClient(dbUrl);
  // photo_storage re-reads .env on import; scrub again so nothing Supabase-shaped is in scope.
  for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'LOCAL_AI_URL', 'LOCAL_AI_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY']) delete process.env[k];

  const withFlood = async (label, fn) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        const wait = floodWaitSeconds(error);
        if (wait > 0) {
          if (wait > maxFloodWait) throw new StopRun(3, `${label}: Telegram asked to wait ${wait}s (> ${maxFloodWait}s). State saved — re-run the same command later.`);
          log(`${label}: FLOOD_WAIT ${wait}s — sleeping, then retrying`);
          await sleep((wait + 3) * 1000);
          continue;
        }
        if (attempt >= 4) throw error;
        log(`${label}: ${error.message} — retry ${attempt}/3 in ${attempt * 5}s`);
        await sleep(attempt * 5000);
      }
    }
  };

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
    floodSleepThreshold: 0, // every flood wait goes through withFlood() so it is logged and bounded
    baseLogger: new Logger(LogLevel.ERROR),
  });
  await client.connect();
  if (!(await client.checkAuthorization())) {
    await client.disconnect();
    throw new StopRun(2, 'the saved Telegram session is not authorised. Run telegram_login.mjs in Terminal on the M3; this script never logs in.');
  }

  const dialogs = await withFlood('getDialogs', () => client.getDialogs({ limit: 500 }));
  const channels = dialogs.map((d) => d.entity).filter(isChannelEntity);
  const byId = new Map(channels.map((e) => [entityId(e), e]));
  const byUser = new Map(channels.filter((e) => e.username).map((e) => [`@${e.username}`.toLowerCase(), e]));
  const targets = [];
  for (const token of tokens) {
    if (token.startsWith('dialog:')) {
      const e = byId.get(token.slice(7));
      if (!e) { log(`skip ${token}: dialog not found in this session`); continue; }
      targets.push({ token, entity: e, label: sourceLabel({ token, type: 'dialog' }, e) });
      continue;
    }
    let e = byUser.get(token.toLowerCase());
    if (!e) {
      try { e = await withFlood(`resolve ${token}`, () => client.getEntity(token)); } catch (error) { log(`skip ${token}: ${error.message}`); continue; }
      if (!isChannelEntity(e)) { log(`skip ${token}: not a channel or group`); continue; }
    }
    const lookupValue = token.replace(/^@/, '');
    targets.push({ token, entity: e, label: sourceLabel({ token, type: 'username', lookupValue }, e) });
  }
  log(`window ${sinceIso} → ${untilIso} · ${targets.length} channel(s): ${targets.map((t) => t.label).join(', ')}${dryRun ? ' · DRY RUN (no writes, no downloads)' : ''}${photos ? '' : ' · photos off'}`);

  const key = windowKey(new Date(sinceSec * 1000).toISOString(), new Date(untilSec * 1000).toISOString());
  let state = loadState(stateFile);
  const totals = { seen: 0, archived: 0, photos: 0, photoErrors: 0 };

  for (const target of targets) {
    let cs = channelState(state, key, target.token);
    if (cs.done) { log(`${target.label}: already complete for this window (archived ${cs.archived}, photos ${cs.photos})`); continue; }
    log(`${target.label}: ${cs.offsetId ? `resuming below message ${cs.offsetId}` : 'starting from the newest message'}`);

    while (!cs.done) {
      if (stopping) throw new StopRun(4, 'stopped by signal; state saved — re-run the same command to continue');
      if (cs.pages >= maxPages) { log(`${target.label}: hit --max-pages ${maxPages}; stopping this channel`); break; }
      const swap = swapGate(readSwap(), swapMax);
      if (!swap.ok) throw new StopRun(4, `paused: ${swap.reason}. State saved — re-run the same command when swap is lower.`);

      const page = await withFlood(`${target.label} page`, () => client.getMessages(target.entity, { limit: batch, offsetId: cs.offsetId }));
      const { inWindow, reachedStart, nextOffsetId } = slicePage(page, sinceSec, untilSec);
      const ids = inWindow.map((m) => Number(m.id));
      let archived = 0;
      let gotPhotos = 0;
      let photoErrors = 0;

      if (ids.length) {
        const { rows } = await db.pool.query(
          'SELECT telegram_message_id FROM channel_messages WHERE channel_id = $1 AND telegram_message_id = ANY($2)',
          [target.token, ids],
        );
        const fresh = missingMessages(inWindow, new Set(rows.map((r) => Number(r.telegram_message_id))));
        if (fresh.length && !dryRun) {
          const rowsToInsert = fresh.map((msg) => ({
            telegram_message_id: Number(msg.id),
            channel_id: target.token,
            channel_name: target.label,
            sender_id: msg.fromId ? String(msg.fromId.userId || msg.fromId.channelId || msg.fromId) : null,
            message_text: msg.message || null,
            message_date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
            has_media: Boolean(msg.media),
            media_type: msg.media?.photo ? 'photo' : msg.media?.document ? 'document' : msg.media?.video ? 'video' : null,
            reply_to_message_id: msg.replyTo?.replyToMsgId || null,
            grouped_id: msg.groupedId ? String(msg.groupedId) : null,
            message_type: classifyMessageType(msg.message || ''),
          }));
          for (let i = 0; i < rowsToInsert.length; i += 50) {
            const { data, error } = await db.from('channel_messages')
              .upsert(rowsToInsert.slice(i, i + 50), { onConflict: 'channel_id,telegram_message_id', ignoreDuplicates: true });
            if (error) throw new Error(`channel_messages insert failed: ${error.message}`);
            archived += data.length;
          }
        } else {
          archived = dryRun ? fresh.length : 0;
        }

        const images = photos ? inWindow.filter(isImageMessage) : [];
        if (images.length) {
          // photo_archive keys photos by the numeric channel id, like the intake does.
          const photoChannelId = (m) => String(m.peerId?.channelId || m.peerId || target.label);
          const { rows: have } = await db.pool.query(
            'SELECT DISTINCT telegram_message_id FROM photo_archive WHERE channel_id = $1 AND telegram_message_id = ANY($2)',
            [photoChannelId(images[0]), images.map((m) => Number(m.id))],
          );
          const need = missingMessages(images, new Set(have.map((r) => Number(r.telegram_message_id))));
          for (const msg of need) {
            if (dryRun) { gotPhotos += 1; continue; }
            if (stopping) throw new StopRun(4, 'stopped by signal mid-page; state saved at the previous page — re-run the same command to continue');
            let buffer = null;
            try {
              buffer = await withFlood(`${target.label} photo ${msg.id}`, () => client.downloadMedia(msg, {}));
            } catch (error) {
              if (error instanceof StopRun) throw error;
              photoErrors += 1;
              log(`${target.label}: photo ${msg.id} failed: ${error.message}`);
            }
            if (buffer && buffer.length) {
              const originalFilename = store.extractOriginalFilename(msg);
              const storedFilename = store.buildStoredFilename(msg, target.label, originalFilename);
              const localUrl = store.savePhotoLocally(buffer, storedFilename, target.label);
              const mediaUrl = await store.uploadPhotoBuffer(buffer, storedFilename, target.label);
              await store.archivePhotoMetadata({
                localUrl,
                supabaseUrl: mediaUrl,
                storedFilename,
                originalFilename,
                fileSize: buffer.length,
                photoTelegramId: msg.media?.photo?.id ? String(msg.media.photo.id) : null,
                mediaType: msg.media?.document ? 'document' : 'photo',
                mimeType: msg.media?.document?.mimeType || 'image/jpeg',
              }, msg, photoChannelId(msg), target.label);
              gotPhotos += 1;
            }
            buffer = null;
            if (photoDelayMs) await sleep(photoDelayMs);
          }
        }
      }

      // Commit progress only after the page is fully processed.
      cs = {
        ...cs,
        offsetId: nextOffsetId || cs.offsetId,
        done: reachedStart,
        pages: cs.pages + 1,
        seen: cs.seen + ids.length,
        archived: cs.archived + archived,
        photos: cs.photos + gotPhotos,
        photoErrors: cs.photoErrors + photoErrors,
      };
      if (!dryRun) { state = withChannelState(state, key, target.token, cs); saveState(stateFile, state); }
      const oldest = page.length ? new Date(Math.min(...page.map((m) => Number(m.date) || Infinity)) * 1000).toISOString() : '-';
      log(`${target.label}: page ${cs.pages} · ${ids.length} in window · ${archived} ${dryRun ? 'would be ' : ''}new · ${gotPhotos} photo(s)${dryRun ? ' needed' : ''} · reached ${oldest}${cs.done ? ' · done' : ''}`);
      if (!cs.done && delayMs) await sleep(delayMs);
    }
    totals.seen += cs.seen; totals.archived += cs.archived; totals.photos += cs.photos; totals.photoErrors += cs.photoErrors;
  }

  log(`finished · ${totals.seen} message(s) in window · ${totals.archived} ${dryRun ? 'would be ' : ''}added · ${totals.photos} photo(s)${dryRun ? ' needed' : ' stored'} · ${totals.photoErrors} photo error(s) · rss ${Math.round(process.memoryUsage().rss / 1048576)} MB on ${os.hostname()}`);
  await client.disconnect();
  await closeDataClient();
}

main().then(() => process.exit(0)).catch((error) => {
  if (error instanceof StopRun) { log(error.message); process.exit(error.exitCode); }
  log(`error: ${error.stack || error.message}`);
  process.exit(1);
});
