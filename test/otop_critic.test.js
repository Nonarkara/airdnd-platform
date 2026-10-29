/**
 * The Critic view reads the national rollup and quotes it. These tests are
 * about the boundary where that happens.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 *
 * The Critic view shipped with a sentence that read:
 *
 *   "…of the 4–5★ records carry no contact channel of any kind — no phone,
 *    no email, no site. Only a few dozen carry all three buyer signals…"
 *
 * Both numbers were wrong, and the page LOOKED fine. It rendered. It had a
 * heading, four columns, rules between the rows, a source list. Nothing
 * about the screenshot said "this is broken":
 *
 *   · it read `finding.count` where the build writes `finding.value`, so the
 *     first number — 7,089 unreachable champions — rendered as NOTHING.
 *     The sentence had a hole in it and the hole was invisible, because an
 *     absent number and a zero look the same in a screenshot;
 *   · it read `commercial.count` correctly (117) and then threw the number
 *     away in favour of the words "a few dozen", which is not what 117 is.
 *
 * The production doctrine names this exact failure: Law 5 — "malformed
 * upstream fails loud, NEVER RENDERS `undefined`". A view that reads a
 * field the data does not have is a boundary with no validation on it.
 *
 * So the check is a CONTRACT between the view and the data it quotes: every
 * property the view reads off a finding must be a property the build
 * actually writes, with the type the view expects. The pair is checked
 * against the real shipped artefact, not against a fixture that agrees with
 * whatever the code happens to do today.
 *
 * The end-to-end twin of this test is the hole detector in
 * scripts/otop-routes-check.mjs, which reads the rendered text of every
 * view and looks for the fingerprints of a missing value. This one is the
 * fast, local half; that one is the browser half.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CRITIC_SRC = path.join(ROOT, 'otop', 'src', 'components', 'Critic.jsx');
const INSIGHTS = path.join(ROOT, 'otop', 'public', 'otop_insights.json');
const META = path.join(ROOT, 'otop', 'public', 'otop_meta.json');

const source = fs.readFileSync(CRITIC_SRC, 'utf8');
const insights = JSON.parse(fs.readFileSync(INSIGHTS, 'utf8'));

/**
 * The findings the view binds a name to.
 *
 *   const hidden = insights.findings?.find((f) => f.id === 'hidden-champions');
 *
 * The binding is read from the source rather than written down here, so a
 * finding the view starts quoting is picked up by this test without anyone
 * remembering to add it.
 */
function boundFindings(src) {
  const out = [];
  const re = /const\s+(\w+)\s*=\s*insights\.findings\??\.find\(\s*\(?\w+\)?\s*=>\s*\w+\.id\s*===\s*'([^']+)'\s*\)/g;
  let m;
  while ((m = re.exec(src))) out.push({ varName: m[1], id: m[2] });
  return out;
}

/**
 * Every property the view reads off a bound finding.
 *
 *   hidden?.value?.toLocaleString()   →  { varName: 'hidden', prop: 'value' }
 *   commercial?.count?.toLocaleString() → { varName: 'commercial', prop: 'count' }
 */
function accessedProps(src, varName) {
  const props = new Set();
  const re = new RegExp(`\\b${varName}\\s*\\?*\\s*\\.\\s*(\\w+)`, 'g');
  let m;
  while ((m = re.exec(src))) props.add(m[1]);
  return [...props];
}

test('the Critic view binds at least one finding', () => {
  const bound = boundFindings(source);
  assert.ok(bound.length >= 2, `expected the view to bind findings, found ${bound.length}`);
});

test('every property the Critic reads off a finding is one the build writes', () => {
  const bound = boundFindings(source);
  const failures = [];

  for (const { varName, id } of bound) {
    const finding = insights.findings.find((f) => f.id === id);
    assert.ok(finding, `the shipped insights carry no finding "${id}" — the view quotes a row that is not there`);

    for (const prop of accessedProps(source, varName)) {
      if (!(prop in finding)) {
        failures.push(
          `${varName} (${id}) reads ".${prop}", and the build writes ${JSON.stringify(Object.keys(finding))}`,
        );
      }
    }
  }

  assert.equal(
    failures.length,
    0,
    `the view reads properties the data does not have — the number renders as nothing:\n  ${failures.join('\n  ')}`,
  );
});

