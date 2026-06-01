import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { once } from 'node:events';
import app from '../server.js';
import { createHealthReport } from '../src/lib/server_health.js';

function makeTempProject() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'air-dnd-health-'));
  const distDir = path.join(rootDir, 'dist');
  const publicDir = path.join(rootDir, 'public');
  const logDir = path.join(rootDir, 'logs');

  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Air DnD</title>');
  fs.writeFileSync(
    path.join(publicDir, 'data.json'),
    JSON.stringify([{ id: 1, name: 'Sample', updatedAt: '2026-05-31T12:00:00.000Z' }]),
  );
  fs.writeFileSync(
    path.join(publicDir, 'feed.json'),
    JSON.stringify([{ id: 10, messageDate: '2026-05-31T12:30:00.000Z' }]),
  );
  fs.writeFileSync(
    path.join(logDir, 'heartbeat.jsonl'),
    `${JSON.stringify({
      startedAt: '2026-05-31T12:45:00.000Z',
      finishedAt: '2026-05-31T12:46:00.000Z',
      snapshotCount: 1,
      ok: true,
      stale: false,
      error: null,
    })}\n`,
  );

  return { rootDir, distDir, publicDir, logDir };
}

test('health report marks a complete deployable tree as ok', (t) => {
  const project = makeTempProject();
  t.after(() => fs.rmSync(project.rootDir, { recursive: true, force: true }));

  const report = createHealthReport({
    ...project,
    now: new Date('2026-05-31T13:00:00.000Z'),
  });

  assert.equal(report.ok, true);
  assert.equal(report.status, 'ok');
  assert.equal(report.checks.spaShell.ok, true);
  assert.equal(report.checks.dataSnapshot.count, 1);
  assert.equal(report.checks.dataSnapshot.newestAt, '2026-05-31T12:00:00.000Z');
  assert.equal(report.checks.feedSnapshot.count, 1);
  assert.equal(report.checks.heartbeat.latestRun.snapshotCount, 1);
});

test('health report degrades when the heartbeat stall flag exists', (t) => {
  const project = makeTempProject();
  t.after(() => fs.rmSync(project.rootDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(project.logDir, 'heartbeat.stall'), '{"stale":true}');

  const report = createHealthReport({
    ...project,
    now: new Date('2026-05-31T13:00:00.000Z'),
  });

  assert.equal(report.ok, false);
  assert.equal(report.status, 'degraded');
  assert.equal(report.checks.heartbeat.ok, false);
  assert.equal(report.checks.heartbeat.staleFlag, 'logs/heartbeat.stall');
});

test('health report degrades when public snapshots are empty or missing', (t) => {
  const project = makeTempProject();
  t.after(() => fs.rmSync(project.rootDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(project.publicDir, 'data.json'), '[]');
  fs.rmSync(path.join(project.publicDir, 'feed.json'));

  const report = createHealthReport({
    ...project,
    now: new Date('2026-05-31T13:00:00.000Z'),
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.dataSnapshot.ok, false);
  assert.equal(report.checks.dataSnapshot.count, 0);
  assert.equal(report.checks.feedSnapshot.ok, false);
});

test('express health route returns JSON instead of falling through to the SPA', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(body.service, 'air-dnd');
    assert.ok(['ok', 'degraded'].includes(body.status));
    assert.equal(typeof body.checks.spaShell.ok, 'boolean');
  } finally {
    server.close();
    await once(server, 'close');
  }
});
