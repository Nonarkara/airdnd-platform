import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createDataClient } from './lib/local_db.js';
import { uploadPhoto, appendToSheet } from './google_service.js';
import {
  dedupeListings,
  insertListingsIfPossible,
  normalizeExtractedListings,
  parseModelJson,
  readSnapshotListings,
  writeSnapshotListings,
} from './listing_pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const sheetId = process.env.GOOGLE_SHEET_ID;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const forwardGroupId = process.env.TELEGRAM_FORWARD_GROUP_ID
  ? Number(process.env.TELEGRAM_FORWARD_GROUP_ID)
  : null;

const FORWARD_FLUSH_DELAY = 5000;
const MAX_BUFFER_AGE_MS = 60000;
const forwardBuffer = new Map();

if (!botToken || !geminiApiKey) {
  console.error('Missing TELEGRAM_BOT_TOKEN or GEMINI_API_KEY. Telegram bot is disabled.');
} else {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const bot = new TelegramBot(botToken, { polling: true });
  const mockupsDir = path.join(__dirname, '../public/mockups');
  const availableImages = fs
    .readdirSync(mockupsDir)
    .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'));
  const pendingPhotos = [];
  // Listings go to the M3's local Postgres (DATABASE_URL); Supabase is retired.
  void supabaseUrl; void supabaseServiceRoleKey;
  const supabase = createDataClient();

  function buildPrompt(rawText) {
    return `
Extract distinct massage/spa/wellness listing profiles from the following message.
Return only a JSON array with this shape:
[
  {
    "name": "Business or provider name",
    "location": "District or area, City/Province",
    "price": "1500 THB or null",
    "description": "Short factual summary of services, area, and availability",
    "phone": "0XX-XXX-XXXX or null",
    "hours": "10:00-23:00 or null",
    "lineUrl": "https://line.me/... or null",
    "telegramUrl": "https://t.me/... or null",
    "mapsUrl": "https://maps.app.goo.gl/... or null",
    "tags": ["Bangkok", "Massage", "Thai Massage"],
    "age": null,
    "metrics": {},
    "user_rating": null,
    "service_quality": [],
    "user_feedback_summary": null
  }
]

Rules:
- Extract ALL contact info: phone numbers, LINE links, Telegram links, Google Maps links.
- Extract operating hours when visible.
- Extract price or price range when visible.
- Use 1-3 tags for city, district, and service type (Thai massage, oil massage, spa, reflexology, etc.).
- Ignore admin announcements, group rules, or non-listing content.
- Keep descriptions factual and concise.
- Use null for unknown values.

User feedback & ratings extraction:
- If users mention ratings (e.g., "10/10", "5 stars", "4.5/5"), normalize to a 1.0-5.0 scale in user_rating.
- Extract service quality keywords into service_quality array: "clean", "friendly", "skilled", "professional", "relaxing", "value", "private", "late_night".
- If the text contains genuine user reviews, summarize briefly in user_feedback_summary.
- Do NOT invent ratings or feedback. Only extract what users explicitly stated.

Message:
${rawText}
`;
  }

  function assignImages(listings) {
    return listings.map((listing) => {
      pendingPhotos.shift();

      return {
        ...listing,
        imageUrl: listing.imageUrl && !listing.imageUrl.startsWith('/mockups/') ? listing.imageUrl : null,
      };
    });
  }

  async function handleForwardedMessage(msg) {
    const chatId = msg.chat.id;
    const sourceChat = msg.forward_from_chat;
    const sourceLabel = sourceChat
      ? (sourceChat.username ? `@${sourceChat.username}` : sourceChat.title)
      : 'unknown';
    const sourceId = sourceChat?.id || 0;
    const bufferKey = `${chatId}:${sourceId}`;

    if (!forwardBuffer.has(bufferKey)) {
      forwardBuffer.set(bufferKey, {
        texts: [],
        photos: [],
        timer: null,
        sourceLabel,
        chatId,
        createdAt: Date.now(),
      });
      console.log(`Buffering forwarded message from ${sourceLabel}...`);
    }

    // Force-flush if buffer has been accumulating too long (prevents memory leak)
    const buf0 = forwardBuffer.get(bufferKey);
    if (buf0 && Date.now() - buf0.createdAt > MAX_BUFFER_AGE_MS) {
      if (buf0.timer) clearTimeout(buf0.timer);
      await flushForwardBatch(bufferKey);
      return;
    }

    const buf = forwardBuffer.get(bufferKey);
    const text = msg.text || msg.caption;
    if (text) {
      buf.texts.push(text);
    }

    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
    if (hasPhoto) {
      try {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const downloadedPath = await bot.downloadFile(fileId, mockupsDir);
        const fileName = path.basename(downloadedPath);
        if (!availableImages.includes(fileName)) {
          availableImages.push(fileName);
        }
        buf.photos.push(fileName);
        if (driveFolderId) {
          uploadPhoto(downloadedPath, driveFolderId, fileName).catch((err) => {
            console.error('Failed to upload forwarded photo to Drive:', err.message);
          });
        }
      } catch (err) {
        console.error('Failed to download forwarded photo:', err.message);
      }
    }

    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => flushForwardBatch(bufferKey), FORWARD_FLUSH_DELAY);
  }

  async function flushForwardBatch(bufferKey) {
    const buf = forwardBuffer.get(bufferKey);
    if (!buf) return;
    forwardBuffer.delete(bufferKey);

    const { texts, photos, sourceLabel, chatId } = buf;
    const combinedText = texts.join('\n\n---\n\n');

    if (!combinedText.trim() && photos.length === 0) return;

    console.log(`Flushing ${texts.length} text(s) + ${photos.length} photo(s) from ${sourceLabel}`);

    for (const p of photos) {
      pendingPhotos.push(p);
    }

    if (!combinedText.trim()) {
      console.log(`Skipping batch from ${sourceLabel}: photos only, no text to extract.`);
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildPrompt(combinedText),
        config: { responseMimeType: 'application/json' },
      });

      const parsedListings = parseModelJson(response.text).map((l) => ({
        ...l,
        rawText: combinedText,
      }));
      const normalizedListings = normalizeExtractedListings(parsedListings, {
        source: 'bot-forward',
        sourceChannel: sourceLabel,
      });

      if (normalizedListings.length === 0) {
        console.log(`No listings extracted from ${sourceLabel} batch. Text preview: ${combinedText.slice(0, 200)}`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const listingsWithImages = assignImages(normalizedListings);
      const mergedSnapshot = dedupeListings([
        ...listingsWithImages,
        ...readSnapshotListings(),
      ]);
      writeSnapshotListings(mergedSnapshot);

      let inserted = 0;
      if (supabase) {
        const syncResult = await insertListingsIfPossible(supabase, listingsWithImages);
        inserted = syncResult.inserted;
      }

      if (sheetId) {
        const timestamp = new Date().toISOString();
        for (const listing of listingsWithImages) {
          try {
            await appendToSheet(sheetId, [
              timestamp,
              listing.name,
              listing.age ?? '',
              listing.location,
              listing.priceLabel,
              listing.tags.join(', '),
            ]);
          } catch (err) {
            console.error('Failed to append to Google Sheets:', err.message);
          }
        }
      }

      const names = listingsWithImages.map((l) => l.name).join(', ');
      console.log(`Processed ${listingsWithImages.length} listing(s) from ${sourceLabel}: ${names}`);
      await bot.sendMessage(
        chatId,
        `Forwarded batch from ${sourceLabel}: saved ${listingsWithImages.length} listing(s) (${names}). Supabase inserted ${inserted}.`,
      );
    } catch (err) {
      console.error(`Failed to process forward batch from ${sourceLabel}:`, err.message);
      await bot.sendMessage(chatId, `Failed to process forwarded batch from ${sourceLabel}.`);
    }
  }

  console.log('Sabai bot is running...');
  if (forwardGroupId) {
    console.log(`Forward pipeline active for group ${forwardGroupId}`);
  } else {
    console.log('Forward pipeline active for all chats (no TELEGRAM_FORWARD_GROUP_ID set)');
  }
  console.log(`Supabase: ${supabase ? 'connected' : 'not configured'}`);

  function isForwardedMessage(msg) {
    return !!(msg.forward_from_chat || msg.forward_from || msg.forward_origin);
  }

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (isForwardedMessage(msg)) {
      if (forwardGroupId && chatId !== forwardGroupId) return;
      await handleForwardedMessage(msg);
      return;
    }

    const text = msg.text || msg.caption;
    const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;

    if (!text && !hasPhoto) {
      return;
    }

    if (text && text.startsWith('/start')) {
      await bot.sendMessage(
        chatId,
        'Forward listing messages here. The bot will normalize them, preserve the best snapshot, and try to sync Supabase when configured.',
      );
      return;
    }

    try {
      if (hasPhoto) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const downloadedPath = await bot.downloadFile(fileId, mockupsDir);
        const originalFileName = path.basename(downloadedPath);

        if (!availableImages.includes(originalFileName)) {
          availableImages.push(originalFileName);
        }

        pendingPhotos.push(originalFileName);

        if (driveFolderId) {
          uploadPhoto(downloadedPath, driveFolderId, originalFileName).catch((error) => {
            console.error('Failed to upload photo to Google Drive:', error.message);
          });
        }
      }

      if (!text) {
        return;
      }

      await bot.sendMessage(chatId, 'Processing the forwarded listing and updating the snapshot...');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildPrompt(text),
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsedListings = parseModelJson(response.text).map((l) => ({
        ...l,
        rawText: text,
      }));
      const normalizedListings = normalizeExtractedListings(parsedListings, {
        source: 'snapshot',
      });

      if (normalizedListings.length === 0) {
        await bot.sendMessage(chatId, 'No valid listing was detected. The existing snapshot was left unchanged.');
        return;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 1200);
      });

      const listingsWithImages = assignImages(normalizedListings);
      const mergedSnapshot = dedupeListings([
        ...listingsWithImages,
        ...readSnapshotListings(),
      ]);

      writeSnapshotListings(mergedSnapshot);

      let inserted = 0;
      if (supabase) {
        const syncResult = await insertListingsIfPossible(supabase, listingsWithImages);
        inserted = syncResult.inserted;
      }

      if (sheetId) {
        const timestamp = new Date().toISOString();

        for (const listing of listingsWithImages) {
          try {
            await appendToSheet(sheetId, [
              timestamp,
              listing.name,
              listing.age ?? '',
              listing.location,
              listing.priceLabel,
              listing.tags.join(', '),
            ]);
          } catch (error) {
            console.error('Failed to append row to Google Sheets:', error.message);
          }
        }
      }

      const names = listingsWithImages.map((listing) => listing.name).join(', ');
      await bot.sendMessage(
        chatId,
        `Saved ${listingsWithImages.length} listing(s) to the snapshot (${names}). Supabase inserted ${inserted}.`,
      );
    } catch (error) {
      console.error('Bot processing error:', error.message);
      await bot.sendMessage(chatId, 'The message could not be parsed. The existing snapshot was preserved.');
    }
  });

  bot.on('channel_post', async (msg) => {
    if (isForwardedMessage(msg)) {
      if (forwardGroupId && msg.chat.id !== forwardGroupId) return;
      await handleForwardedMessage(msg);
    }
  });
}
