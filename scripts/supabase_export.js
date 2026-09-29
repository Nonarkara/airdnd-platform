#!/usr/bin/env node
/**
 * Take everything out of Supabase before the project is switched off.
 *
 *   node scripts/supabase_export.js --out /Volumes/Backup/sabai-supabase-export
 *   node scripts/supabase_export.js --out <dir> --local-archive public/images
 *   node scripts/supabase_export.js --out <dir> --tables-only
 *
 * Read-only against Supabase. Resumable: run it again and it skips every table
 * page and photo already on disk with the right size. Nothing here deletes.
 *
 * Why it must run before cancelling: the audit (tasks/supabase-exit.md) found
 * that no photo has ever reached the Google Drive backup — every photo exists
 * only on the Mac's disk and in this bucket, and the two do not match
 * (59,246 objects in the bucket, 56,424 archive rows pointing at it). Anything
 * that exists only in the bucket is lost the moment the project is deleted.
 *
 * Output
 *   <out>/tables/<table>.ndjson   one JSON row per line, ordered by id
 *   <out>/storage/<bucket>/…      every object, same paths as in the bucket
 *   <out>/manifest.json           counts expected vs exported, per table and
 *                                 for storage, plus the reconciliation report
 * The run ends with a single verdict line: COMPLETE or INCOMPLETE.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TABLES = ['companions', 'channel_messages', 'photo_archive', 'page_views', 'signals'];
const PAGE = 1000;

// ── tables ───────────────────────────────────────────────────────────────────

export async function exportTable(client, table, outDir, log = () => {}) {
  const { count, error: countError } = await client.from(table).select('*', { count: 'exact', head: true });
  if (countError) throw new Error(`${table} count: ${countError.message}`);

  const file = path.join(outDir, 'tables', `${table}.ndjson`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Resume only when the file is already complete; a partial file is rewritten,
  // because keyset order across a crash boundary cannot be trusted.
  if (fs.existsSync(file)) {
    const have = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length;
    if (have === count) return { table, expected: count, exported: have, resumed: true };
  }

  const tmp = `${file}.partial`;
  const stream = fs.createWriteStream(tmp);
  let exported = 0;
  let lastId = null;
  // Keyset pagination on id: stable while the scraper keeps inserting, where
  // offset pagination would skip or repeat rows.
  for (;;) {
    let query = client.from(table).select('*').order('id', { ascending: true }).limit(PAGE);
    if (lastId !== null) query = query.gt('id', lastId);
    const { data, error } = await query;
    if (error) throw new Error(`${table} page after id ${lastId}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) stream.write(`${JSON.stringify(row)}\n`);
    exported += data.length;
    lastId = data[data.length - 1].id;
    log(`${table} ${exported}/${count}`);
    if (data.length < PAGE) break;
  }
  await new Promise((resolve) => stream.end(resolve));
  fs.renameSync(tmp, file);
  // Rows inserted during the export make exported > expected; that is fine.
  return { table, expected: count, exported, resumed: false };
}

// ── storage ──────────────────────────────────────────────────────────────────

/** Walk a bucket recursively. Supabase lists one folder level at a time;
 *  folders come back as entries without an id. */
export async function listAllObjects(client, bucket, prefix = '') {
  const objects = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.id === undefined) {
        objects.push(...await listAllObjects(client, bucket, full));
      } else {
        objects.push({ path: full, size: Number(entry.metadata?.size ?? -1) });
      }
    }
    if (data.length < PAGE) break;
  }
  return objects;
}

