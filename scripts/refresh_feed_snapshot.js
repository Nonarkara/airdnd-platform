#!/usr/bin/env node
/*
 * Sabai Sabai — feed snapshot.
 *
 * The home page's primary surface is now the live feed: every Telegram post
 * tagged as a listing becomes its own card, in time order, abundance-first.
 * That's a different lens from the canonical companions table (which
 * deduplicates aggressively); the feed shows the firehose, the canonical
 * directory shows the curated set.
 *
 * This script pulls listing-classified channel_messages (1,700+ rows
 * today), joins them to photo_archive by grouped_id / telegram_message_id,
 * extracts contact info from the message body, and writes a slim
 * public/feed.json that the FeedGrid component can render directly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDataClient } from './lib/data_store.js';
import dotenv from 'dotenv';
import { formatTelLink, formatLineUrl, formatTelegramUrl, formatMapsUrl, inferCityFromLocation } from '../src/lib/normalization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const CACHE_FILE = path.join(ROOT, '.maps_cache.json');
let mapsCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    mapsCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) || {};
  }
} catch (e) {
  console.warn('[GEO FEED] Could not load .maps_cache.json:', e.message);
}

const FEED_LIMIT = 800;        // pull recent N listing-classified messages
const PAGE = 1000;

// Reads whichever store the scraper writes to (LOCAL_DB=1 → local SQLite).
const supabase = await openDataClient('refresh_feed_snapshot');

async function pullRecentListingMessages() {
  // Two-pass pull to stay within Supabase's PostgREST limit.
  const out = [];
  let cursor = null;
  while (out.length < FEED_LIMIT) {
    let q = supabase
      .from('channel_messages')
      .select('id,telegram_message_id,channel_id,channel_name,message_text,message_date,grouped_id,has_media,linked_companion_id,sender_id')
      .eq('message_type', 'listing')
      .order('message_date', { ascending: false })
      .limit(Math.min(PAGE, FEED_LIMIT - out.length));
    if (cursor) q = q.lt('message_date', cursor);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    cursor = data[data.length - 1].message_date;
    if (data.length < PAGE) break;
  }
  return out;
}

async function pullPhotosForGroups(groupIds, telegramMessageIds, channelIds) {
  const photos = [];
  // Pull photos by grouped_id (in chunks so the IN list isn't enormous)
  const chunks = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  for (const chunk of chunks([...groupIds], 200)) {
    const { data, error } = await supabase
      .from('photo_archive')
      .select('grouped_id,telegram_message_id,channel_id,supabase_url,drive_url,file_size_bytes,message_date')
      .in('grouped_id', chunk);
    if (error) throw new Error(error.message);
    if (data) photos.push(...data);
  }
  // Pull photos by telegram_message_id for ungrouped (gid=null) messages
  for (const chunk of chunks([...telegramMessageIds], 200)) {
    const { data, error } = await supabase
      .from('photo_archive')
      .select('grouped_id,telegram_message_id,channel_id,supabase_url,drive_url,file_size_bytes,message_date')
      .in('telegram_message_id', chunk);
    if (error) throw new Error(error.message);
    if (data) photos.push(...data);
  }
  return photos;
}

// Pull the parlour name from the message body. The community uses a few
// stable patterns: a hashtag at the top (#ชโนทัยนวดเพื่อสุขภาพ), a name in
// double-emoji wrapper (💝น้องมิวมิว💝), or a service-name signal in body text.
// Reject lines that are obviously not names — phone-line tags ("โทร 081"),
// "open hours" lines (digits with separators), URLs, line-IDs, etc.
const NAME_REJECT = /^(โทร|tel|tel\.|call|line|ไลน์|map|google\s*map|address|พิกัด|hours?|เวลา|รายละเอียด|ราคา|price|cost|booking|จอง|ที่อยู่|address|advertisement|ad|promotion|โปรโมชั่น|update|featured|new|ใหม่|hot)\b/i;

function extractName(text) {
  if (!text) return null;
  const t = String(text);

  // 1. First hashtag — most reliable when the post tags the parlour.
  const hashtag = t.match(/#([฀-๿a-zA-Z0-9_]{3,40})/);
  if (hashtag) return hashtag[1].replace(/_/g, ' ').trim();

  // 2. Double-emoji wrapper: emoji + name + same/another emoji on first content line.
  for (const line of t.split('\n')) {
    const wrapped = line.match(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*([^\p{Emoji_Presentation}\p{Extended_Pictographic}]{3,40})\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
    if (wrapped) {
      const name = wrapped[1].trim();
      if (name.length >= 3 && !/^[0-9]+$/.test(name) && !NAME_REJECT.test(name)) return name;
    }
  }

  // 3. First clean line that looks like a parlour or staff name.
  //    Heuristic: must have ≥3 letters (Thai or Latin), ≤60 chars, not be a URL,
  //    not start with a known meta keyword (โทร / tel / ไลน์ / line / etc.),
  //    not be dominated by digits + separators (those are phone or hours lines).
  const cleanLine = (line) => line
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/[➡⬅↑↓→←⇒⇐]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const acceptName = (cleaned) => {
    if (cleaned.length < 4 || cleaned.length > 60) return false;
    if (/https?:\/\//.test(cleaned)) return false;
    // Reject bare URL fragments / domains — common when a message is mostly link text.
    if (/^[a-z0-9.-]+\.(?:com|me|ee|app|gle|google|line|t)\b/i.test(cleaned)) return false;
    if (/^@[a-z0-9_.-]+$/i.test(cleaned)) return false;          // bare handles
    // Reject opaque alphanumeric tokens (look like IDs, not names): no
    // spaces, mostly Latin alphanumeric. Real names either contain spaces
    // or are dominated by Thai characters.
    if (!/\s/.test(cleaned)) {
      const latin = (cleaned.match(/[A-Za-z0-9]/g) || []).length;
      const thai = (cleaned.match(/[฀-๿]/gu) || []).length;
      if (latin / cleaned.length > 0.6 && thai < cleaned.length * 0.5 && cleaned.length < 20) return false;
    }
    if (NAME_REJECT.test(cleaned)) return false;
    const letterCount = (cleaned.match(/[฀-๿a-zA-Z]/gu) || []).length;
    if (letterCount < Math.ceil(cleaned.length * 0.4)) return false;
    return true;
  };

  for (const line of t.split('\n')) {
    const cleaned = cleanLine(line);
    if (!cleaned) continue;
    if (acceptName(cleaned)) return cleaned;

    // The line may be a one-liner with the meta keyword first and the
    // parlour name embedded after a separator. Split on the separators
    // the community actually uses and check each segment.
    const segments = cleaned.split(/\s*[|·•►▶▷/]\s*|\s{2,}/u);
    for (const seg of segments) {
      if (acceptName(seg)) return seg.trim();
    }

    // Final pass: pull out any "<name> นวดเพื่อสุขภาพ" / "<name> spa" /
    // "<name> massage" pattern — these suffixes always mark a real parlour
    // name in this corpus.
    const suffixMatch = cleaned.match(/([฀-๿a-zA-Z][฀-๿a-zA-Z0-9 ]{1,30})\s*(นวด(?:เพื่อสุขภาพ)?|spa|massage|wellness)/iu);
    if (suffixMatch) {
      const candidate = `${suffixMatch[1].trim()} ${suffixMatch[2]}`.trim();
      if (acceptName(candidate)) return candidate;
    }
  }

  return null;
}

function extractContacts(text) {
  if (!text) return {};
  const t = String(text);

  // Phone — Thai-shaped 9-10 digit sequence (with optional separators)
  const phoneMatch = t.match(/0\s?\d[\d\s\-.]{7,12}\d/);
  let phone = null;
  if (phoneMatch) phone = phoneMatch[0].replace(/\D/g, '').slice(0, 10);
  if (phone && phone.length < 9) phone = null;

  // LINE — explicit URL or @handle
  let lineUrl = null;
  const lineMatch = t.match(/(?:line\.me\/[^\s]+|lin\.ee\/[A-Za-z0-9]+|page\.line\.me\/[^\s]+)/i);
  if (lineMatch) lineUrl = formatLineUrl(lineMatch[0]);
  if (!lineUrl) {
    const handleMatch = t.match(/(?:LINE\s*ID\s*[:：]?\s*|line\s*[:：]?\s*|ID\s*line\s*[:：]?\s*)@?([A-Za-z0-9_.-]{3,30})/i);
    if (handleMatch) lineUrl = formatLineUrl(`@${handleMatch[1]}`);
  }

  // Maps — Google Maps shortlink
  let mapsUrl = null;
  const mapsMatch = t.match(/(?:maps\.app\.goo\.gl\/[A-Za-z0-9?=_.-]+|goo\.gl\/maps\/[A-Za-z0-9?=_.-]+|share\.google\/[A-Za-z0-9?=_.-]+|google\.com\/maps\S+|g\.co\/kgs\/[A-Za-z0-9]+)/i);
  if (mapsMatch) mapsUrl = formatMapsUrl(mapsMatch[0]);

  // Telegram — t.me/username
  let telegramUrl = null;
  const tgMatch = t.match(/t\.me\/([A-Za-z0-9_]{3,32})/i);
  if (tgMatch) telegramUrl = formatTelegramUrl(tgMatch[0]);

  return {
    phone: phone || null,
    telLink: phone ? formatTelLink(phone) : null,
    lineUrl,
    mapsUrl,
    telegramUrl,
  };
}

function extractHours(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2}[:.]\d{0,2}\s*[-–—~]\s*\d{1,2}[:.]\d{0,2}\s*(?:น\.|am|pm)?)/i);
  return m ? m[1].trim() : null;
}

function extractPriceLabel(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{2,3}[0-9,]{0,4})\s*(?:บาท|thb|baht)/i);
  if (!m) return null;
  return `${m[1].replace(/[^\d]/g, '')} THB`;
}

function shortDescription(text) {
  if (!text) return '';
  return String(text)
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[฀-๿a-zA-Z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

/**
 * Supabase edge failures arrive as a full Cloudflare HTML error page, which is
 * useless in a log and worse in a JSON field. Pull out the status if there is
 * one, otherwise the first line of real text.
 */
