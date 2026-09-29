import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { downloadObjects, exportTable, listAllObjects, reconcile } from '../scripts/supabase_export.js';

// A small in-memory stand-in for the supabase-js surface the exporter uses.
function fakeClient({ rows = {}, files = {} } = {}) {
  const query = (table) => {
    const state = { gt: null, limit: Infinity };
    const run = () => {
      const all = (rows[table] || []).slice().sort((a, b) => a.id - b.id);
      const data = all.filter((r) => state.gt === null || r.id > state.gt).slice(0, state.limit);
      return Promise.resolve({ data, error: null });
    };
    const builder = {
      order: () => builder,
      limit: (n) => { state.limit = n; return builder; },
      gt: (_col, v) => { state.gt = v; return builder; },
      then: (resolve, reject) => run().then(resolve, reject),
    };
    return builder;
  };
  return {
    from: (table) => ({
      select: (_cols, opts) => (opts?.head
        ? Promise.resolve({ count: (rows[table] || []).length, error: null })
        : query(table)),
    }),
    storage: {
      from: () => ({
        list: async (prefix, { limit, offset }) => {
          const depth = prefix ? prefix.split('/').length : 0;
          const children = new Map();
          for (const [p, body] of Object.entries(files)) {
            if (prefix && !p.startsWith(`${prefix}/`)) continue;
            const parts = p.split('/');
            const name = parts[depth];
            if (parts.length > depth + 1) children.set(name, { name, id: null });
            else children.set(name, { name, id: p, metadata: { size: body.declared ?? body.bytes.length } });
          }
          const data = [...children.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit);
          return { data, error: null };
        },
        download: async (p) => ({ data: { arrayBuffer: async () => files[p].bytes }, error: null }),
      }),
    },
  };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sb-export-'));

test('tables export completely across pages, in id order, and resume when complete', async () => {
  const rows = { channel_messages: Array.from({ length: 2503 }, (_, i) => ({ id: 2503 - i, text: `m${i}` })) };
  const out = tmp();
  const result = await exportTable(fakeClient({ rows }), 'channel_messages', out);
  assert.equal(result.expected, 2503);
  assert.equal(result.exported, 2503);
  const lines = fs.readFileSync(path.join(out, 'tables/channel_messages.ndjson'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(lines.map((r) => r.id), Array.from({ length: 2503 }, (_, i) => i + 1));
  const again = await exportTable(fakeClient({ rows }), 'channel_messages', out);
  assert.equal(again.resumed, true);
});

test('a half-written table file from a crash is redone, not trusted', async () => {
  const rows = { companions: [{ id: 1 }, { id: 2 }, { id: 3 }] };
  const out = tmp();
  fs.mkdirSync(path.join(out, 'tables'), { recursive: true });
  fs.writeFileSync(path.join(out, 'tables/companions.ndjson'), '{"id":1}\n');
  const result = await exportTable(fakeClient({ rows }), 'companions', out);
  assert.equal(result.resumed, false);
  assert.equal(result.exported, 3);
});

test('the bucket is walked through nested folders and past 1,000 entries per folder', async () => {
  const files = {};
  for (let i = 0; i < 1203; i += 1) files[`telegram/chan-a/2026-09-01/p${String(i).padStart(4, '0')}.jpg`] = { bytes: Buffer.from('x') };
  files['telegram/chan-b/2026-09-02/solo.jpg'] = { bytes: Buffer.from('yy') };
  const objects = await listAllObjects(fakeClient({ files }), 'listing-photos');
  assert.equal(objects.length, 1204);
  assert.ok(objects.some((o) => o.path === 'telegram/chan-b/2026-09-02/solo.jpg' && o.size === 2));
});

test('downloads verify size, record failures, and skip what is already on disk', async () => {
  const files = {
    'telegram/a/d/good.jpg': { bytes: Buffer.from('abc') },
    'telegram/a/d/truncated.jpg': { bytes: Buffer.from('ab'), declared: 9 },
  };
  const client = fakeClient({ files });
  const objects = await listAllObjects(client, 'listing-photos');
  const out = tmp();
  const first = await downloadObjects(client, 'listing-photos', objects, out, { concurrency: 2 });
  assert.equal(first.failed.length, 1);
  assert.match(first.failed[0].path, /truncated/);
  assert.equal(fs.readFileSync(path.join(out, 'storage/listing-photos/telegram/a/d/good.jpg'), 'utf8'), 'abc');
  assert.ok(!fs.existsSync(path.join(out, 'storage/listing-photos/telegram/a/d/truncated.jpg')));
  const second = await downloadObjects(client, 'listing-photos', objects, out);
  assert.equal(second.skipped, 1);
});

test('reconciliation names what exists only in Supabase and only on the Mac', () => {
  const local = tmp();
  fs.mkdirSync(path.join(local, 'chan-a/2026-09-01'), { recursive: true });
  fs.writeFileSync(path.join(local, 'chan-a/2026-09-01/both.jpg'), 'x');
  fs.writeFileSync(path.join(local, 'chan-a/2026-09-01/mac-only.jpg'), 'x');
  const report = reconcile([
    { path: 'telegram/chan-a/2026-09-02/both.jpg', size: 1 }, // different date folder, same file
    { path: 'telegram/chan-a/2026-09-01/cloud-only.jpg', size: 1 },
  ], local);
  assert.equal(report.inBoth, 1);
  assert.equal(report.onlyInSupabase, 1);
  assert.deepEqual(report.onlyInSupabaseSample, ['cloud-only.jpg']);
  assert.equal(report.onlyLocal, 1);
});

test('an export imports into the local store as a faithful copy — ids, JSON, and unknown columns kept', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'tables'), { recursive: true });
  const write = (table, rows) => fs.writeFileSync(path.join(dir, 'tables', `${table}.ndjson`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  write('companions', [{ id: 325, name: 'Shop', location: 'x', tags: ['a'], metrics: { m: 1 }, user_feedback: [{ q: 1 }], is_safe_image: false }]);
  write('channel_messages', [{ id: 9001, telegram_message_id: 5, channel_id: 'c', raw_json: { text: 'original', media: { w: 1 } }, cluster_id: 3, linked_companion_id: 325, some_future_column: 'kept' }]);
  write('photo_archive', [{ id: 77, stored_filename: 'p.jpg', drive_url: null, linked_companion_id: 325 }]);

  process.env.LOCAL_DB_PATH = path.join(dir, 'sabai.db');
  const { importTable } = await import('../scripts/import_supabase_export.js');
  const { openLocalDb, readTable } = await import('../scripts/lib/local_store.js');
  const db = openLocalDb(process.env.LOCAL_DB_PATH);
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const t of ['companions', 'channel_messages', 'photo_archive']) {
    const r = await importTable(db, t, path.join(dir, 'tables', `${t}.ndjson`));
    assert.equal(r.inDb, 1, t);
  }
  const [msg] = readTable(db, 'channel_messages');
  assert.equal(msg.id, 9001);
  assert.deepEqual(msg.raw_json, { text: 'original', media: { w: 1 } });
  assert.equal(msg.cluster_id, 3);
  assert.equal(msg.some_future_column, 'kept');
  const [company] = readTable(db, 'companions');
  assert.equal(company.id, 325);
  assert.deepEqual(company.user_feedback, [{ q: 1 }]);
  assert.equal(company.is_safe_image, 0);
  const [photo] = readTable(db, 'photo_archive');
  assert.equal(photo.linked_companion_id, 325);
  // Re-running is safe: upsert by id, no duplicates.
  await importTable(db, 'channel_messages', path.join(dir, 'tables', 'channel_messages.ndjson'));
  assert.equal(readTable(db, 'channel_messages').length, 1);
  delete process.env.LOCAL_DB_PATH;
});

test('with LOCAL_DB=1 the heartbeat query reads the local store, not Supabase', async () => {
  const dir = tmp();
  const saved = { LOCAL_DB: process.env.LOCAL_DB, LOCAL_DB_PATH: process.env.LOCAL_DB_PATH, URL: process.env.VITE_SUPABASE_URL };
  process.env.LOCAL_DB_PATH = path.join(dir, 'sabai.db');
  process.env.LOCAL_DB = '1';
  delete process.env.VITE_SUPABASE_URL; // prove no Supabase credentials are needed
  try {
    const { openLocalDb } = await import('../scripts/lib/local_store.js');
    const db = openLocalDb(process.env.LOCAL_DB_PATH);
    db.prepare("INSERT INTO companions (id, name, updated_at) VALUES (1, 'Older', '2026-09-01T00:00:00Z'), (2, 'Newer', '2026-09-28T00:00:00Z')").run();
    const { openDataClient, isLocalStore } = await import('../scripts/lib/data_store.js');
    assert.equal(isLocalStore(), true);
    const client = await openDataClient('heartbeat');
    // The heartbeat's own query shape.
    const { data, error } = await client.from('companions').select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(1000);
    assert.equal(error, null);
    assert.deepEqual(data.map((r) => r.name), ['Newer', 'Older']);
  } finally {
    for (const [k, v] of Object.entries({ LOCAL_DB: saved.LOCAL_DB, LOCAL_DB_PATH: saved.LOCAL_DB_PATH, VITE_SUPABASE_URL: saved.URL })) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('the local shim answers the feed and patterns jobs\' query shapes', async () => {
  const dir = tmp();
  const { openLocalDb } = await import('../scripts/lib/local_store.js');
  const { createLocalSupabaseShim } = await import('../scripts/lib/supabase_local_shim.js');
  const db = openLocalDb(path.join(dir, 'sabai.db'));
  const insert = db.prepare('INSERT INTO channel_messages (id, telegram_message_id, channel_id, message_type, message_date, grouped_id) VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= 25; i += 1) insert.run(i, 100 + i, 'c', i % 5 === 0 ? 'discussion' : 'listing', `2026-09-${String(i).padStart(2, '0')}T00:00:00Z`, i <= 3 ? 'g1' : null);
  const client = createLocalSupabaseShim(db);

  // refresh_feed_snapshot: newest listing messages, cursor-paged with lt().
  const page1 = await client.from('channel_messages').select('*').eq('message_type', 'listing')
    .order('message_date', { ascending: false }).limit(5);
  assert.deepEqual(page1.data.map((r) => r.id), [24, 23, 22, 21, 19]);
  const page2 = await client.from('channel_messages').select('*').eq('message_type', 'listing')
    .order('message_date', { ascending: false }).limit(5).lt('message_date', page1.data.at(-1).message_date);
  assert.deepEqual(page2.data.map((r) => r.id), [18, 17, 16, 14, 13]);

  // refresh_feed_snapshot: photos by grouped_id / message id with in().
  const grouped = await client.from('channel_messages').select('*').in('grouped_id', ['g1', 'nope']);
  assert.equal(grouped.data.length, 3);
  assert.deepEqual((await client.from('channel_messages').select('*').in('id', [])).data, []);

  // compute_patterns: pull everything in id order with range().
  const all = [];
  for (let from = 0; ; from += 10) {
    const { data } = await client.from('channel_messages').select('*').order('id', { ascending: true }).range(from, from + 9);
    all.push(...data);
    if (data.length < 10) break;
  }
  assert.deepEqual(all.map((r) => r.id), Array.from({ length: 25 }, (_, i) => i + 1));

  // Column names are spliced into SQL: anything but an identifier is refused.
  await assert.rejects(async () => { await client.from('channel_messages').select('*').eq('id; DROP TABLE companions', 1); });
});
