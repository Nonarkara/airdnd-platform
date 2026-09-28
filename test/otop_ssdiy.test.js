import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The operator manual claims every step in it is runnable. That claim rots the
// first time a script is renamed, and a runbook nobody can follow is worse than
// no runbook — it fails at 3am, not at review time.
test('ssdiy: every `npm run` in the manual is a real script', () => {
  const doc = readFileSync(new URL('../otop/docs/SSDIY.md', import.meta.url), 'utf8');
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

  const referenced = [...new Set([...doc.matchAll(/npm run ([a-z:]+)/g)].map((m) => m[1]))];
  assert.ok(referenced.length >= 5, 'the manual should document the operator commands');

  const missing = referenced.filter((name) => !(name in scripts));
  assert.deepEqual(missing, [], `manual references scripts that do not exist: ${missing.join(', ')}`);
});

test('ssdiy: ship deploys and then verifies, in that order', () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const ship = scripts['otop:ship'];

  // Deploying without a gate is how a broken build stays live: Pages reports
  // success whether or not it uploaded anything new.
  assert.match(ship, /wrangler pages deploy/, 'ship must actually deploy');
  assert.match(ship, /otop:verify/, 'ship must verify what it deployed');
  assert.ok(
    ship.indexOf('wrangler pages deploy') < ship.indexOf('otop:verify'),
    'verify must run after the deploy, not before it',
  );
  assert.doesNotMatch(ship, /git (add|commit|push)/, 'ship must not commit on the operator behalf');
});
