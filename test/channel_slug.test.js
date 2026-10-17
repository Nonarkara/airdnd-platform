import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { channelSlug, channelLabel } from '../src/lib/channel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

// The zero-width space corrupts the "the nicha spa" channel label. The slug
// contract is byte-for-byte: whatever the archive's channel_name holds must
// round-trip into the same on-disk shard filename. Slugs are lowercased and
// have a leading "@" stripped — nothing else, never any normalization.
const ZWSP = '\u200b';

test('channelSlug strips a leading @ and lowercases, nothing else', () => {
  assert.equal(channelSlug('@relaxsociety2020'), 'relaxsociety2020');
  assert.equal(channelSlug('RelaxSociety2020'), 'relaxsociety2020');
  assert.equal(channelSlug('baannine massage spa'), 'baannine massage spa');
  assert.equal(channelSlug('@Baannine Massage Spa'), 'baannine massage spa');
});

test('channelSlug keeps interior whitespace and non-latin scripts intact', () => {
  assert.equal(channelSlug('ชโนทัย นวดเพื่อสุขภาพ พระราม2'), 'ชโนทัย นวดเพื่อสุขภาพ พระราม2');
  assert.equal(channelSlug('@วิถีไทสปา164'), 'วิถีไทสปา164');
});

test('channelSlug preserves (does not invent or drop) zero-width spaces', () => {
  assert.equal(channelSlug(`the${ZWSP} nicha${ZWSP} spa`), `the${ZWSP} nicha${ZWSP} spa`);
  assert.equal(channelSlug(`@the${ZWSP} nicha${ZWSP} spa`), `the${ZWSP} nicha${ZWSP} spa`);
});

test('channelLabel strips @ but keeps original case for display', () => {
  assert.equal(channelLabel('@RelaxSociety2020'), 'RelaxSociety2020');
  assert.equal(channelLabel('relaxsociety2020'), 'relaxsociety2020');
});

test('every gallery venue slug is the canonical channelSlug of its channel — no drift', () => {
  const index = readJson('public/data/place_photos_index.json');
  assert.ok(index.venues.length > 0, 'gallery index should have venues');
  for (const venue of index.venues) {
    assert.equal(
      venue.slug,
      channelSlug(venue.channel),
      `venue.slug "${venue.slug}" must equal channelSlug(channel "${venue.channel}")`,
    );
  }
});

test('every listing deep-link slug resolves to a real gallery shard', () => {
  const data = readJson('public/data.json');
  const index = readJson('public/data/place_photos_index.json');
  const slugs = new Set(index.venues.map((v) => v.slug));
  const listings = Array.isArray(data) ? data : data.listings || [];
  let checked = 0;
  for (const listing of listings) {
    const slug = channelSlug(listing?.sourceChannel);
    if (!slug || slug === 'unknown') continue;
    checked += 1;
    assert.ok(
      slugs.has(slug),
      `listing "${listing?.name || listing?.id}" deep-links to /places/${slug} but no venue shard exists for it`,
    );
  }
  assert.ok(checked > 0, 'expected at least one listing with a channel slug to deep-link-check');
});