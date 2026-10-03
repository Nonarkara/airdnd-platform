// Local SQLite data station.
//
// Replaces the paid Supabase Postgres instance with a single SQLite file that
// lives on the always-on Mac (point LOCAL_DB_PATH at the external drive). The
// schema mirrors the Supabase `companions`, `channel_messages`, `photo_archive`
// and `page_views` tables closely enough that the existing pipeline can write
// to it through the query-builder shim in ./supabase_local_shim.js with no
// changes to listing_pipeline.js.
//
// Uses the built-in node:sqlite module (Node 22+) so there is no native
// dependency to compile — in keeping with this project's "minimal dependencies
// by design" rule.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// node:sqlite is stable enough to rely on but still prints an experimental
// warning on import. Silence only that one line so data-station logs stay clean.
const SQLITE_WARNING = 'SQLite is an experimental feature';
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = (warning, ...rest) => {
  const message = typeof warning === 'string' ? warning : warning?.message;
  if (message && message.includes(SQLITE_WARNING)) {
    return undefined;
  }
  return originalEmitWarning(warning, ...rest);
};

const { DatabaseSync } = await import('node:sqlite');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'sabai.db');

// Columns that hold JSON in Postgres (jsonb) and must be (de)serialized when
// crossing the SQLite boundary so the pipeline keeps seeing real arrays/objects.
export const JSON_COLUMNS = {
  companions: ['tags', 'metrics', 'photo_urls', 'source_message_ids', 'service_tags', 'drive_photo_urls', 'user_feedback'],
  channel_messages: ['raw_json'],
  photo_archive: [],
  page_views: ['payload'],
  signals: ['payload'],
};

// Columns that are boolean in Postgres. SQLite stores them as 1/0, and 0 is
// not `false`: read back unconverted, `is_safe_image = 0` passed every
// `!== false` safety check, so after cutover every unsafe-content flag would
// have silently stopped working. Converted back to real booleans on read.
export const BOOLEAN_COLUMNS = {
  companions: ['is_safe_image'],
  channel_messages: ['has_media'],
};

export function restoreBooleans(table, row) {
  for (const column of BOOLEAN_COLUMNS[table] || []) {
    if (row[column] === 0 || row[column] === 1) row[column] = row[column] === 1;
  }
  return row;
}

