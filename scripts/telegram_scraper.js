/* global process */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!botToken || !apiId || !apiHash) {
    console.error('⚠️ Missing TELEGRAM_BOT_TOKEN, TELEGRAM_API_ID or TELEGRAM_API_HASH in .env');
    console.error('Please add them to your .env file to run the scraper.');
    process.exit(1);
}

if (!geminiApiKey) {
    console.error('⚠️ Missing GEMINI_API_KEY in .env');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const stringSession = new StringSession('');

async function main() {
    console.log('Starting Bot-Authenticated Telegram Scraper (GramJS)...');

    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        botAuthToken: botToken,
    });

    console.log('\\n✅ Connected to Telegram as a Bot!');

    const channelUsername = 'nutyes';
    console.log(`Fetching messages from @${channelUsername}...`);

    try {
        const messages = await client.getMessages(channelUsername, {
            limit: 15, // Get last 15 messages
        });

        let rawText = '';
        for (const msg of messages) {
            if (msg.message && msg.message.trim().length > 0) {
                rawText += msg.message + '\\n\\n---\\n\\n';
            }
        }

        if (!rawText.trim()) {
            console.log('No text messages found in the recent history of this channel.');
            process.exit(0);
        }

        console.log(`Read ${messages.length} recent messages.\\nPassing to Gemini for extraction...`);

        const prompt = `
      Extract all distinct companions/masseuses from the following unstructured broadcast messages.
      Respond ONLY with a JSON array where each object matches this format EXACTLY:
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
      
      Ignore administrative messages or generic announcements that don't describe a specific person.
      
      Raw messages:
      ${rawText}
    `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        let parsedData = [];
        try {
            parsedData = JSON.parse(response.text);
        } catch (err) {
            console.error("Failed to parse the JSON response from Gemini. It might not be formatted correctly.", err);
            console.log(response.text);
            process.exit(1);
        }

        const mockupsDir = path.join(__dirname, '../public/mockups');
        const files = fs.readdirSync(mockupsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

        let mockIdx = 0;
        for (let companion of parsedData) {
            companion.imageUrl = `/mockups/${files[mockIdx % files.length]}`;
            mockIdx++;
        }

        const outPath = path.join(__dirname, '../public/data.json');
        fs.writeFileSync(outPath, JSON.stringify(parsedData, null, 2));

        console.log(`✅ Successfully parsed ${parsedData.length} profiles from @${channelUsername} and wrote to public/data.json!`);

    } catch (err) {
        console.error('Error fetching/parsing messages:', err);
        console.error('Note: If the channel is private, the bot MUST be added as an admin/member to the channel to read its messages.');
    } finally {
        await client.disconnect();
    }
}

main();