export async function downloadObjects(client, bucket, objects, outDir, { concurrency = 6, log = () => {} } = {}) {
  const root = path.join(outDir, 'storage', bucket);
  const failed = [];
  let done = 0;
  let skipped = 0;
  const queue = [...objects];
  async function worker() {
    for (let object = queue.shift(); object; object = queue.shift()) {
      const dest = path.join(root, object.path);
      if (fs.existsSync(dest) && (object.size < 0 || fs.statSync(dest).size === object.size)) {
        skipped += 1;
      } else {
        try {
          const { data, error } = await client.storage.from(bucket).download(object.path);
          if (error) throw new Error(error.message);
          const buffer = Buffer.from(await data.arrayBuffer());
          if (object.size >= 0 && buffer.length !== object.size) throw new Error(`size ${buffer.length} ≠ ${object.size}`);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(`${dest}.partial`, buffer);
          fs.renameSync(`${dest}.partial`, dest);
        } catch (error) {
          failed.push({ path: object.path, reason: error.message });
        }
      }
      done += 1;
      if (done % 250 === 0 || done === objects.length) log(`photos ${done}/${objects.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { expected: objects.length, onDisk: objects.length - failed.length, skipped, failed };
}

// ── reconciliation ───────────────────────────────────────────────────────────

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

/** Compare the bucket with the Mac's own archive by file name. The two use
 *  different folder roots (telegram/<channel>/<date>/ vs images/<channel>/<date>/)
 *  and may differ in date folder, so the stored file name is the join key. */
export function reconcile(objects, localArchiveDir) {
  const local = new Map(walkFiles(localArchiveDir).map((f) => [path.basename(f), f]));
  const remote = new Map(objects.map((o) => [path.basename(o.path), o.path]));
  const onlyInSupabase = [...remote.keys()].filter((name) => !local.has(name));
  const onlyLocal = [...local.keys()].filter((name) => !remote.has(name));
  return {
    localFiles: local.size,
    bucketObjects: remote.size,
    inBoth: [...remote.keys()].filter((name) => local.has(name)).length,
    onlyInSupabase: onlyInSupabase.length,
    onlyLocal: onlyLocal.length,
    onlyInSupabaseSample: onlyInSupabase.slice(0, 50),
  };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : null; };
  const outDir = path.resolve(arg('out') || 'supabase-export');
  const localArchive = arg('local-archive');
  const bucket = arg('bucket') || process.env.SUPABASE_PHOTO_BUCKET || 'listing-photos';

  const { default: dotenv } = await import('dotenv');
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.join(here, '../.env'), quiet: true });
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, { auth: { persistSession: false } });

  const log = (line) => process.stdout.write(`\r${line.padEnd(60)}`);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`exporting to ${outDir}\n`);

  const tables = [];
  for (const table of TABLES) {
    tables.push(await exportTable(client, table, outDir, log));
    const t = tables.at(-1);
    process.stdout.write(`\r${`${table}: ${t.exported}/${t.expected}${t.resumed ? ' (already complete)' : ''}`.padEnd(60)}\n`);
  }

  let storage = null;
  let reconciliation = null;
  if (!argv.includes('--tables-only')) {
    console.log(`\nlisting bucket ${bucket} …`);
    const objects = await listAllObjects(client, bucket);
    console.log(`${objects.length} objects`);
    storage = await downloadObjects(client, bucket, objects, outDir, { log });
    process.stdout.write('\n');
    if (localArchive) reconciliation = reconcile(objects, path.resolve(localArchive));
  }

  const tablesComplete = tables.every((t) => t.exported >= t.expected);
  const storageComplete = !storage || storage.failed.length === 0;
  const manifest = {
    exportedAt: new Date().toISOString(),
    source: url,
    bucket,
    tables,
    storage: storage && { ...storage, failed: storage.failed.slice(0, 500), failedCount: storage.failed.length },
    reconciliation,
    complete: tablesComplete && storageComplete,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  if (reconciliation) {
    console.log(`\nlocal archive: ${reconciliation.localFiles} files · bucket: ${reconciliation.bucketObjects}`);
    console.log(`only in Supabase: ${reconciliation.onlyInSupabase} (now saved in ${path.join(outDir, 'storage')})`);
    console.log(`only on this Mac: ${reconciliation.onlyLocal}`);
  }
  console.log(`\n${manifest.complete ? 'COMPLETE' : 'INCOMPLETE'} — manifest at ${path.join(outDir, 'manifest.json')}`);
  if (!manifest.complete) {
    console.log('Run the same command again to retry what failed. Do not cancel Supabase until this says COMPLETE.');
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
