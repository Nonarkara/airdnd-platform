// Seed (or top up) the local SQLite station from a JSON export.
//
// Bootstrap flow on the Mac:
//   1. Export the current cloud data (or just use the committed public/data.json).
//   2. LOCAL_DB_PATH=/Volumes/BigDrive/sabai/sabai.db node scripts/import_to_local.js
//
// The import runs every record through the same pipeline the scraper uses
// (normalisation, phone/maps/line dedup, quality gate) so the local database
// starts life already deduplicated. Running it again is safe: existing rows are
// matched and their mention_count is bumped rather than duplicated.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openLocalDb, countRows } from './lib/local_store.js';
import { createLocalSupabaseShim } from './lib/supabase_local_shim.js';
import { insertListingsIfPossible } from './listing_pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const sourceArg = process.argv[2];
  const sourcePath = path.resolve(sourceArg || path.join(__dirname, '..', 'public', 'data.json'));

  if (!fs.existsSync(sourcePath)) {
    console.error(`Import source not found: ${sourcePath}`);
    process.exit(1);
  }

  let records;
  try {
    records = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (error) {
    console.error(`Could not parse ${sourcePath}: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(records) || records.length === 0) {
    console.error(`No records to import from ${sourcePath}`);
    process.exit(1);
  }

  const db = openLocalDb();
  const shim = createLocalSupabaseShim(db);

  console.log(`Importing ${records.length} record(s) from ${sourcePath} ...`);
  const result = await insertListingsIfPossible(shim, records);
  const total = countRows(db, 'companions');

  console.log(
    `Import complete. inserted=${result.inserted} matched/updated=${result.skipped} rejected=${result.rejected}`,
  );
  console.log(`companions table now holds ${total} row(s).`);
  db.close();
}

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exit(1);
});