function summarizeError(err) {
  const msg = String(err?.message || err || '').trim();
  if (!/<!DOCTYPE|<html/i.test(msg)) return msg.slice(0, 160);
  const title = msg.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const code = msg.match(/\b(5\d{2}|4\d{2})\b/)?.[1];
  const clean = (title || '').replace(/\s+/g, ' ').trim();
  return clean ? `${clean}${code && !clean.includes(code) ? ` (${code})` : ''}`.slice(0, 160)
    : `edge error page${code ? ` (${code})` : ''}`;
}

/** Provenance sidecar for feed.json. Kept separate so feed.json stays an array. */
function writeFeedMeta(meta) {
  fs.writeFileSync(
    path.join(ROOT, 'public', 'feed_meta.json'),
    JSON.stringify({ ...meta, builtAt: new Date().toISOString() }, null, 2),
  );
}

async function main() {
  console.log('=== Feed snapshot ===');
  const t0 = Date.now();

  console.log('pulling recent listing-classified messages...');
  let messages = [];
  try {
    messages = await pullRecentListingMessages();
    console.log(`  ${messages.length} messages pulled`);
  } catch (err) {
    console.warn(`Supabase query failed (${err.message}). Generating feed snapshot from public/data.json fallback...`);
    const dataJsonPath = path.join(__dirname, '../public/data.json');
    if (fs.existsSync(dataJsonPath)) {
      const dataListings = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
      const fallbackCards = dataListings.map(l => ({
        id: `feed_${l.id}`,
        name: l.name,
        channel: l.sourceChannel || '@relaxsocietymassage',
        messageDate: l.postedAt || l.updatedAt || new Date().toISOString(),
        description: l.description,
        priceLabel: l.price || l.priceLabel,
        hours: l.hours,
        phone: l.phone,
        lineUrl: l.lineUrl,
        mapsUrl: l.mapsUrl,
        photoUrls: Array.isArray(l.photoUrls) && l.photoUrls.length > 0 ? l.photoUrls : (l.imageUrl ? [l.imageUrl] : []),
        location: l.location || l.city,
        city: l.city,
      })).sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate));

      const feedOutPath = path.join(__dirname, '../public/feed.json');
      fs.writeFileSync(feedOutPath, JSON.stringify(fallbackCards, null, 2));
      // Say so. This fallback is the deduplicated directory wearing the feed's
      // clothes — one card per business, not the per-post firehose the tab
      // claims to be. Without this marker the LIVE tab silently becomes a
      // second copy of the directory and nothing on screen admits it.
      writeFeedMeta({
        degraded: true,
        source: 'data.json',
        reason: `Supabase unavailable: ${summarizeError(err)}`,
        cards: fallbackCards.length,
      });
      console.log(`Wrote ${fallbackCards.length} fallback feed cards to ${feedOutPath} in ${Date.now() - t0}ms`);
      console.warn('  NOTE: feed is DEGRADED — mirroring data.json, not the per-post stream.');
      return;
    }
    throw err;
  }

  // Group by album (grouped_id) when present, else by single-message id
  const groupIds = new Set();
  const tgMessageIds = new Set();
  for (const m of messages) {
    if (m.grouped_id) groupIds.add(m.grouped_id);
    else if (m.telegram_message_id) tgMessageIds.add(m.telegram_message_id);
  }
  console.log(`  ${groupIds.size} albums + ${tgMessageIds.size} solo posts`);

  console.log('pulling photos for these groups...');
  const photos = await pullPhotosForGroups(groupIds, tgMessageIds);
  console.log(`  ${photos.length} photos resolved`);

  // Index photos by group / telegram_message_id
  const photosByGid = new Map();
  const photosByTmId = new Map();
  for (const p of photos) {
    const url = p.supabase_url || p.drive_url;
    if (!url) continue;
    if (p.grouped_id) {
      const arr = photosByGid.get(p.grouped_id) || [];
      arr.push({ url, ts: p.message_date, size: p.file_size_bytes });
      photosByGid.set(p.grouped_id, arr);
    }
    if (p.telegram_message_id) {
      const arr = photosByTmId.get(p.telegram_message_id) || [];
      arr.push({ url, ts: p.message_date, size: p.file_size_bytes });
      photosByTmId.set(p.telegram_message_id, arr);
    }
  }

  // Collapse the messages stream into one card per Telegram POST.
  // A "post" = one grouped_id (album) when present, or one telegram_message
  // when grouped_id is null. Within an album, only the message that carries
  // the actual caption is kept as the lead row; album-only photo messages
  // (empty text, member of a group) are folded into that lead row's photo
  // collection. Result: one card with its hero photo + the rest of the
  // album as auxiliary thumbnails.
  const groups = new Map();
  for (const m of messages) {
    const key = m.grouped_id || `solo-${m.telegram_message_id}-${m.channel_id || ''}`;
    const existing = groups.get(key);
    const textLen = (m.message_text || '').length;
    if (!existing || textLen > existing.textLen) {
      // Keep the message with the longest text as the lead. Carry over the
      // earliest message_date so the timeline reflects when the album landed.
      const earliestDate = existing && new Date(existing.lead.message_date) < new Date(m.message_date)
        ? existing.lead.message_date
        : m.message_date;
      groups.set(key, { lead: { ...m, message_date: earliestDate }, textLen });
    } else {
      // Slot in the earlier date if this message is older
      if (new Date(m.message_date) < new Date(existing.lead.message_date)) {
        existing.lead.message_date = m.message_date;
      }
    }
  }

  const cards = [...groups.values()]
    .map(({ lead: m }) => {
      const photoArr = m.grouped_id
        ? (photosByGid.get(m.grouped_id) || [])
        : (photosByTmId.get(m.telegram_message_id) || []);
      // Dedup photos by url, sort by timestamp
      const seen = new Set();
      const photoUrls = photoArr
        .filter((p) => p.url && !seen.has(p.url) && (seen.add(p.url), true))
        .sort((a, b) => new Date(a.ts) - new Date(b.ts))
        .map((p) => p.url);
      const name = extractName(m.message_text) || `Post ${m.telegram_message_id}`;
      const contacts = extractContacts(m.message_text);
      const inferredCity = inferCityFromLocation(m.message_text) || 'Bangkok';
      let latitude = null;
      let longitude = null;
      if (contacts.mapsUrl && mapsCache[contacts.mapsUrl]) {
        const cached = mapsCache[contacts.mapsUrl];
        if (cached && !cached.failed && cached.latitude && cached.longitude) {
          latitude = cached.latitude;
          longitude = cached.longitude;
        }
      }
      return {
        id: m.id,                              // channel_messages.id (always unique)
        telegramMessageId: m.telegram_message_id,
        groupedId: m.grouped_id,
        channel: m.channel_name,
        messageDate: m.message_date,
        linkedCompanionId: m.linked_companion_id,    // currently always null — see findings §1.1
        name,
        description: shortDescription(m.message_text),
        photoUrls,
        photoCount: photoUrls.length,
        primaryPhoto: photoUrls[0] || null,
        hours: extractHours(m.message_text),
        priceLabel: extractPriceLabel(m.message_text),
        city: inferredCity,
        latitude,
        longitude,
        ...contacts,
      };
    })
    // Show only cards that actually have a hero photo. A "card with no
    // image" then a blank modal is the worst kind of UX (Dr Non, 2026-05-02).
    .filter((c) => c.primaryPhoto)
    // Sort newest-first so the freshest post sits at the top of the feed.
    .sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate));

  // Cross-channel deduplication. The two big aggregators (@relaxsociety2020 +
  // @relaxsocietymassage) re-post the same parlour content within seconds —
  // same name, same description text, photos re-uploaded under different
  // URLs by each channel. Dedup signal: same extracted name + posted in the
  // same 10-minute window. Keep the earliest card; merge the other channel
  // into `crossPostedOn` so the modal can show "also on @other".
  const finalCards = (() => {
    const seen = [];
    const sorted = [...cards].sort((a, b) => new Date(a.messageDate) - new Date(b.messageDate));
    const WINDOW_MS = 10 * 60 * 1000;
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    for (const card of sorted) {
      const cardTime = new Date(card.messageDate).getTime();
      const cardName = norm(card.name);
      const match = seen.find((s) => {
        if (s.channel === card.channel) return false;     // different channel only
        if (norm(s.name) !== cardName) return false;
        return Math.abs(new Date(s.messageDate).getTime() - cardTime) < WINDOW_MS;
      });
      if (match) {
        const crossChannels = new Set(match.crossPostedOn || []);
        crossChannels.add(card.channel);
        match.crossPostedOn = [...crossChannels];
        // If the duplicate brings more photos, use the larger set.
        if (card.photoCount > match.photoCount) {
          match.photoUrls = card.photoUrls;
          match.photoCount = card.photoCount;
          match.primaryPhoto = card.primaryPhoto;
        }
        // Keep the longer description.
        if ((card.description || '').length > (match.description || '').length) {
          match.description = card.description;
        }
      } else {
        seen.push(card);
      }
    }
    return seen.sort((a, b) => new Date(b.messageDate) - new Date(a.messageDate));
  })();

  fs.writeFileSync(path.join(ROOT, 'public', 'feed.json'), JSON.stringify(finalCards, null, 0));
  writeFeedMeta({ degraded: false, source: 'channel_messages', cards: finalCards.length });

  const withPhotos = finalCards.filter((c) => c.primaryPhoto).length;
  const withContacts = finalCards.filter((c) => c.phone || c.lineUrl).length;
  const crossPosted = finalCards.filter((c) => Array.isArray(c.crossPostedOn) && c.crossPostedOn.length > 0).length;
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  ${finalCards.length} feed cards · ${withPhotos} with photo · ${withContacts} with contact · ${crossPosted} cross-posted`);
  console.log(`  feed.json: ${(fs.statSync(path.join(ROOT, 'public', 'feed.json')).size / 1024).toFixed(1)} kB`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
