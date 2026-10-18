import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseSwapUsage, swapGate, floodWaitSeconds, slicePage, missingMessages, isImageMessage,
  windowKey, channelState, withChannelState, parseIsoToSec,
} from '../src/lib/backfill_plan.js';

test('parses macOS sysctl vm.swapusage', () => {
  const u = parseSwapUsage('vm.swapusage: total = 18432.00M  used = 17496.38M  free = 935.62M  (encrypted)');
  assert.equal(Math.round(u.totalMb), 18432);
  assert.equal(Math.round(u.pct), 95);
  assert.equal(Math.round(parseSwapUsage('total = 2.00G  used = 512.00M  free = 1.50G').pct), 25);
  assert.equal(parseSwapUsage('garbage'), null);
});

test('swap gate refuses above the limit, allows at or below, refuses unreadable', () => {
  assert.equal(swapGate({ totalMb: 100, usedMb: 95, pct: 95 }, 90).ok, false);
  assert.equal(swapGate({ totalMb: 100, usedMb: 90, pct: 90 }, 90).ok, true);
  assert.equal(swapGate({ totalMb: 0, usedMb: 0, pct: 0 }, 90).ok, true);
  assert.equal(swapGate(null, 90).ok, false);
});

test('flood wait seconds from GramJS errors and raw RPC messages', () => {
  class FloodWaitError extends Error { constructor(s) { super(`A wait of ${s} seconds is required`); this.seconds = s; } }
  assert.equal(floodWaitSeconds(new FloodWaitError(42)), 42);
  assert.equal(floodWaitSeconds({ errorMessage: 'FLOOD_WAIT_17' }), 17);
  assert.equal(floodWaitSeconds({ message: '420: FLOOD_PREMIUM_WAIT_5' }), 5);
  assert.equal(floodWaitSeconds(new Error('Not connected')), 0);
  assert.equal(floodWaitSeconds({ seconds: 30, message: 'timeout' }), 0);
  assert.equal(floodWaitSeconds(null), 0);
});

test('slicePage keeps the window, finds the next offset, and stops past since', () => {
  const page = [{ id: 30, date: 300 }, { id: 20, date: 200 }, { id: 10, date: 100 }];
  const a = slicePage(page, 150, 250);
  assert.deepEqual(a.inWindow.map((m) => m.id), [20]);
  assert.equal(a.nextOffsetId, 10);
  assert.equal(a.reachedStart, true);
  const b = slicePage([{ id: 30, date: 300 }, { id: 20, date: 200 }], 150, 1000);
  assert.equal(b.reachedStart, false);
  assert.equal(b.nextOffsetId, 20);
  assert.equal(slicePage([], 0, 1).reachedStart, true);
});

test('missing messages skips ids already stored', () => {
  assert.deepEqual(missingMessages([{ id: 1 }, { id: 2 }, { id: 3 }], new Set([2])).map((m) => m.id), [1, 3]);
});

test('image detection covers photos and image documents only', () => {
  assert.equal(isImageMessage({ media: { photo: {} } }), true);
  assert.equal(isImageMessage({ media: { document: { mimeType: 'image/png' } } }), true);
  assert.equal(isImageMessage({ media: { document: { mimeType: 'video/mp4' } } }), false);
  assert.equal(isImageMessage({}), false);
});

test('state is per window and per channel, and merges patches', () => {
  const key = windowKey('a', 'b');
  let s = withChannelState({}, key, '@x', { offsetId: 50, pages: 1 });
  s = withChannelState(s, key, '@x', { pages: 2 });
  assert.equal(channelState(s, key, '@x').offsetId, 50);
  assert.equal(channelState(s, key, '@x').pages, 2);
  assert.equal(channelState(s, key, '@y').offsetId, 0);
  assert.equal(channelState(s, windowKey('a', 'c'), '@x').offsetId, 0);
});

test('ISO parsing', () => {
  assert.equal(parseIsoToSec('2026-10-11T15:00:00+07:00', 'x'), 1791705600);
  assert.throws(() => parseIsoToSec('yesterday', '--since'));
});

test('backfill script never touches Supabase, never logs in, never prints the session', () => {
  const src = fs.readFileSync(new URL('../scripts/backfill_local.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from\s+['"]@supabase|import\(\s*['"]@supabase|require\(\s*['"]@supabase/);
  assert.doesNotMatch(src, /client\.start\(|session\.save\(|sendCode|signIn/);
  // the session value is never interpolated into, or passed to, any log call
  assert.doesNotMatch(src, /(console\.\w+|log)\([^;]*(\$\{session\}|[(,]\s*session\s*[,)]|process\.env\.TELEGRAM_SESSION)/);
  assert.match(src, /AI_ENRICHMENT_PER_CYCLE = '0'/);
});
