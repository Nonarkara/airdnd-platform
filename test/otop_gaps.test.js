/**
 * Unit tests for the OTOP gaps aggregate (the policy chapter's numbers).
 *
 * The gaps object is computed in scripts/otop/insights.js over the full
 * corpus, so these tests pin the built artefact's shape and its internal
 * consistency — not exact counts, which move with every fetch.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadGaps() {
  const file = path.join(__dirname, '../otop/public/otop_insights.json');
  if (!fs.existsSync(file)) return null; // build stage test
  const insights = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { insights, gaps: insights.gaps ?? null };
}

test('gaps object exists with all eight sections', () => {
  const loaded = loadGaps();
  if (!loaded) return;
  assert.ok(loaded.gaps, 'insights.gaps exists — rebuild with npm run otop:build');
  for (const k of ['funnel', 'darkness', 'desert', 'energy', 'silentTambons', 'temporal', 'standardsGap', 'revenueGap']) {
    assert.ok(loaded.gaps[k] !== undefined, `gaps.${k} exists`);
  }
});

test('funnel adds up: usable + silent titles = distinct titles', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const f = loaded.gaps.funnel;
  assert.equal(f.usableTitles + f.silentTitles, f.distinctTitles);
  assert.equal(f.records, loaded.insights.national.records);
});

test('darkness unclassified matches the national category mix', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const unclassified = loaded.insights.national.categories.find((c) => c.id === 'unclassified');
  assert.equal(loaded.gaps.darkness.unclassified, unclassified.count);
  assert.ok(loaded.gaps.darkness.leastClassified.length === 5);
});

test('desert hidden champions match the headline finding and bound the top-15 rollup', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const finding = loaded.insights.findings.find((f) => f.id === 'hidden-champions');
  assert.equal(loaded.gaps.desert.hiddenChampions, finding.value);
  // The Reach rollup keeps only the top 15 provinces, so it sums below the total.
  const fromReach = loaded.insights.hiddenChampions.reduce((s, p) => s + p.hiddenChampions, 0);
  assert.ok(fromReach <= loaded.gaps.desert.hiddenChampions);
});

test('energy quadrants sum to 77 provinces', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const q = loaded.gaps.energy.quadrant;
  assert.equal(q.ready + q.documented + q.reachable + q.blind, 77);
});

test('silent tambons add up against the geo reference', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const s = loaded.gaps.silentTambons;
  assert.equal(s.withRecords + s.silent, s.reference);
  const buckets = s.buckets;
  assert.equal(buckets.one + buckets.few + buckets.cluster + buckets.basin, s.withRecords);
});

test('temporal dated + undated = all records', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps) return;
  const t = loaded.gaps.temporal;
  assert.equal(t.dated + t.undated, loaded.insights.national.records);
});

test('standardsGap ranks textile as the most products-per-standard', () => {
  const loaded = loadGaps();
  if (!loaded || !loaded.gaps || !loaded.gaps.standardsGap) return;
  const [top] = loaded.gaps.standardsGap;
  assert.equal(top.id, 'textile');
});
