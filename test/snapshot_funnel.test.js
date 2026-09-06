import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSnapshotFunnel } from '../src/lib/snapshot_funnel.js';

const NOW = Date.parse('2026-09-06T00:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString();

const listings = [
  { imageUrl: '/images/a.jpg', sourceTarget: '@one', postedAt: daysAgo(1), latitude: 13.7, longitude: 100.5 },
  { imageUrl: '/images/ch/2026-08-24/b.jpg', sourceTarget: '@one', postedAt: daysAgo(3), mapsUrl: 'https://maps.example' },
  { imageUrl: 'https://cdn.example/c.jpg', sourceTarget: '@two', postedAt: daysAgo(12) },
  { sourceChannel: 'Title Only', postedAt: daysAgo(30) },
];

test('counts committed versus missing local photos and remote ones separately', () => {
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: ['/images/a.jpg'], now: NOW });
  assert.equal(f.shown.cards, 4);
  assert.equal(f.shown.withPhoto, 3);
  assert.equal(f.shown.photoFilesTracked, 1);
  assert.equal(f.shown.photoFilesMissing, 1);
  assert.deepEqual(f.missingPhotoPaths, ['/images/ch/2026-08-24/b.jpg']);
  assert.equal(f.shown.deployablePhotoCards, 2); // the tracked local one + the remote one
});

test('snapshot age comes from the newest post, not the oldest', () => {
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: [], now: NOW });
  assert.equal(f.snapshot.ageDays, 1);
  assert.ok(!f.warnings.some((w) => w.includes('days old')));
});

test('warns when the snapshot is stale', () => {
  const f = computeSnapshotFunnel({ listings: [listings[2]], trackedImagePaths: [], now: NOW });
  assert.equal(f.snapshot.ageDays, 12);
  assert.ok(f.warnings.some((w) => w.includes('12 days old')));
});

test('channels represented are compared against the configured list', () => {
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: [], configuredChannels: ['@one', '@two', '@three', 'dialog:1'], now: NOW });
  assert.equal(f.shown.channelsRepresented, 3);
  assert.equal(f.intake.channelsConfigured, 4);
  assert.ok(f.warnings.some((w) => w.includes('3 of 4 configured channels')));
});

test('unverified location means no coordinates and no maps link', () => {
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: [], now: NOW });
  assert.equal(f.shown.unverifiedLocation, 2);
});

test('archive block mirrors the insights corpus when present', () => {
  const corpus = { messagesTotal: 85646, photosArchived: 25202, personaPosts: 4011, uniqueBusinesses: 92, duplicationFactor: 43.6 };
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: [], corpus, now: NOW });
  assert.deepEqual(f.archive, { messages: 85646, photos: 25202, personaPosts: 4011, businesses: 92, duplicationFactor: 43.6 });
});

test('degraded feed is surfaced as a warning', () => {
  const f = computeSnapshotFunnel({ listings, trackedImagePaths: [], feedMeta: { degraded: true, reason: 'Supabase 522' }, now: NOW });
  assert.ok(f.warnings.some((w) => w.includes('Supabase 522')));
  assert.equal(f.feed.degraded, true);
});

test('empty snapshot is a warning, never a crash', () => {
  const f = computeSnapshotFunnel({ listings: [], trackedImagePaths: [], now: NOW });
  assert.equal(f.shown.cards, 0);
  assert.equal(f.snapshot.ageDays, null);
  assert.ok(f.warnings.includes('snapshot is empty'));
});
