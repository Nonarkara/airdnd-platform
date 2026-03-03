import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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
  const supabase =
    supabaseUrl && supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey)
      : null;

  function buildPrompt(rawText) {
    return `
Extract distinct listing profiles from the following forwarded message.
Return only a JSON array with this shape:
[
  {
    "name": "Listing name",
    "age": 27,
    "location": "District, City",
    "price": "฿1,200",
    "metrics": {
      "height": "165 cm",
      "weight": "49 kg"
    },
    "tags": ["Bangkok", "Wellness"],
    "description": "Short factual summary"
  }
]

Rules:
- Ignore admin text that does not describe a specific profile.
- Do not invent ratings or review counts.
- Keep descriptions factual and concise.
- Use null for unknown age values.

Message:
${rawText}
`;
  }

  function assignImages(listings) {
    const fallbackPool = availableImages.length > 0 ? availableImages : ['109748.jpg'];

    return listings.map((listing, index) => {
      const queuedPhoto = pendingPhotos.shift();
      const fileName = queuedPhoto || fallbackPool[index % fallbackPool.length];

      return {
        ...listing,
        imageUrl: `/mockups/${fileName}`,
      };
    });
  }

  console.log('Air DnD Telegram bot is running...');

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
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

      const parsedListings = parseModelJson(response.text);
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
}
