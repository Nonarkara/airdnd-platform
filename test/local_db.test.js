import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createDataClient, closeDataClient } from '../scripts/lib/local_db.js';

test('guard:no-supabase passes on the committed tree', () => {
  const out = execFileSync('node', ['scripts/guard_no_supabase.js'], { encoding: 'utf8' });
  assert.match(out, /no Supabase/);
});

test('local storage maps keys onto the media host', () => {
  const db = createDataClient('postgresql://127.0.0.1:1/none');
  const { data } = db.storage.from('listing-photos').getPublicUrl('telegram/a/2026-10-17/x.jpg');
  assert.equal(data.publicUrl, 'https://airdnd-media.pages.dev/listing-photos/telegram/a/2026-10-17/x.jpg');
});

test('unsafe identifiers are rejected, connection errors come back as { error }', async () => {
  const db = createDataClient();
  const bad = await db.from('companions; drop table x').select('*').limit(1);
  assert.ok(bad.error);
  await closeDataClient();
});
