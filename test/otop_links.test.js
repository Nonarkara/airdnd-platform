/**
 * A link is a promise. This file checks that the promises the site makes are
 * ones the site keeps.
 *
 * THE DEFECT THIS EXISTS TO PREVENT
 *
 * The Atlas chapter's findings each end in a link into Find, and each link
 * carries a filter:
 *
 *   · "Open in Find →"        → the 7,089 unreachable champions
 *   · "Find the 117 →"        → the records carrying all three buyer signals
 *   · "Find 5★ only →"        → the top grade
 *
 * A find-and-replace during the move from query-string routing to path
 * routing rewrote those as `?stars=4` and `?stars=4&contact=1`. The Find
 * view reads `s` and `c` — not `stars` and `contact` — so the parameters
 * were silently ignored, and every one of those three buttons landed the
 * reader on the WHOLE registry with no filter applied.
 *
 * Nothing about the page showed it. The link was a valid route; the page
 * it led to was a real page; the reader was told "Find 5★ only" and got
 * everything. A broken promise that looks exactly like a working one.
 *
 * It is also a failure the route sweep cannot see: the href resolves, the
 * view renders, the title is right. Only the PARAMETER is wrong, and only
 * the target view knows what its parameters are.
 *
 * So the contract is written down here, from the code that reads the query
 * string, and every internal link in the source is checked against it.
 *
 * The two vocabularies are not interchangeable, and that is the trap:
 *
 *   FIND   reads  s (stars) · c (contact) · p (province) · q · cert · sort
 *   MATCH  reads  stars · contact · cat · prov · region · age · corr ·
 *                  signal · q · lens · all
 *
 * Both mean "stars" and both mean "contact". They are spelled differently
 * because they are different views with different state, and a link that
 * crosses between them must carry the spelling of the view it lands on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'otop', 'src');

/**
 * What each view reads out of the query string.
 *
 * Read from the code that parses it:
 *   · otop/core/find.js        → findFromUrl()
 *   · otop/src/lib/requirement.js → requirementFromUrl()
 *   · otop/src/components/Atlas.jsx → the `tab` parameter
 *   · otop/src/components/Briefs.jsx → `card` and `prov`
 */
const FIND_PARAMS = new Set(['sort', 'cert', 'q', 'p', 's', 'c']);
const REQUIREMENT_PARAMS = new Set([
  'lens', 'all', 'cat', 'prov', 'region', 'stars', 'age',
  'contact', 'corr', 'signal', 'q', 'tab',
]);
const ATLAS_PARAMS = new Set(['tab']);
const BRIEFS_PARAMS = new Set(['card', 'prov']);

/**
 * The parameters a link to this path may carry.
 */
function allowedFor(pathname) {
  if (pathname === '/' || pathname === '') return FIND_PARAMS;
  if (pathname.startsWith('/atlas')) return ATLAS_PARAMS;
  if (pathname.startsWith('/briefs')) return BRIEFS_PARAMS;
  if (pathname.startsWith('/match')) return REQUIREMENT_PARAMS;
  if (pathname.startsWith('/province')) return REQUIREMENT_PARAMS;
  if (pathname.startsWith('/history') || pathname.startsWith('/critic')) return new Set();
  return null; // a path with no state — any parameter would be dead weight
}

/**
 * Every internal link in the source, with the file it came from.
 */
function collectLinks() {
  const links = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|mjs)$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const rel = path.relative(path.join(__dirname, '..'), full);
        // Both shapes a link takes in this codebase: an href attribute and a
        // `href:` key in a link table.
        const patterns = [
          /\bhref\s*=\s*"([^"]+)"/g,
          /\bhref\s*=\s*'([^']+)'/g,
          /\bhref\s*:\s*"([^"]+)"/g,
          /\bhref\s*:\s*'([^']+)'/g,
        ];
        for (const re of patterns) {
          let m;
          while ((m = re.exec(text))) links.push({ href: m[1], file: rel });
        }
      }
    }
  };
  walk(SRC);
  return links;
}

test('every internal link carries only parameters its target view reads', () => {
  const links = collectLinks();
  assert.ok(links.length > 10, `expected the source to contain links, found ${links.length}`);

  const failures = [];
  let checked = 0;

  for (const { href, file } of links) {
    // Skip anything that is not a literal internal URL with a query.
    if (!href.startsWith('/')) continue;
    if (href.includes('${')) continue; // built at runtime; checked elsewhere
    const [pathname, query] = href.split('?');
    if (!query) continue;

    const allowed = allowedFor(pathname);
    if (allowed === null) continue; // a path with no state

    for (const pair of query.split('&')) {
      if (!pair) continue;
      const key = decodeURIComponent(pair.split('=')[0]);
      checked++;
      if (!allowed.has(key)) {
        failures.push(
          `${file}: "${href}" carries "${key}", which the view at ${pathname} does not read` +
            (allowed.size ? ` (it reads: ${[...allowed].sort().join(', ')})` : ' (it reads none)'),
        );
      }
    }
  }

  assert.ok(checked > 0, 'no link with a query was found — the check would have passed vacuously');
  assert.equal(
    failures.length,
    0,
    `links carry parameters their target ignores — the reader is told they are filtered and they are not:\n  ${failures.join('\n  ')}`,
  );
});

test("the Find view's star parameter is 's', and '4-5' is a value it understands", () => {
  // The spelling is not free choice: findFromUrl() reads `s`, and
  // matchesStars() understands 'any', '5' and '4-5' — nothing else.
  const find = fs.readFileSync(path.join(__dirname, '..', 'otop', 'core', 'find.js'), 'utf8');
  assert.ok(/p\.get\('s'\)/.test(find), "findFromUrl no longer reads 's' — update this test");
  assert.ok(/STAR_FOUR_FIVE = '4-5'/.test(find), "the '4-5' star band has changed — update this test");
});

test("the Find view's contact parameter is 'c'", () => {
  const find = fs.readFileSync(path.join(__dirname, '..', 'otop', 'core', 'find.js'), 'utf8');
  assert.ok(/p\.get\('c'\) === '1'/.test(find), "findFromUrl no longer reads 'c' — update this test");
});

test("no link anywhere claims a filter the Find view does not implement", () => {
  // The specific promises, checked one by one. Each of these three buttons
  // says what it will show; each must actually show it.
  const findings = fs.readFileSync(
    path.join(SRC, 'components', 'atlas', 'Findings.jsx'),
    'utf8',
  );
  const table = Object.fromEntries(
    [...findings.matchAll(/href:\s*'([^']+)'[\s\S]*?en:\s*'([^']+)'/g)].map((m) => [m[2], m[1]]),
  );

  assert.equal(table['Open in Find →'], '/?s=4-5', 'the hidden-champions link must filter to the 4–5★ band');
  assert.equal(table['Find the 117 →'], '/?s=4-5&c=1', 'the 117 link must filter to 4–5★ AND contactable');
  assert.equal(table['Find 5★ only →'], '/?s=5', 'the graded link must filter to 5★ only');
});
