import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  insertListingsIfPossible,
  normalizeExtractedListings,
  parseModelJson,
  writeSnapshotListings,
} from './listing_pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiId = Number.parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const channelUsername = process.env.TELEGRAM_SOURCE_CHANNEL || 'nutyes';
const fetchLimit = Number.parseInt(process.env.TELEGRAM_FETCH_LIMIT || '120', 10);

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
Extract distinct Thailand wellness or massage listings from the following Telegram messages.
Return only a JSON array with this shape:
[
  {
    "name": "Business or provider name",
    "age": null,
    "location": "District or area, City/Province",
    "price": null,
    "metrics": {},
    "tags": ["Bangkok", "Massage"],
    "description": "Short factual summary of the service, area, and hours"
  }
]

Rules:
- Extract a listing whenever a message clearly describes a massage shop, spa, or independent provider.
- Ignore pure links, empty media posts, or messages without enough listing detail.
- Prefer the business or provider name written in the message.
- Use null for unknown age and price values.
- Use an empty object for missing metrics.
- Add 1-3 short tags based on city/province and service type.
- Do not invent ratings or review counts.
- Keep descriptions factual and concise.
- Return only valid JSON.

Messages:
${rawText}
`;
}

function attachImages(listings, files) {
  const imagePool = Array.isArray(files) && files.length > 0 ? files : ['109748.jpg'];

  return listings.map((listing, index) => ({
    ...listing,
    imageUrl: `/mockups/${imagePool[index % imagePool.length]}`,
  }));
}

async function main() {
  console.log(`Starting Telegram scraper for @${channelUsername}...`);

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();

  try {
    const messages = await client.getMessages(channelUsername, {
      limit: Number.isFinite(fetchLimit) ? fetchLimit : 30,
    });

    const textMessages = messages
      .map((message) => message.message)
      .filter((message) => typeof message === 'string' && message.trim())
      .map((message) => message.trim());

    console.log(`Fetched ${messages.length} messages, ${textMessages.length} with text.`);

    const rawText = textMessages
      .join('\n\n---\n\n');

    if (!rawText.trim()) {
      console.log('No text messages found in the requested window. Snapshot preserved.');
      process.exit(0);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(rawText),
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedListings = parseModelJson(response.text);
    console.log(`Model returned ${parsedListings.length} listing candidate(s).`);

    const normalizedListings = normalizeExtractedListings(parsedListings, {
      source: 'snapshot',
    });
    console.log(`Normalized ${normalizedListings.length} unique listing(s).`);

    const mockupsDir = path.join(__dirname, '../public/mockups');
    const files = fs
      .readdirSync(mockupsDir)
      .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'));

    const listingsWithImages = attachImages(normalizedListings, files);
    const wroteSnapshot = writeSnapshotListings(listingsWithImages);

    if (!wroteSnapshot) {
      process.exit(0);
    }

    if (supabase) {
      const { inserted, skipped } = await insertListingsIfPossible(supabase, listingsWithImages);
      console.log(`Supabase sync complete. Inserted: ${inserted}, skipped: ${skipped}`);
    } else {
      console.log('Supabase service role key not configured. Snapshot-only mode complete.');
    }
  } catch (error) {
    console.error('Error fetching or parsing Telegram messages:', error.message);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

main();
