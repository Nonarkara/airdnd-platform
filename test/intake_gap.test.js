import test from 'node:test';
import assert from 'node:assert/strict';
import { detectIntakeGap, mergeCatchUpPages, CATCH_UP_MAX_PAGES } from '../src/lib/intake_gap.js';

const page = (...ids) => ids.map((id) => ({ id, text: `m${id}` }));

test('first run has no gap to close', () => {
  assert.deepEqual(detectIntakeGap(page(500, 499, 498), 0), { hasGap: false, oldestFetchedId: 498, missingBelow: 0 });
});

test('contiguous page reaching the high-water mark has no gap', () => {
  // last seen 497, page covers 498..500: nothing was skipped
  assert.equal(detectIntakeGap(page(500, 499, 498), 497).hasGap, false);
});

test('page that overlaps the high-water mark has no gap', () => {
  assert.equal(detectIntakeGap(page(500, 499, 498), 499).hasGap, false);
});

test('page whose oldest id is still newer than last seen reports the gap', () => {
  // daemon was down: last seen 100, newest page is 700..900 — 101..699 never fetched
  const gap = detectIntakeGap(page(900, 800, 700), 100);
  assert.equal(gap.hasGap, true);
  assert.equal(gap.missingBelow, 700);
});

test('empty page never reports a gap', () => {
  assert.equal(detectIntakeGap([], 100).hasGap, false);
});

test('accepts bare ids as well as message objects', () => {
  assert.equal(detectIntakeGap([300, 200], 50).hasGap, true);
});

test('mergeCatchUpPages keeps only new ids, de-duplicates, orders oldest first', () => {
  const merged = mergeCatchUpPages([page(900, 800, 700), page(700, 600, 500), page(500, 400, 100)], 100);
  assert.deepEqual(merged.map((m) => m.id), [400, 500, 600, 700, 800, 900]);
});

test('catch-up ceiling is a small, positive number of pages', () => {
  assert.ok(CATCH_UP_MAX_PAGES > 0 && CATCH_UP_MAX_PAGES <= 50);
});
