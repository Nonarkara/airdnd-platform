import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteMediaUrl, rewriteMediaUrls, MEDIA_BASE_URL } from '../src/lib/media.js';

test('legacy Supabase storage URLs map onto the media host with the same key', () => {
  const key = 'listing-photos/telegram/chanelmassage/2026-08-24/a.jpg';
  assert.equal(
    rewriteMediaUrl(`https://fehdtfncbutesgadjsxp.supabase.co/storage/v1/object/public/${key}`),
    `${MEDIA_BASE_URL}${key}`,
  );
});

test('non-Supabase and empty values pass through untouched', () => {
  assert.equal(rewriteMediaUrl('/images/x.jpg'), '/images/x.jpg');
  assert.equal(rewriteMediaUrl(null), null);
  assert.deepEqual(rewriteMediaUrls(['/a.jpg']), ['/a.jpg']);
});

test('published snapshots carry no Supabase URLs', async () => {
  const fs = await import('node:fs');
  for (const file of ['public/data.json', 'public/feed.json']) {
    assert.ok(!fs.readFileSync(file, 'utf8').includes('supabase.co'), `${file} still references supabase.co`);
  }
});
