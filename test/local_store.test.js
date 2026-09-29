import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { openLocalDb, countRows, readTable } from '../scripts/lib/local_store.js';
import { createLocalSupabaseShim } from '../scripts/lib/supabase_local_shim.js';
import { archiveChannelMessages, insertListingsIfPossible } from '../scripts/listing_pipeline.js';
import { exportSnapshotFromDb } from '../scripts/lib/snapshot_export.js';

function freshDb() {
  const dbPath = path.join(os.tmpdir(), `sabai-test-${randomUUID()}.db`);
  const db = openLocalDb(dbPath);
  return { db, dbPath };
}

function cleanup(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
}

test('local store creates the expected tables', () => {
  const { db, dbPath } = freshDb();
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => row.name);
    for (const expected of ['companions', 'channel_messages', 'photo_archive', 'page_views']) {
      assert.ok(tables.includes(expected), `missing table ${expected}`);
    }
  } finally {
    db.close();
    cleanup(dbPath);
  }
});

test('shim round-trips rows and (de)serializes JSON columns', async () => {
  const { db, dbPath } = freshDb();
  try {
    const shim = createLocalSupabaseShim(db);

    const { error: insertError } = await shim.from('companions').insert([{
      name: 'Sabai Massage & Spa',
      tags: ['aroma', 'thai'],
      metrics: { availability_status: 'available' },
      phone: '081-234-5678',
      is_safe_image: true,
      canonical_key: 'phone:0812345678',
    }]);
    assert.equal(insertError, null);

    const { data, error } = await shim
      .from('companions')
      .select('*')
      .eq('canonical_key', 'phone:0812345678')
      .limit(1);
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.deepEqual(data[0].tags, ['aroma', 'thai']);
    assert.deepEqual(data[0].metrics, { availability_status: 'available' });
  // Booleans read back as booleans: an integer 0 would slip past `!== false` safety checks.
    assert.equal(data[0].is_safe_image, true);

    const rowId = data[0].id;
    const { error: updateError } = await shim
      .from('companions')
      .update({ mention_count: 5, hours: '10:00-22:00' })
      .eq('id', rowId);
    assert.equal(updateError, null);

    const { data: afterUpdate } = await shim.from('companions').select('*').eq('id', rowId).limit(1);
    assert.equal(afterUpdate[0].mention_count, 5);
    assert.equal(afterUpdate[0].hours, '10:00-22:00');
  } finally {
    db.close();
    cleanup(dbPath);
  }
});

test('insertListingsIfPossible writes to SQLite and dedups by phone', async () => {
  const { db, dbPath } = freshDb();
  try {
    const shim = createLocalSupabaseShim(db);

    const listings = [
      {
        name: 'Sabai Massage & Spa',
        location: 'Sukhumvit Soi 11, Bangkok',
        phone: '081-234-5678',
        description: 'Relaxing traditional Thai massage and aroma oil treatments near BTS Nana.',
        priceLabel: '500 THB',
        latitude: 13.744,
        longitude: 100.556,
        imageUrl: '/images/test/a.jpg',
        postedAt: '2026-09-01T10:00:00Z',
        sourceChannel: 'relaxsociety2020',
        tags: ['aroma'],
      },
      {
        // Same operator, different staff/alias name + a later post — must collapse
        // into the row above via phone dedup and bump mention_count.
        name: 'Aroma Massage by Nong',
        location: 'Bangkok, Thailand',
        phone: '081-234-5678',
        description: 'Fresh availability tonight, oil and Thai massage by our team.',
        latitude: 13.744,
        longitude: 100.556,
        imageUrl: '/images/test/a2.jpg',
        postedAt: '2026-09-02T10:00:00Z',
        sourceChannel: 'relaxsociety2020',
      },
      {
        name: 'Lotus Spa & Wellness',
        location: 'Nimmanhaemin, Chiang Mai',
        phone: '02-111-2222',
        description: 'Signature Lanna spa rituals, herbal compress, and foot reflexology.',
        latitude: 18.796,
        longitude: 98.967,
        imageUrl: '/images/test/b.jpg',
        postedAt: '2026-09-01T12:00:00Z',
        sourceChannel: 'chanelmassage',
      },
    ];

    const result = await insertListingsIfPossible(shim, listings);
    assert.equal(result.inserted, 2, 'two distinct businesses inserted');
    assert.equal(result.rejected, 0, 'nothing rejected by the quality gate');
    assert.equal(countRows(db, 'companions'), 2, 'phone-duplicate collapsed');

    const rows = readTable(db, 'companions');
    const sabai = rows.find((row) => row.canonical_key === 'phone:0812345678');
    assert.ok(sabai, 'canonical phone row exists');
    assert.equal(sabai.mention_count, 2, 'mention_count bumped by the duplicate');
  } finally {
    db.close();
    cleanup(dbPath);
  }
});