// Columns the live Supabase schema holds that the first version of this store
// left out. A migration that silently drops them would lose the full original
// Telegram message (raw_json — the research corpus), Drive links, and the
// photo→listing links. Added idempotently to existing databases.
const FIDELITY_COLUMNS = {
  companions: { user_feedback: "TEXT DEFAULT '[]'" },
  channel_messages: { photo_url: 'TEXT', cluster_id: 'INTEGER', raw_json: 'TEXT' },
  photo_archive: { drive_url: 'TEXT', linked_companion_id: 'INTEGER' },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  location TEXT,
  price TEXT,
  description TEXT,
  image_url TEXT,
  rating REAL DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  availability TEXT,
  tags TEXT DEFAULT '[]',
  metrics TEXT DEFAULT '{}',
  phone TEXT,
  phone_normalized TEXT,
  hours TEXT,
  line_url TEXT,
  telegram_url TEXT,
  maps_url TEXT,
  source_channel TEXT,
  city TEXT,
  canonical_key TEXT,
  mention_count INTEGER DEFAULT 1,
  photo_urls TEXT DEFAULT '[]',
  drive_photo_urls TEXT DEFAULT '[]',
  source_message_ids TEXT DEFAULT '[]',
  user_rating REAL,
  service_tags TEXT DEFAULT '[]',
  discussion_notes TEXT,
  raw_text TEXT,
  latitude REAL,
  longitude REAL,
  is_safe_image INTEGER DEFAULT 1,
  posted_at TEXT,
  updated_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_companions_canonical_key ON companions (canonical_key);
CREATE INDEX IF NOT EXISTS idx_companions_phone_normalized ON companions (phone_normalized);
CREATE INDEX IF NOT EXISTS idx_companions_maps_url ON companions (maps_url);
CREATE INDEX IF NOT EXISTS idx_companions_updated_at ON companions (updated_at);

CREATE TABLE IF NOT EXISTS channel_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_message_id INTEGER NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  sender_id TEXT,
  message_text TEXT,
  message_date TEXT,
  has_media INTEGER DEFAULT 0,
  media_type TEXT,
  reply_to_message_id INTEGER,
  grouped_id TEXT,
  message_type TEXT,
  linked_companion_id INTEGER,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (channel_id, telegram_message_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_messages_type ON channel_messages (message_type);
CREATE INDEX IF NOT EXISTS idx_channel_messages_date ON channel_messages (message_date);

CREATE TABLE IF NOT EXISTS photo_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_message_id INTEGER,
  channel_id TEXT,
  channel_name TEXT,
  sender_id TEXT,
  message_date TEXT,
  original_filename TEXT,
  stored_filename TEXT,
  local_path TEXT,
  supabase_url TEXT,
  file_size_bytes INTEGER,
  media_type TEXT,
  mime_type TEXT,
  photo_telegram_id TEXT,
  grouped_id TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (channel_id, telegram_message_id, stored_filename)
);
CREATE INDEX IF NOT EXISTS idx_photo_archive_channel ON photo_archive (channel_id);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  page TEXT,
  event_type TEXT,
  listing_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  language TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude REAL,
  longitude REAL,
  ip_address TEXT,
  timezone TEXT,
  org TEXT,
  payload TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_page_views_session ON page_views (session_id);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  listing_id INTEGER,
  signal_type TEXT,
  country TEXT,
  city TEXT,
  payload TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
`;

function ensureFidelityColumns(db) {
  for (const [table, columns] of Object.entries(FIDELITY_COLUMNS)) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
    for (const [column, type] of Object.entries(columns)) {
      if (!have.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}

/**
 * Open (creating if needed) the local SQLite database and ensure the schema
 * exists. Returns a DatabaseSync handle.
 *
 * @param {string} [dbPath] absolute path to the .db file. Defaults to
 *   LOCAL_DB_PATH env, then <repo>/data/sabai.db.
 */
export function openLocalDb(dbPath = process.env.LOCAL_DB_PATH || DEFAULT_DB_PATH) {
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const db = new DatabaseSync(resolved);
  // Several processes share this file (collector, bot, heartbeat jobs, photo
  // publishing, backups). Without a busy timeout a second writer fails at once
  // with "database is locked"; with it, it waits its turn. Set before WAL,
  // which itself needs the lock. synchronous=NORMAL is crash-safe under WAL
  // (a power cut can lose the last commit, never corrupt the file).
  db.exec('PRAGMA busy_timeout = 15000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  ensureFidelityColumns(db);
  return db;
}

/**
 * Return the ordered list of real column names for a table.
 */
export function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

/**
 * Count rows in a table (optionally filtered by a WHERE clause + params).
 */
export function countRows(db, table, where = '', params = []) {
  const clause = where ? ` WHERE ${where}` : '';
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}${clause}`).get(...params);
  return Number(row?.n || 0);
}

/**
 * Read every row of a table as plain objects, parsing JSON columns back into
 * arrays/objects so downstream code sees the same shapes Supabase returned.
 */
export function readTable(db, table) {
  const jsonColumns = JSON_COLUMNS[table] || [];
  return db.prepare(`SELECT * FROM ${table}`).all().map((row) => {
    const plain = { ...row };
    for (const column of jsonColumns) {
      if (typeof plain[column] === 'string') {
        try {
          plain[column] = JSON.parse(plain[column]);
        } catch {
          plain[column] = null;
        }
      }
    }
    return restoreBooleans(table, plain);
  });
}