test('every finding the view quotes carries a numeric value', () => {
  for (const { varName, id } of boundFindings(source)) {
    const finding = insights.findings.find((f) => f.id === id);
    assert.equal(
      typeof finding.value,
      'number',
      `the finding "${id}" (${varName}) has no numeric value — the view would quote "undefined"`,
    );
  }
});

test('the Critic view prints the number rather than describing it', () => {
  // The shape of the bug that shipped: the view read the count correctly
  // and then threw it away in favour of the words "a few dozen". A number
  // that is in the data must reach the reader as a number.
  //
  // This is checked against the SOURCE, not against a literal value. A test
  // that asserts "the number is 7089" breaks the first time the registry is
  // refreshed — and a test that breaks on a legitimate refresh is a test
  // that gets deleted rather than fixed. What must hold is the binding: the
  // prose interpolates the value the build wrote.
  const bound = boundFindings(source);
  assert.ok(bound.length >= 2, 'the view binds no findings');

  for (const { varName } of bound) {
    const prints = new RegExp(`\\b${varName}\\s*\\?\\.\\s*(\\w+)\\s*\\?\\.\\s*toLocaleString\\s*\\(`).test(source);
    assert.ok(
      prints,
      `the view never interpolates a number from ${varName} — it describes the figure instead of printing it`,
    );
  }
});

test('the rollup the Critic quotes is not degraded', () => {
  // A degraded build means the numbers on this view are a stand-in. The
  // view must not present them as the registry.
  assert.equal(
    insights.degraded,
    false,
    `the shipped rollup is degraded (${insights.reason}) — the Critic view would quote a stand-in`,
  );
  assert.equal(insights.source, 'data.go.th');
});

test('the shipped artefacts contain no fingerprint of a missing value', () => {
  // Law 5 at the data boundary: a build that wrote "undefined" into a
  // number's place must fail here, not on a reader's screen.
  for (const file of [INSIGHTS, META]) {
    const raw = fs.readFileSync(file, 'utf8');
    assert.ok(!raw.includes('"undefined"'), `${path.basename(file)} contains the literal "undefined"`);
    assert.ok(!/: *NaN/.test(raw), `${path.basename(file)} contains a NaN`);
  }
});

test('the numbers the Critic quotes are the numbers the build wrote', () => {
  // The one claim the view makes in prose that is derived rather than
  // quoted: the filings grew "roughly sevenfold" between 2020 and 2024.
  // If a later rebuild changes that shape, the sentence has to change with
  // it — so the relationship is checked, and the test survives a refresh.
  const years = insights.byYear.total;
  const countFor = (y) => (years.find((r) => r.year === y) || {}).count || 0;
  const ratio = countFor(2024) / countFor(2020);

  assert.ok(ratio > 6 && ratio < 8, `the sevenfold claim no longer holds: 2020→2024 is ${ratio.toFixed(2)}×`);

  // The two findings the view quotes must be internally consistent: the
  // reachable-and-graded set is a subset of the graded set.
  const hidden = insights.findings.find((f) => f.id === 'hidden-champions');
  const commercial = insights.findings.find((f) => f.id === 'commercial-ready');
  assert.ok(hidden.value > 0, 'no unreachable champions — the view would quote nothing');
  assert.ok(commercial.count > 0, 'no buyer-ready producers — the view would quote nothing');
  assert.ok(
    commercial.count < hidden.value,
    'more buyer-ready producers than unreachable champions — the two figures cannot both be right',
  );
  assert.equal(
    commercial.value,
    Number(((commercial.count / insights.gaps.funnel.records) * 100).toFixed(1)),
    'the percentage the view quotes does not match the count it quotes',
  );
});
