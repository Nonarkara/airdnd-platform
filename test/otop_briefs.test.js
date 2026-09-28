/**
 * Unit tests for the Briefs layer (shareable infographic cards).
 *
 * Pure helpers in otop/core/briefs.js are imported for real. The built
 * artefact otop/public/otop_briefs.json is checked for shape when present
 * (skipped when the build stage has not run — same convention as the
 * anchors test in otop_insights.test.js).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRIEF_CARDS,
  nationalTakeaway,
  reachTakeaway,
  domainTakeaway,
  provinceAction,
  cardSvg,
  escapeXml,
} from '../otop/core/briefs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── card registry ──────────────────────────────────────────────

test('six brief cards are registered with EN + TH + question', () => {
  assert.equal(BRIEF_CARDS.length, 6);
  for (const c of BRIEF_CARDS) {
    assert.ok(c.id && c.en && c.th && c.q, `card ${c.id} is complete`);
  }
});

// ── takeaways ──────────────────────────────────────────────────

test('nationalTakeaway pins the headline to its inputs', () => {
  const t = nationalTakeaway({
    records: 154050,
    corroboratedShare: 68.7,
    completeness: { withContact: 5.7, withStars: 9 },
  });
  assert.match(t.headline, /154,050/);
  assert.match(t.headline, /5\.7% reachable/);
  assert.ok(t.soWhat.length > 0 && t.nowWhat.length > 0);
});

test('reachTakeaway names the deepest-gap province', () => {
  const t = reachTakeaway([
    { code: 1, th: 'กทม', en: 'Bangkok', records: 100, reachable: 2, unreachable: 98 },
    { code: 2, th: 'ชม', en: 'Chiang Mai', records: 50, reachable: 40, unreachable: 10 },
  ]);
  assert.match(t.headline, /42 reachable of 150/);
  assert.match(t.soWhat, /กทม/);
});

test('domainTakeaway leads with the top classified category', () => {
  const t = domainTakeaway([
    { id: 'food', en: 'Food', count: 100 },
    { id: 'textile', en: 'Textile', count: 50 },
    { id: 'unclassified', en: 'Unclassified', count: 850 },
  ]);
  assert.match(t.headline, /Food leads/);
});

test('provinceAction prioritises hidden champions, then the contact-drive', () => {
  assert.match(provinceAction({ stars: { graded: 5 } }, { reachablePct: 3, hiddenChampions: 4 }), /4/);
  assert.match(provinceAction({ stars: { graded: 0 } }, { reachablePct: 50, hiddenChampions: 0 }), /grading round/);
  assert.match(provinceAction({ stars: { graded: 9 } }, { reachablePct: 1, hiddenChampions: 0 }), /Contact-drive/);
});

// ── SVG export ─────────────────────────────────────────────────

test('escapeXml neutralises markup', () => {
  assert.equal(escapeXml('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

test('cardSvg is a standalone 1200x630 SVG carrying source + date', () => {
  const svg = cardSvg({
    eyebrow: 'one³ · OTOP BRIEF', title: 'Reach gap', th: 'ช่องว่าง',
    big: '8,869 reachable', sub: 'of 154,050', lines: ['a', 'b'],
    source: 'data.go.th', builtAt: '2026-09-12T00:00:00.000Z',
  });
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, /8,869 reachable/);
  assert.match(svg, /data\.go\.th/);
  assert.match(svg, /2026-09-12/);
});

// ── built artefact ─────────────────────────────────────────────

test('otop_briefs.json carries cards + 77 province one-liners', () => {
  const file = path.join(__dirname, '../otop/public/otop_briefs.json');
  if (!fs.existsSync(file)) return; // build stage test
  const b = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(b.cards.snapshot.headline.length > 0);
  assert.ok(b.cards.reach.headline.length > 0);
  assert.equal(b.provinces.length, 77);
  for (const p of b.provinces) {
    assert.ok(p.code && p.th && p.en && p.action, `province ${p.code} one-liner is complete`);
  }
});
