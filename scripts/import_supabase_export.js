#!/usr/bin/env node
/**
 * Load a Supabase export (scripts/supabase_export.js) into the local SQLite
 * store as a faithful copy.
 *
 *   LOCAL_DB_PATH=/Volumes/Backup/sabai/sabai.db \
 *     node scripts/import_supabase_export.js --from /Volumes/Backup/sabai-supabase-export
 *
 * Faithful means: every row, every column, the original ids. The tables point
 * at each other by id (photo_archive.linked_companion_id, channel_messages.
 * linked_companion_id, page_views.listing_id), so re-inserting through the
 * dedup pipeline — what scripts/import_to_local.js does for a JSON snapshot —
 * would break those links. This is a migration, not an ingestion.
 *
 * A column present in the export but unknown to the local schema is added
 * rather than dropped: nothing in the export may be silently lost. Safe to run
 * again — rows are upserted by id. Ends with a per-table count check.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { JSON_COLUMNS, countRows, openLocalDb, tableColumns } from './lib/local_store.js';

export const IMPORT_ORDER = ['companions', 'channel_messages', 'photo_archive', 'page_views', 'signals'];

function toSqlite(value, isJsonColumn) {
  if (value === undefined || value === null) return null;
  if (isJsonColumn || (typeof value === 'object')) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export async function importTable(db, table, file) {
  const jsonColumns = new Set(JSON_COLUMNS[table] || []);
  let columns = new Set(tableColumns(db, table));
  const statements = new Map();
  let rows = 0;
  let added = [];

  const input = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  db.exec('BEGIN');
  try {
    for await (const line of input) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const keys = Object.keys(row);
      for (const key of keys) {
        if (!columns.has(key)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN "${key.replace(/"/g, '')}" TEXT`);
          columns = new Set(tableColumns(db, table));
          added.push(key);
        }
      }
      const signature = keys.join(',');
      if (!statements.has(signature)) {
        const cols = keys.map((k) => `"${k}"`).join(', ');
        const marks = keys.map(() => '?').join(', ');
        statements.set(signature, db.prepare(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${marks})`));
      }
      statements.get(signature).run(...keys.map((k) => toSqlite(row[k], jsonColumns.has(k))));
      rows += 1;
      if (rows % 5000 === 0) { db.exec('COMMIT'); db.exec('BEGIN'); }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { table, inFile: rows, inDb: countRows(db, table), addedColumns: added };
}

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--from');
  const from = i >= 0 ? path.resolve(argv[i + 1]) : null;
  if (!from) throw new Error('usage: import_supabase_export.js --from <export dir>');
  const manifestPath = path.join(from, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.complete) console.warn('WARNING: the export manifest says INCOMPLETE — re-run the export first.');
  }

  // Referential checks are for the live pipeline; during a bulk copy the
  // tables arrive one at a time.
  const db = openLocalDb();
  db.exec('PRAGMA foreign_keys = OFF;');
  const results = [];
  for (const table of IMPORT_ORDER) {
    const file = path.join(from, 'tables', `${table}.ndjson`);
    if (!fs.existsSync(file)) { console.warn(`${table}: no export file, skipped`); continue; }
    const r = await importTable(db, table, file);
    results.push(r);
    const ok = r.inDb >= r.inFile ? 'ok' : 'MISSING ROWS';
    console.log(`${table.padEnd(18)} file ${String(r.inFile).padStart(7)} · local ${String(r.inDb).padStart(7)}  ${ok}${r.addedColumns.length ? `  (+columns: ${r.addedColumns.join(', ')})` : ''}`);
  }
  db.exec('PRAGMA foreign_keys = ON;');
  const complete = results.every((r) => r.inDb >= r.inFile);
  console.log(complete ? '\nCOMPLETE — every exported row is in the local store.' : '\nINCOMPLETE — see MISSING ROWS above.');
  if (!complete) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}
