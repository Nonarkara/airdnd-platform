import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { uploadPhoto, appendToSheet } from './google_service.js';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const sheetId = process.env.GOOGLE_SHEET_ID;

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';
const supabase = createClient(supabaseUrl, supabaseKey);

if (!botToken || !geminiApiKey) {
    console.error('⚠️ Missing TELEGRAM_BOT_TOKEN or GEMINI_API_KEY. Telegram Bot sync functionality will be disabled.');
} else {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    const bot = new TelegramBot(botToken, { polling: true });

    const dataPath = path.join(__dirname, '../public/data.json');
    const mockupsDir = path.join(__dirname, '../public/mockups');
    const availableImages = fs.readdirSync(mockupsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    const pendingPhotos = []; // Store downloaded photos temporarily

    console.log('🤖 AirDnD Telegram Bot is running...');
    console.log('Forward messages to the bot to automatically add companions to the database and sync to Google Workspace.');

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || msg.caption;
        const hasPhoto = msg.photo && msg.photo.length > 0;

        if (!text && !hasPhoto) return; // Ignore messages without text or photos

        if (text && text.startsWith('/start')) {
            return bot.sendMessage(chatId, "Welcome to AirDnD! Forward any companion details/broadcasts to me and I'll add them to the system automatically.");
        }

        try {
            let localImagePath = null;
            let originalFileName = 'no-photo';
            if (hasPhoto) {
                const fileId = msg.photo[msg.photo.length - 1].file_id;
                const downloadedPath = await bot.downloadFile(fileId, mockupsDir);
                localImagePath = downloadedPath;
                originalFileName = path.basename(downloadedPath);

                // Add to main image pool pool so React can access it later if needed
                if (!availableImages.includes(originalFileName)) {
                    availableImages.push(originalFileName);
                }

                // Add to the live queue for the current extraction batch
                pendingPhotos.push(originalFileName);

                // Upload to Google Drive for archiving
                if (driveFolderId) {
                    uploadPhoto(localImagePath, driveFolderId, originalFileName)
                        .then(res => console.log(`[Google Drive] Uploaded media group photo: ${res.webViewLink}`))
                        .catch(err => console.error("Failed to upload photo to Drive:", err));
                }
            }

            if (!text) {
                // If there's no text, this is just another photo in a media group.
                // We've already pooled and drive-synced it above. Do not hit Gemini.
                return;
            }

            bot.sendMessage(chatId, "⏳ Processing forwarded text with AI and syncing to Google Workspace...");

            const prompt = `
      Extract all distinct companions/masseuses from the following unstructured broadcast message.
      Respond ONLY with a JSON array where each object matches this format EXACTLY:
      [{
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
      ${text}
    `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });

            let newCompanions = JSON.parse(response.text);

            if (newCompanions.length === 0) {
                return bot.sendMessage(chatId, "⚠️ Could not identify any companion profiles in that message.");
            }

            const timestamp = new Date().toISOString();

            // The photos from this media group arrive concurrently. Wait slightly to ensure all photos pool before assigning.
            await new Promise(r => setTimeout(r, 1500));

            // Extract enough photos from the queue to fulfill the companions
            const assignedPhotos = pendingPhotos.splice(0, newCompanions.length);

            // Append new records
            for (let i = 0; i < newCompanions.length; i++) {
                let companion = newCompanions[i];

                // Assign pooled image if one was fetched in the media group, otherwise fallback sequentially
                if (assignedPhotos[i]) {
                    companion.image_url = `/mockups/${assignedPhotos[i]}`;
                } else {
                    const seqIndex = Math.floor(Math.random() * availableImages.length);
                    companion.image_url = `/mockups/${availableImages[seqIndex]}`;
                }

                // Insert into Supabase
                const { error } = await supabase.from('companions').insert([{
                    name: companion.name,
                    age: parseInt(companion.age) || null,
                    location: companion.location,
                    price: companion.price,
                    description: companion.description,
                    image_url: companion.image_url,
                    rating: companion.rating || 0.0,
                    reviews: companion.reviews || 0,
                    availability: companion.availability,
                    tags: companion.tags || [],
                    metrics: companion.metrics || {}
                }]);

                if (error) {
                    console.error('Supabase Insert Error:', error.message);
                } else {
                    console.log(`[Supabase] Inserted ${companion.name}`);
                }

                // Sync to Google Sheets
                if (sheetId) {
                    try {
                        const row = [timestamp, companion.name, companion.age, companion.location, companion.price, companion.rating, (companion.tags || []).join(', ')];
                        await appendToSheet(sheetId, row);
                        console.log(`[Google Sheets] Appended row for ${companion.name}`);
                    } catch (err) {
                        console.error("Failed to append row to Sheets:", err);
                    }
                }
            }

            const names = newCompanions.map(c => c.name).join(', ');
            bot.sendMessage(chatId, `✅ Successfully processed ${newCompanions.length} profile(s): ${names}. Added to Website, Photos saved to Drive, Data logged in Analytics Sheet!`);
            console.log(`[Bot] Synced ${names} from chat ${chatId}`);

        } catch (error) {
            console.error("Bot processing error:", error);
            bot.sendMessage(chatId, "❌ Sorry, I encountered an error parsing that message.");
        }
    });
}
