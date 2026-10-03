#!/usr/bin/env node
/**
 * Back up the local store (scripts/lib/db_backup.js). Run nightly by the
 * com.sabai.backup worker; by hand: npm run ops:backup
 *
 * Destination: BACKUP_DIR in .env (ideally a different disk from the
 * database), else <repo>/backups.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { backupDatabase } from './lib/db_backup.js';
import { recordStatus } from './ops/status.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const { DEFAULT_DB_PATH } = await import('./lib/local_store.js');
const dbPath = path.resolve(process.env.LOCAL_DB_PATH || DEFAULT_DB_PATH);
const destDir = path.resolve(process.env.BACKUP_DIR || path.join(ROOT, 'backups'));

try {
  const result = await backupDatabase({ dbPath, destDir, root: ROOT });
  recordStatus('backup', { ok: result.ok, file: result.file, bytes: result.bytes, counts: result.counts, error: result.error });
  if (!result.ok) {
    console.error(`BACKUP FAILED — ${result.error}`);
    process.exit(1);
  }
  const mb = (result.bytes / 1_048_576).toFixed(1);
  console.log(`backup ok: ${result.file} (${mb} MB) · ${Object.entries(result.counts).map(([t, n]) => `${t} ${n}`).join(' · ')}`);
  if (result.removed.length) console.log(`rotated out: ${result.removed.join(', ')}`);
} catch (error) {
  recordStatus('backup', { ok: false, error: error.message });
  console.error(`BACKUP FAILED — ${error.message}`);
  process.exit(1);
}
