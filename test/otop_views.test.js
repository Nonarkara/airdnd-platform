/**
 * Static guards on the OTOP React tree.
 *
 * Two views shipped blank to the live site. Both built. Both returned 200.
 * Neither rendered a pixel, and nothing in the HTTP layer said so:
 *
 *   Champions  — a useEffect sat BELOW an early `return`, so the hook
 *                appeared and disappeared between renders. React tore the
 *                tree down the moment the first shard landed (error #310).
 *   Matchmaker — loadIndex() resolves to { index, meta }; the view stored
 *                the wrapper and mapped index.provinces, which was
 *                undefined. One word, one blank page.
 *
 * A blank page is invisible to a build, to a status code and to a unit
 * test. These two checks read the source so the same class of crash
 * cannot come back quietly. The end-to-end guard is
 * scripts/otop-route-sweep.mjs, which loads every view in a real browser.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'otop', 'src');

const COMPONENT_DIRS = ['components', 'components/atlas', 'components/charts'];

function sourceFiles() {
  const out = [];
  for (const dir of [...COMPONENT_DIRS, '.']) {
    const abs = path.join(SRC, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith('.jsx')) continue;
      const rel = path.join(dir, name);
      if (!out.includes(rel)) out.push(rel);
    }
  }
  return out;
}

/**
 * The body of the default-exported component: from its opening brace to the
 * brace that closes it. Module-level helpers above are not part of the
 * component — a helper that returns null is not a hook-order bug.
 * Each line is tagged with the brace depth it sits at, so a `return` inside
 * a callback is not mistaken for a guard clause.
 */
function componentLines(source) {
  const lines = source.split('\n');
  const start = lines.findIndex((l) => /export\s+default\s+function\s+\w+/.test(l));
  if (start < 0) return null;

  let depth = 0;
  let started = false;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!started) {
      if (line.includes('{')) { started = true; depth = 1; }
      continue;
    }
    out.push({ line, depth, no: i + 1 });
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0) break;
  }
  return out;
}

const HOOK_CALL = /^\s*(?:const\s+\w+\s*=\s*)?use(?:State|Reducer|Memo|Ref|Callback|Effect|LayoutEffect|Context)\s*\(/;
const GUARD_RETURN = /^\s*if\s*\(.*\)\s*return\b/;

test('no component calls a hook after a guard return', () => {
  const offenders = [];
  for (const rel of sourceFiles()) {
    const source = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const body = componentLines(source);
    if (!body) continue;

    let guarded = false;
    for (const { line, depth, no } of body) {
      if (depth === 1) {
        if (GUARD_RETURN.test(line)) guarded = true;
        if (guarded && HOOK_CALL.test(line)) {
          offenders.push(`${rel}:${no}  ${line.trim()}`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `a hook is called after a guard return — React tears the view down when the data lands:\n${offenders.join('\n')}`,
  );
});

test('every loadIndex() consumer unwraps { index, meta }', () => {
  const offenders = [];
  for (const rel of sourceFiles()) {
    const source = fs.readFileSync(path.join(SRC, rel), 'utf8');
    const at = source.indexOf('loadIndex()');
    if (at < 0) continue;
    // The resolution site must name `index` — either destructured out of the
    // { index, meta } envelope, or kept whole and spread into state that is
    // later read as .index. Storing the envelope and reading .provinces off
    // it is what blanked the Matchmaker.
    const window = source.slice(at, at + 400);
    const destructured = /\.then\(\s*\(?\s*\[?\s*\{[^}]*\bindex\b/.test(window);
    const spread = /\.then\([^)]*\)\s*=>\s*\{[^}]*\.\.\./.test(window);
    if (!destructured && !spread) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `loadIndex() resolves to { index, meta }: ${offenders.join(', ')}`);
});
