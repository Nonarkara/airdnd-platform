import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || ''); // fill this later

const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

if (!apiId || !apiHash) {
    console.error('⚠️ Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env.');
    process.exit(1);
}

(async () => {
    console.log('Loading interactive GramJS session...');
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input.text('Phone number (international format e.g. +1234567890): '),
        password: async () => await input.text('Password (if 2FA enabled): '),
        phoneCode: async () => await input.text('Code received on Telegram: '),
        onError: (err) => console.log(err),
    });

    console.log('You are successfully logged in!');
    console.log('Save this string session in your .env file as TELEGRAM_SESSION to avoid logging in again:');
    console.log(client.session.save());

    // Add event listener for new messages
    client.addEventHandler(async (event) => {
        const message = event.message;
        const text = message.message || message.text;

        // Ensure you only process messages from specific groups or channels
        // For testing, we will process messages that match a certain pattern or from 'me'
        if (text && text.includes('Price:') && text.includes('Age:')) {
            console.log('Detected potential profile in userbot stream!');

            try {
                const prompt = `
                Extract companion details from the following message.
                Respond ONLY with a JSON array exactly matching this format:
                [{
                  "name": "Name", "age": 25, "location": "City", "price": "e.g. ฿1,200/hr",
                  "metrics": { "height": "...", "weight": "..." }, "rating": 4.8, "reviews": 50,
                  "tags": ["Tag1"], "description": "Short bio"
                }]
                Raw message: ${text}
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { responseMimeType: 'application/json' }
                });

                let newCompanions = JSON.parse(response.text);
                if (newCompanions.length === 0) return;

                for (let companion of newCompanions) {
                    // Mock an image URL sequentially 
                    companion.image_url = '/mockups/file_1.jpg'; // We can enhance this later to parse GramJS media!

                    const { data, error } = await supabase.from('companions').insert([companion]);
                    if (error) {
                        console.error('Supabase Insert Error:', error.message);
                    } else {
                        console.log(`✅ Automatically scraped and inserted ${companion.name} into Database!`);
                    }
                }
            } catch (err) {
                console.error('Error processing zero-touch message:', err.message);
            }
        }
    });

    console.log('Userbot is now silently listening to all your incoming Telegram messages...');
})();
