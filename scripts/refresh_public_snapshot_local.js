// Refresh public/data.json from the local SQLite station (Supabase-free path).
//
// Usage:
//   LOCAL_DB_PATH=/Volumes/BigDrive/sabai/sabai.db node scripts/refresh_public_snapshot_local.js
//
// Reads the local `companions` table, canonicalises + slims the listings, and
// writes public/data.json — the same artifact the cloud refresh produced.

import path from 'path';
import { fileURLToPath } from 'url';
import { openLocalDb } from './lib/local_store.js';
import { exportSnapshotFromDb } from './lib/snapshot_export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = openLocalDb();
const publicDir = path.join(__dirname, '..', 'public');
const { count, outPath } = exportSnapshotFromDb(db, { publicDir });
db.close();

console.log(`Refreshed ${path.relative(process.cwd(), outPath)} with ${count} canonical public listing(s) from the local station.`);
