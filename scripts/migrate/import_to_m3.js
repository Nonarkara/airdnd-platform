#!/usr/bin/env node
/**
 * import_to_m3.js — Import exported Supabase data into M3 PostgreSQL.
 *
 * Run: node scripts/migrate/import_to_m3.js
 * Requires: PostgreSQL running on M3, schema.sql already applied.
 *
 * Connection: reads DATABASE_URL from environment or .env.m3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

// Try .env.m3 first (M3-specific), then .env
const envM3 = path.join(ROOT, '.env.m3');
if (fs.existsSync(envM3)) {
  dotenv.config({ path: envM3, quiet: true });
} else {
  dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Create .env.m3 with DATABASE_URL=postgresql://user:pass@host:5432/sabai');
  process.exit(1);
}

const EXPORT_DIR = path.join(__dirname, 'export');

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function importTable(tableName, filename, columns) {
  const filePath = path.join(EXPORT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipping ${tableName} (no ${filename})`);
    return 0;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (empty export)`);
    return 0;
  }

  console.log(`Importing ${tableName}: ${rows.length} rows...`);

  // Build column list from first row, filtering to only known columns
  const sampleKeys = Object.keys(rows[0]);
  const validCols = columns.filter((c) => sampleKeys.includes(c));
  const colList = validCols.join(', ');
  const placeholders = validCols.map((_, i) => `$${i + 1}`).join(', ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let imported = 0;
    for (const row of rows) {
      const values = validCols.map((col) => {
        const val = row[col];
        // Convert JSONB fields from objects/arrays to strings
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
      });

      try {
        await client.query(
          `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
        imported++;
      } catch (err) {
        // Skip rows with constraint violations (duplicates, bad data)
        if (imported === 0 || imported % 100 === 0) {
          console.warn(`  ${tableName}: skipped row due to: ${err.message.slice(0, 100)}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`  ${tableName}: ${imported}/${rows.length} imported`);
    return imported;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  ${tableName}: FAILED - ${err.message}`);
    return 0;
  } finally {
    client.release();
  }
}

async function main() {
  const COMPANION_COLS = [
    'id', 'name', 'age', 'location', 'city', 'price', 'description', 'image_url',
    'rating', 'reviews', 'availability', 'tags', 'metrics',
    'phone', 'phone_normalized', 'hours', 'line_url', 'telegram_url', 'maps_url',
    'latitude', 'longitude', 'source_channel', 'source_target', 'canonical_key',
    'mention_count', 'is_safe_image', 'compliance_tier',
    'raw_text', 'source_message_ids', 'photo_urls', 'drive_photo_urls', 'all_photo_urls',
    'discussion_notes', 'user_feedback', 'user_feedback_summary', 'user_rating', 'service_tags',
    'created_at', 'updated_at',
  ];

  const MESSAGE_COLS = [
    'id', 'telegram_message_id', 'channel_id', 'channel_name', 'sender_id',
    'message_text', 'message_date', 'has_media', 'media_type', 'photo_url',
    'reply_to_message_id', 'grouped_id', 'cluster_id', 'message_type',
    'linked_companion_id', 'raw_json', 'created_at',
  ];

  const PHOTO_COLS = [
    'id', 'telegram_message_id', 'channel_id', 'channel_name', 'sender_id',
    'message_date', 'original_filename', 'stored_filename', 'local_path',
    'supabase_url', 'file_size_bytes', 'media_type', 'mime_type',
    'photo_telegram_id', 'grouped_id', 'linked_companion_id', 'created_at',
  ];

  const PAGE_VIEW_COLS = [
    'id', 'session_id', 'page', 'referrer', 'user_agent', 'language',
    'screen_w', 'screen_h', 'country', 'city', 'latitude', 'longitude',
    'ip_address', 'country_code', 'region', 'timezone', 'org',
    'listing_id', 'event_type', 'created_at',
  ];

  const SIGNAL_COLS = [
    'id', 'session_id', 'listing_id', 'signal_type', 'payload',
    'country', 'city', 'created_at',
  ];

  const report = {};
  report.companions = await importTable('companions', 'companions.json', COMPANION_COLS);
  report.channel_messages = await importTable('channel_messages', 'channel_messages.json', MESSAGE_COLS);
  report.photo_archive = await importTable('photo_archive', 'photo_archive.json', PHOTO_COLS);
  report.page_views = await importTable('page_views', 'page_views.json', PAGE_VIEW_COLS);
  report.signals = await importTable('signals', 'signals.json', SIGNAL_COLS);

  console.log('\nImport complete:', report);
  await pool.end();
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});