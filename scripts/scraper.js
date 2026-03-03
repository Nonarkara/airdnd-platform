import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey });
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

function buildPrompt(rawText) {
  return `
Extract distinct listing profiles from the following unstructured source text.
Return only a JSON array.

Each item must follow this shape:
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
- Ignore administrative posts or generic announcements.
- Do not invent ratings or review counts.
- Use null for age when it is missing.
- Keep descriptions factual and concise.

Raw text:
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
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY or GOOGLE_API_KEY.');
    process.exit(1);
  }

  console.log('Starting local sample scraper...');

  const sampleDataPath = path.join(__dirname, 'sample_data.txt');
  let rawText;

  try {
    rawText = fs.readFileSync(sampleDataPath, 'utf8');
  } catch (error) {
    console.error('Could not read sample_data.txt', error.message);
    process.exit(1);
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildPrompt(rawText),
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsedListings = parseModelJson(response.text);
    const normalizedListings = normalizeExtractedListings(parsedListings, {
      source: 'snapshot',
    });

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
    console.error('Error during sample scrape:', error.message);
    process.exit(1);
  }
}

main();
