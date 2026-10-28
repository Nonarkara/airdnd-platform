import test from 'node:test';
import assert from 'node:assert/strict';
import { withCycleTimeout, CycleTimeoutError } from '../src/lib/cycle_timeout.js';

test('resolves when the cycle finishes in time', async () => {
  assert.equal(await withCycleTimeout(Promise.resolve(7), 50), 7);
});

test('rejects a hung cycle instead of waiting forever', async () => {
  // The timeout timer is unref'd on purpose (it must not hold a process open),
  // so the test supplies its own ref'd timer to keep the loop alive until it fires.
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(withCycleTimeout(new Promise(() => {}), 20), CycleTimeoutError);
  } finally {
    clearTimeout(keepAlive);
  }
});

test('passes through real errors', async () => {
  await assert.rejects(withCycleTimeout(Promise.reject(new Error('boom')), 50), /boom/);
});