test('archiveChannelMessages upserts idempotently', async () => {
  const { db, dbPath } = freshDb();
  try {
    const shim = createLocalSupabaseShim(db);
    const messages = [
      { id: 501, message: 'ร้านนวด Sabai เปิดบริการ โทร 081-234-5678', date: 1_725_000_000, fromId: { userId: 12345 } },
      { id: 502, message: 'รีวิว: บริการดีมาก สะอาด ประทับใจ', date: 1_725_000_100, media: { photo: { id: 999 } } },
    ];

    await archiveChannelMessages(shim, messages, 'chan-1', 'RelaxSociety');
    assert.equal(countRows(db, 'channel_messages'), 2);

    // Re-archiving the same messages must not create duplicates.
    await archiveChannelMessages(shim, messages, 'chan-1', 'RelaxSociety');
    assert.equal(countRows(db, 'channel_messages'), 2);

    const stored = readTable(db, 'channel_messages').find((row) => row.telegram_message_id === 502);
    assert.equal(stored.media_type, 'photo');
    assert.equal(stored.message_type, 'feedback');
  } finally {
    db.close();
    cleanup(dbPath);
  }
});

test('photo_archive upsert is idempotent on the composite key', async () => {
  const { db, dbPath } = freshDb();
  try {
    const shim = createLocalSupabaseShim(db);
    const row = {
      telegram_message_id: 501,
      channel_id: 'chan-1',
      channel_name: 'RelaxSociety',
      stored_filename: 'relaxsociety_501_photo999.jpg',
      local_path: '/images/relaxsociety/2026-09-01/relaxsociety_501_photo999.jpg',
      file_size_bytes: 1234,
      media_type: 'photo',
      mime_type: 'image/jpeg',
      photo_telegram_id: '999',
    };
    const opts = { onConflict: 'channel_id,telegram_message_id,stored_filename', ignoreDuplicates: true };

    await shim.from('photo_archive').upsert(row, opts);
    await shim.from('photo_archive').upsert(row, opts);
    assert.equal(countRows(db, 'photo_archive'), 1);
  } finally {
    db.close();
    cleanup(dbPath);
  }
});

test('exportSnapshotFromDb writes a slim, canonical data.json', async () => {
  const { db, dbPath } = freshDb();
  const publicDir = path.join(os.tmpdir(), `sabai-public-${randomUUID()}`);
  try {
    const shim = createLocalSupabaseShim(db);
    await insertListingsIfPossible(shim, [
      {
        name: 'Sabai Massage & Spa',
        location: 'Sukhumvit Soi 11, Bangkok',
        phone: '081-234-5678',
        description: 'Relaxing traditional Thai massage and aroma oil treatments near BTS Nana.',
        latitude: 13.744,
        longitude: 100.556,
        postedAt: '2026-09-01T10:00:00Z',
      },
      {
        name: 'Lotus Spa & Wellness',
        location: 'Nimmanhaemin, Chiang Mai',
        phone: '02-111-2222',
        description: 'Signature Lanna spa rituals, herbal compress, and foot reflexology.',
        latitude: 18.796,
        longitude: 98.967,
        postedAt: '2026-09-02T12:00:00Z',
      },
    ]);

    const outPath = path.join(publicDir, 'data.json');
    const { count } = exportSnapshotFromDb(db, { publicDir, outPath });
    assert.equal(count, 2);

    const written = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    assert.equal(written.length, 2);
    // Newest post first.
    assert.equal(written[0].name, 'Lotus Spa & Wellness');
    for (const listing of written) {
      assert.ok(listing.canonicalKey, 'each listing carries a canonical key');
      assert.ok(typeof listing.credibility === 'number', 'credibility computed');
    }
  } finally {
    db.close();
    cleanup(dbPath);
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
});
