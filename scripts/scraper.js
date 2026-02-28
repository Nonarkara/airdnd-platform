/* global process */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const ai = new GoogleGenAI({
    apiKey: apiKey
});

async function main() {
    if (!apiKey) {
        console.error('⚠️ Missing GEMINI_API_KEY in environment or .env file.');
        console.error('Please add it to .env or export it before running.');
        process.exit(1);
    }

    console.log('Starting Air DnD Data Scraper & Parser...');

    const sampleDataPath = path.join(__dirname, 'sample_data.txt');
    let rawText;
    try {
        rawText = fs.readFileSync(sampleDataPath, 'utf-8');
        console.log(`Read raw data (${rawText.length} bytes). Passing to Gemini...`);
    } catch (err) {
        console.error('Could not read sample_data.txt', err);
        process.exit(1);
    }

    const prompt = `
    Extract all distinct companions/masseuses from the following unstructured broadcast message.
    Respond ONLY with a JSON array where each object matches this format:
    [{
      "id": 1,
      "name": "Extracted Name",
      "age": (integer),
      "location": "Location from text, or 'Bangkok, TH' if none",
      "price": "Extracted rate e.g., '฿1,200/hr'",
      "metrics": { "height": "(e.g. 160cm)", "weight": "(e.g. 45kg)" },
      "rating": (random float between 4.5 and 5.0),
      "reviews": (random integer between 10 and 300),
      "tags": ["Tag1", "Tag2"],
      "description": "Short summary from the text"
    }]
    
    Raw message:
    ${rawText}
  `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const parsedData = JSON.parse(response.text);

        const mockupsDir = path.join(__dirname, '../public/mockups');
        const files = fs.readdirSync(mockupsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

        let mockIdx = 0;
        for (let companion of parsedData) {
            companion.imageUrl = `/mockups/${files[mockIdx % files.length]}`;
            mockIdx++;
        }

        const outPath = path.join(__dirname, '../public/data.json');
        fs.writeFileSync(outPath, JSON.stringify(parsedData, null, 2));

        console.log(`✅ Successfully parsed ${parsedData.length} profiles and wrote to public/data.json!`);

    } catch (err) {
        console.error('Error during scraping/parsing:', err);
    }
}

main();
