#!/usr/bin/env node
/**
 * export_supabase.js — Export all Supabase data to JSON files for M3 import.
 *
 * Run: node scripts/migrate/export_supabase.js
 * Output: scripts/migrate/export/*.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const EXPORT_DIR = path.join(__dirname, 'export');
fs.mkdirSync(EXPORT_DIR, { recursive: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function exportTable(tableName, filename) {
  console.log(`Exporting ${tableName}...`);
  const allRows = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + batchSize - 1)
      .order('id', { ascending: true });

    if (error) {
      console.error(`  Error at offset ${offset}: ${error.message}`);
      break;
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    offset += batchSize;

    if (data.length < batchSize) break;
  }

  const outPath = path.join(EXPORT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(allRows, null, 2));
  console.log(`  ${allRows.length} rows → ${outPath}`);
  return allRows.length;
}

async function main() {
  const report = {};
  report.companions = await exportTable('companions', 'companions.json');
  report.channel_messages = await exportTable('channel_messages', 'channel_messages.json');
  report.photo_archive = await exportTable('photo_archive', 'photo_archive.json');
  report.page_views = await exportTable('page_views', 'page_views.json');
  report.signals = await exportTable('signals', 'signals.json');

  fs.writeFileSync(path.join(EXPORT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\nExport complete:', report);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});