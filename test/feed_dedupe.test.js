import assert from 'node:assert/strict';
import test from 'node:test';
import { dedupeFeed, DEDUPE_WINDOW_MS } from '../src/lib/dedupeFeed.js';

const at = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

test('collapses reposts inside the window and counts them', () => {
  const out = dedupeFeed([
    { id: 1, name: 'Baan Nine', messageDate: at(0) },
    { id: 2, name: 'baan nine', messageDate: at(1) },
    { id: 3, name: 'Baan  Nine', messageDate: at(1.5) },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1, 'newest post represents the run');
  assert.equal(out[0].postCount, 3, 'badge must reflect collapsed reposts');
});

test('keeps a repost that falls outside the window', () => {
  const out = dedupeFeed([
    { id: 1, name: 'Eden Spa', messageDate: at(0) },
    { id: 2, name: 'Eden Spa', messageDate: at(5) },
  ]);
  assert.equal(out.length, 2, 'a shop posting again later shows again');
  assert.deepEqual(out.map((c) => c.postCount), [1, 1]);
});

test('window is anchored to the representative, not the previous item', () => {
  // 1.5h gaps chain: without anchoring, C would collapse into B and vanish.
  const out = dedupeFeed([
    { id: 1, name: 'Nicha', messageDate: at(0) },
    { id: 2, name: 'Nicha', messageDate: at(1.5) },
    { id: 3, name: 'Nicha', messageDate: at(3) },
  ]);
  assert.deepEqual(out.map((c) => c.id), [1, 3]);
  assert.deepEqual(out.map((c) => c.postCount), [2, 1]);
});

test('unnamed items are never collapsed together', () => {
  const out = dedupeFeed([
    { id: 1, name: '', messageDate: at(0) },
    { id: 2, name: null, messageDate: at(0.1) },
  ]);
  assert.equal(out.length, 2);
});

test('output is newest-first regardless of input order', () => {
  const out = dedupeFeed([
    { id: 'old', name: 'A', messageDate: at(10) },
    { id: 'new', name: 'B', messageDate: at(0) },
  ]);
  assert.deepEqual(out.map((c) => c.id), ['new', 'old']);
});

test('window constant is the documented 2 hours', () => {
  assert.equal(DEDUPE_WINDOW_MS, 2 * 60 * 60 * 1000);
});
