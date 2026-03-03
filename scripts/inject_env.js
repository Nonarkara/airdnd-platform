import fs from 'fs';
import path from 'path';

const supabasePath = path.join(process.cwd(), 'src', 'lib', 'supabase.js');

let content = fs.readFileSync(supabasePath, 'utf8');

// The environment variables provided by Render
const url = process.env.VITE_SUPABASE_URL || 'https://fehdtfncbutesgadjsxp.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mf3Wmwk6mMO-EoYaDxMUvA_CihTsTBF';

// Hardcode them into the file for Vite to bundle
content = content.replace(/import\.meta\.env\.VITE_SUPABASE_URL\s*\|\|\s*'[^']*'/, `'${url}'`);
content = content.replace(/import\.meta\.env\.VITE_SUPABASE_ANON_KEY\s*\|\|\s*'[^']*'/, `'${key}'`);

fs.writeFileSync(supabasePath, content, 'utf8');
console.log('Successfully injected Production Supabase variables directly into src/lib/supabase.js');
