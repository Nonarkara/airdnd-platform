import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Configuration
const supabaseUrl = 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '<SUPABASE_SERVICE_ROLE_KEY>';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
    console.log('Starting seed process...');
    const dataPath = path.join(__dirname, '..', 'public', 'data.json');

    if (!fs.existsSync(dataPath)) {
        console.error('No data.json found at:', dataPath);
        process.exit(1);
    }

    const companionsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`Found ${companionsData.length} companions to migrate.`);

    for (const companion of companionsData) {
        try {
            // Check if companion already exists to avoid duplicates during testing
            const { data: existing, error: searchError } = await supabase
                .from('companions')
                .select('id')
                .eq('name', companion.name)
                .single();

            if (existing) {
                console.log(`Skipping ${companion.name} - already exists.`);
                continue;
            }

            const { data, error } = await supabase
                .from('companions')
                .insert([
                    {
                        name: companion.name,
                        age: parseInt(companion.age) || null,
                        location: companion.location,
                        price: companion.price,
                        description: companion.description,
                        image_url: companion.imageUrl,
                        rating: companion.rating || 0.0,
                        reviews: companion.reviews || 0,
                        availability: companion.availability,
                        tags: companion.tags || [],
                        metrics: companion.metrics || {}
                    }
                ]);

            if (error) {
                console.error(`Error inserting ${companion.name}:`, error.message);
            } else {
                console.log(`Successfully migrated ${companion.name}`);
            }
        } catch (err) {
            console.error(`Failed to process ${companion.name}:`, err.message);
        }
    }

    console.log('Seed process completed successfully.');
    process.exit(0);
}

seedDatabase();
