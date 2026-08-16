import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { computeCollectorHealth, computeHealth } from '../scripts/heartbeat.js';

test('snapshot freshness accepts the camelCase fields written by Telegram intake', () => {
  const now = Date.parse('2026-08-17T00:00:00.000Z');
  const health = computeHealth([
    {
      postedAt: '2026-08-16T23:45:00.000Z',
      sourceChannel: '@live-source',
      phone: '0812345678',
      latitude: 13.75,
      longitude: 100.5,
    },
  ], now);

  assert.equal(health.ok, true);
  assert.equal(health.newestAt, '2026-08-16T23:45:00.000Z');
  assert.equal(health.dataStale, false);
  assert.equal(health.channelSnr[0].ch, '@live-source');
});

test('collector pulse measures the scraper state file, independent of post volume', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sabai-heartbeat-'));
  const stateFile = path.join(dir, '.sabai-scraper-state.json');
  fs.writeFileSync(stateFile, '{}');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const pulseAt = Date.parse('2026-08-17T00:00:00.000Z');
  fs.utimesSync(stateFile, pulseAt / 1000, pulseAt / 1000);

  const healthy = computeCollectorHealth(stateFile, pulseAt + 60_000, 5 * 60_000);
  const stale = computeCollectorHealth(stateFile, pulseAt + 6 * 60_000, 5 * 60_000);

  assert.equal(healthy.ok, true);
  assert.equal(healthy.pulseAgeMinutes, 1);
  assert.equal(stale.ok, false);
});
