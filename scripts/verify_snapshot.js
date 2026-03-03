import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotPath = path.join(__dirname, '../public/data.json');

try {
  const raw = fs.readFileSync(snapshotPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('Snapshot check failed: public/data.json is empty.');
    process.exit(1);
  }

  console.log(`Snapshot ready: ${parsed.length} listing(s) available in public/data.json`);
} catch (error) {
  console.error('Snapshot check failed:', error.message);
  process.exit(1);
}
