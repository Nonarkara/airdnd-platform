import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  buildFingerprint,
  insertListingsIfPossible,
  mergeSnapshotListings,
  normalizeExtractedListings,
  parseModelJson,
  readSnapshotListings,
  writeSnapshotListings,
} from './listing_pipeline.js';
import { exportToGoogle } from './google_export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiId = Number.parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const channelUsername = process.env.TELEGRAM_SOURCE_CHANNEL || 'nutyes';
const fetchLimit = Number.parseInt(process.env.TELEGRAM_FETCH_LIMIT || '120', 10);
const pollIntervalMs = Number.parseInt(process.env.TELEGRAM_POLL_INTERVAL_MS || '45000', 10);
const snapshotLimit = Number.parseInt(process.env.SNAPSHOT_LISTING_LIMIT || '180', 10);
const watchMode = process.argv.includes('--watch');

if (!apiId || !apiHash) {
  console.error('Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env');
  process.exit(1);
}

if (!process.env.TELEGRAM_SESSION) {
  console.error('Missing TELEGRAM_SESSION in .env. Run userbot.js first.');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('Missing GEMINI_API_KEY or GOOGLE_API_KEY in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

function buildPrompt(rawText) {
  return `
Extract distinct Thailand wellness, massage, or spa listings from the following Telegram messages.
Each message group is labelled with a [CLUSTER <id>] tag — include that cluster_id in your output so we can match photos.
Return only a JSON array with this shape:
[
  {
    "cluster_id": 0,
    "name": "Business or provider name",
    "age": null,
    "location": "District or area, City/Province",
    "price": null,
    "metrics": {},
    "tags": ["Bangkok", "Massage"],
    "description": "Short factual summary of the service, area, hours, or availability",
    "phone": "0XX-XXX-XXXX or null",
    "hours": "10:00-23:00 or null",
    "lineUrl": "https://line.me/... or null",
    "telegramUrl": "https://t.me/... or null",
    "mapsUrl": "https://maps.app.goo.gl/... or null"
  }
]

Rules:
- Extract a listing whenever a message clearly describes a massage shop, spa, therapist, or wellness provider.
- Ignore pure links, empty media posts, price tables without context, or messages without usable listing detail.
- Keep one listing per distinct business or provider mention.
- cluster_id must match the [CLUSTER <id>] from which the listing was extracted.
- Extract phone numbers, operating hours, LINE links, Telegram links, and Google Maps links when present.
- Use null for unknown age, price, phone, hours, or link values.
- Use an empty object for missing metrics.
- Add 1-3 short tags based on city/province, district, and service type.
- Do not invent ratings or review counts.
- Keep descriptions factual and concise.
- Return only valid JSON.

Messages:
${rawText}
`;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function attachImages(listings, files) {
  const imagePool = Array.isArray(files) && files.length > 0 ? files : ['109748.jpg'];

  return listings.map((listing) => {
    if (listing.imageUrl && !listing.imageUrl.startsWith('/mockups/')) {
      return listing;
    }
    const fingerprint = buildFingerprint(listing);
    const imageIndex = hashString(fingerprint) % imagePool.length;
    return {
      ...listing,
      imageUrl: `/mockups/${imagePool[imageIndex]}`,
    };
  });
}

/**
 * Cluster Telegram messages by groupedId (albums) or by sender + time proximity.
 * Each cluster has: { texts: string[], mediaMessages: Message[], senderId, startDate }
 */
function clusterMessages(messages, timeWindowSec = 120) {
  const groupedIdMap = new Map();
  const ungrouped = [];

  for (const msg of messages) {
    if (msg.groupedId) {
      const gid = String(msg.groupedId);
      if (!groupedIdMap.has(gid)) {
        groupedIdMap.set(gid, []);
      }
      groupedIdMap.get(gid).push(msg);
    } else {
      ungrouped.push(msg);
    }
  }

  const clusters = [];

  // Build clusters from grouped albums
  for (const [, groupMsgs] of groupedIdMap) {
    const sorted = groupMsgs.sort((a, b) => (a.date || 0) - (b.date || 0));
    const senderId = getSenderId(sorted[0]);
    const texts = sorted
      .map((m) => m.message)
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim());
    const mediaMessages = sorted.filter((m) => m.media && m.media.photo);
    clusters.push({ texts, mediaMessages, senderId, startDate: sorted[0]?.date || 0 });
  }

  // Cluster ungrouped messages by sender + time proximity
  const sorted = ungrouped.sort((a, b) => (a.date || 0) - (b.date || 0));
  let current = null;

  for (const msg of sorted) {
    const senderId = getSenderId(msg);
    const msgDate = msg.date || 0;

    if (
      current &&
      current.senderId === senderId &&
      Math.abs(msgDate - current.lastDate) <= timeWindowSec
    ) {
      // Same sender, within time window — add to current cluster
      if (msg.message && msg.message.trim()) {
        current.texts.push(msg.message.trim());
      }
      if (msg.media && msg.media.photo) {
        current.mediaMessages.push(msg);
      }
      current.lastDate = msgDate;
    } else {
      // Start a new cluster
      if (current && (current.texts.length > 0 || current.mediaMessages.length > 0)) {
        clusters.push(current);
      }
      current = {
        texts: msg.message && msg.message.trim() ? [msg.message.trim()] : [],
        mediaMessages: msg.media && msg.media.photo ? [msg] : [],
        senderId,
        startDate: msgDate,
        lastDate: msgDate,
      };
    }
  }
  if (current && (current.texts.length > 0 || current.mediaMessages.length > 0)) {
    clusters.push(current);
  }

  return clusters;
}

function getSenderId(msg) {
  if (msg.fromId) {
    return String(msg.fromId.userId || msg.fromId.channelId || msg.fromId);
  }
  if (msg.peerId) {
    return String(msg.peerId.userId || msg.peerId.channelId || msg.peerId);
  }
  return 'unknown';
}

const photosDir = path.join(__dirname, '../public/photos');
// Ensure photos directory exists before any downloads
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

async function downloadClusterPhotos(client, cluster, maxPhotos = 4) {
  const downloaded = [];
  const toDownload = cluster.mediaMessages.slice(0, maxPhotos);

  for (const msg of toDownload) {
    try {
      const buffer = await client.downloadMedia(msg, {});
      if (!buffer || buffer.length === 0) continue;

      const filename = `tg_${msg.id}_${Date.now()}.jpg`;
      const filepath = path.join(photosDir, filename);
      fs.writeFileSync(filepath, buffer);
      downloaded.push(`/photos/${filename}`);
    } catch (err) {
      console.warn(`Failed to download photo from message ${msg.id}:`, err.message);
    }
  }

  return downloaded;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createMessageBatch(messages, minimumMessageId = 0) {
  const nextMessages = Array.isArray(messages) ? messages : [];
  const latestMessageId = nextMessages.reduce(
    (highest, message) => Math.max(highest, Number(message?.id) || 0),
    minimumMessageId,
  );

  const newMessages = nextMessages.filter(
    (message) => (Number(message?.id) || 0) > minimumMessageId,
  );

  return {
    latestMessageId,
    newMessages,
  };
}

async function runTelegramScrape(client, state = {}) {
  const messages = await client.getMessages(channelUsername, {
    limit: Number.isFinite(fetchLimit) ? fetchLimit : 30,
  });

  const { latestMessageId, newMessages } = createMessageBatch(messages, state.lastSeenMessageId || 0);

  console.log(
    `Fetched ${messages.length} messages, ${newMessages.length} new message(s), latest id ${latestMessageId}.`,
  );

  state.lastSeenMessageId = latestMessageId;

  if (newMessages.length === 0) {
    return {
      fetchedMessages: messages.length,
      extractedListings: 0,
      inserted: 0,
      skipped: 0,
      snapshotCount: readSnapshotListings().length,
      wroteSnapshot: false,
    };
  }

  // Cluster messages by sender + time proximity or groupedId (albums)
  const clusters = clusterMessages(newMessages);
  const clustersWithText = clusters.filter((c) => c.texts.length > 0);
  console.log(
    `Grouped into ${clusters.length} cluster(s), ${clustersWithText.length} with text.`,
  );

  if (clustersWithText.length === 0) {
    return {
      fetchedMessages: messages.length,
      extractedListings: 0,
      inserted: 0,
      skipped: 0,
      snapshotCount: readSnapshotListings().length,
      wroteSnapshot: false,
    };
  }

  // Download photos for each cluster
  const clusterPhotos = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];
    if (cluster.mediaMessages.length > 0) {
      const photos = await downloadClusterPhotos(client, cluster);
      if (photos.length > 0) {
        clusterPhotos.set(i, photos);
        console.log(`  Cluster ${i}: downloaded ${photos.length} photo(s)`);
      }
    }
  }

  // Build prompt text with cluster IDs so Gemini can label which cluster each listing came from
  const rawText = clustersWithText
    .map((cluster, idx) => {
      const clusterIdx = clusters.indexOf(cluster);
      return `[CLUSTER ${clusterIdx}]\n${cluster.texts.join('\n')}`;
    })
    .join('\n\n---\n\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: buildPrompt(rawText),
    config: {
      responseMimeType: 'application/json',
    },
  });

  const parsedListings = parseModelJson(response.text);
  console.log(`Model returned ${parsedListings.length} listing candidate(s).`);

  // Assign real photos, original post time, and source channel to listings based on cluster_id
  const listingsWithPhotos = parsedListings.map((listing) => {
    const clusterId = listing.cluster_id;
    const cluster = clusters[clusterId];
    const photos = clusterPhotos.get(clusterId);
    const enriched = { ...listing };

    if (photos && photos.length > 0) {
      enriched.imageUrl = photos[0];
    }

    // Attach original Telegram post timestamp and source channel
    if (cluster && cluster.startDate) {
      enriched.postedAt = new Date(cluster.startDate * 1000).toISOString();
    }
    enriched.sourceChannel = `@${channelUsername}`;

    return enriched;
  });

  const normalizedListings = normalizeExtractedListings(listingsWithPhotos, {
    source: 'snapshot',
  });
  console.log(`Normalized ${normalizedListings.length} unique listing(s).`);

  if (normalizedListings.length === 0) {
    return {
      fetchedMessages: messages.length,
      extractedListings: 0,
      inserted: 0,
      skipped: 0,
      snapshotCount: readSnapshotListings().length,
      wroteSnapshot: false,
    };
  }

  // Fall back to mockup images for any listings without real photos
  const mockupsDir = path.join(__dirname, '../public/mockups');
  const files = fs
    .readdirSync(mockupsDir)
    .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'));

  const listingsWithImages = attachImages(normalizedListings, files);
  const mergedSnapshot = mergeSnapshotListings(listingsWithImages, readSnapshotListings(), {
    limit: snapshotLimit,
  });
  const wroteSnapshot = writeSnapshotListings(mergedSnapshot);

  let inserted = 0;
  let skipped = 0;

  if (supabase) {
    const syncResult = await insertListingsIfPossible(supabase, listingsWithImages);
    inserted = syncResult.inserted;
    skipped = syncResult.skipped;
    console.log(`Supabase sync complete. Inserted: ${inserted}, skipped: ${skipped}`);
  } else {
    skipped = listingsWithImages.length;
    console.log('Supabase service role key not configured. Snapshot-only mode complete.');
  }

  // Export photos to Google Drive + listing data to Google Sheets
  try {
    await exportToGoogle(listingsWithImages);
  } catch (err) {
    console.warn('Google export failed (non-fatal):', err.message);
  }

  return {
    fetchedMessages: messages.length,
    extractedListings: listingsWithImages.length,
    inserted,
    skipped,
    snapshotCount: mergedSnapshot.length,
    wroteSnapshot,
  };
}

async function main() {
  console.log(
    `Starting Telegram scraper for @${channelUsername}${watchMode ? ` in watch mode (${pollIntervalMs}ms)` : '...'}`,
  );

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  const state = {
    lastSeenMessageId: 0,
    shouldStop: false,
  };

  process.on('SIGINT', () => {
    state.shouldStop = true;
  });

  process.on('SIGTERM', () => {
    state.shouldStop = true;
  });

  await client.connect();

  try {
    do {
      const startedAt = Date.now();

      try {
        const result = await runTelegramScrape(client, state);
        console.log(
          `Scrape cycle complete. Extracted: ${result.extractedListings}, snapshot size: ${result.snapshotCount}.`,
        );
      } catch (error) {
        console.error('Error fetching or parsing Telegram messages:', error.message);
        if (!watchMode) {
          process.exitCode = 1;
          break;
        }
      }

      if (!watchMode || state.shouldStop) {
        break;
      }

      const waitTime = Math.max(5_000, pollIntervalMs - (Date.now() - startedAt));
      console.log(`Waiting ${waitTime}ms before the next Telegram intake cycle...`);
      await delay(waitTime);
    } while (!state.shouldStop);
  } finally {
    await client.disconnect();
  }
}

main();
