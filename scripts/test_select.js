import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    const { data, error } = await supabase.from('companions').select('*');
    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log(`Fetched ${data.length} records successfully using Anon Key.`);
        if (data.length > 0) {
            console.log("Sample Data Output:");
            console.dir(data[0], { depth: null });
        }
    }
}

testQuery();
