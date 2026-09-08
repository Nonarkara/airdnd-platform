import { test } from 'node:test';
import assert from 'node:assert';

// Regression fix #3 (2026-09-08): the AI governor's serialization guarantee
// was false. waitAiTurn read aiLastCallAt, slept, then stamped Date.now() —
// a classic TOCTOU. N concurrent channels all read the same aiLastCallAt,
// waited the same window, then fired at the same instant, bursting past the
// rate limit the governor exists to prevent. The slot must be reserved before
// any await so each caller chains onto the previous slot.

// The module reads AI_MIN_GAP_MS once at import time — set it small so the
// test runs in ~100ms while still asserting real spacing.
process.env.AI_MIN_GAP_MS = '25';

const { waitAiTurn } = await import('../scripts/telegram_scraper.js');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('waitAiTurn serializes concurrent callers into a slot chain', async () => {
  // Three callers fire at the same instant. The old implementation let all
  // three resolve ~together (all read the same lastCallAt, slept, then all
  // stamped). The fix reserves each slot synchronously, so resolutions land
  // roughly aiMinGapMs apart in call order.
  const startedAt = Date.now();
  const done = await Promise.all([
    waitAiTurn().then(() => Date.now() - startedAt),
    waitAiTurn().then(() => Date.now() - startedAt),
    waitAiTurn().then(() => Date.now() - startedAt),
  ]);

  // Earliest caller goes first, each later caller lands >= ~gap after the prior.
  assert.ok(done[0] >= 0, `first caller should not wait long, got ${done[0]}ms`);
  assert.ok(done[1] - done[0] >= 15, `second caller too early: ${done[0]} -> ${done[1]}ms`);
  assert.ok(done[2] - done[1] >= 15, `third caller too early: ${done[1]} -> ${done[2]}ms`);
  // The three must not have fired in a single instant.
  assert.ok(done[2] - done[0] >= 30, `callers fired together: ${done.join(', ')}ms`);
});

test('waitAiTurn yields to an in-flight slot already claimed', async () => {
  // Reserve one slot, then a later caller must wait for the next slot, not
  // squeeze into the message gap of the just-fired call.
  await waitAiTurn();
  const t0 = Date.now();
  await waitAiTurn();
  const elapsed = Date.now() - t0;
  assert.ok(elapsed >= 15, `second caller did not wait its turn: ${elapsed}ms`);
});

test('waitAiTurn does not make idle callers wait when no one is queued', async () => {
  await sleep(80); // let any prior slot time out
  const t0 = Date.now();
  await waitAiTurn();
  assert.ok(Date.now() - t0 < 15, 'idle caller should start immediately');
});