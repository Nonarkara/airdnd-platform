#!/usr/bin/env node
/**
 * migrate.js — Orchestrate the full Supabase → M3 migration.
 *
 * Run: node scripts/migrate/migrate.js [--dry-run] [--export-only] [--import-only]
 *
 * Steps:
 *   1. Check M3 PostgreSQL connectivity
 *   2. Export from Supabase
 *   3. Apply schema to M3
 *   4. Import data to M3
 *   5. Verify row counts
 *   6. Switch scraper writes to M3
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const EXPORT_ONLY = args.has('--export-only');
const IMPORT_ONLY = args.has('--import-only');
const DATABASE_URL = process.env.DATABASE_URL;

async function checkM3Connectivity() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Create .env.m3 with:');
    console.error('   DATABASE_URL=postgresql://sabai:sabai@m3.local:5432/sabai');
    return false;
  }

  try {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000 });
    const { rows } = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log(`✅ M3 PostgreSQL reachable: ${rows[0].db} @ ${rows[0].time}`);
    await pool.end();
    return true;
  } catch (err) {
    console.error(`❌ Cannot reach M3 PostgreSQL: ${err.message}`);
    return false;
  }
}

async function runExport() {
  console.log('\n📦 Step 1: Export from Supabase...');
  execSync('node scripts/migrate/export_supabase.js', { cwd: ROOT, stdio: 'inherit' });
}

async function applySchema() {
  if (DRY_RUN) {
    console.log('🏗️  Step 2: Schema apply (dry run — skipped)');
    return;
  }
  console.log('\n🏗️  Step 2: Applying schema to M3...');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  await pool.query(schema);
  console.log('  Schema applied successfully');
  await pool.end();
}

async function runImport() {
  console.log('\n📥 Step 3: Import data to M3...');
  execSync('node scripts/migrate/import_to_m3.js', { cwd: ROOT, stdio: 'inherit' });
}

async function verify() {
  console.log('\n🔍 Step 4: Verifying migration...');
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  const tables = ['companions', 'channel_messages', 'photo_archive', 'page_views', 'signals'];
  const results = {};

  for (const table of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
    results[table] = parseInt(rows[0].count);
    console.log(`  ${table}: ${results[table]} rows`);
  }

  // Compare with export counts
  const reportPath = path.join(__dirname, 'export/report.json');
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    console.log('\n  Comparison (Supabase → M3):');
    for (const table of tables) {
      const exported = report[table] || 0;
      const imported = results[table] || 0;
      const pct = exported > 0 ? Math.round((imported / exported) * 100) : 0;
      const status = pct >= 95 ? '✅' : pct >= 50 ? '⚠️' : '❌';
      console.log(`  ${status} ${table}: ${exported} exported → ${imported} imported (${pct}%)`);
    }
  }

  await pool.end();
  return results;
}

async function main() {
  console.log('Sabai Sabai: Supabase → M3 Migration');
  console.log('=====================================');

  if (!IMPORT_ONLY) {
    const reachable = await checkM3Connectivity();
    if (!reachable && !DRY_RUN) {
      console.error('\nCannot proceed without M3 connectivity.');
      console.error('Connect to M3 (same network / Tailscale) and retry.');
      process.exit(1);
    }

    await runExport();
    if (EXPORT_ONLY) {
      console.log('\n✅ Export complete. Run with --import-only when M3 is ready.');
      return;
    }
  }

  if (!DRY_RUN) {
    await applySchema();
  }
  await runImport();
  await verify();

  console.log('\n✅ Migration complete!');
  console.log('\nNext: Update scraper to write to M3 (set DATABASE_URL in scraper env).');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});