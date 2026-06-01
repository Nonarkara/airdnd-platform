import fs from 'fs';
import path from 'path';

const DEFAULT_STALE_HEARTBEAT_HOURS = 4;

function toRelativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath) || path.basename(filePath);
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function newestDateFromRows(rows, fields) {
  return rows.reduce((latest, row) => {
    for (const field of fields) {
      const date = parseDate(row?.[field]);
      if (date && (!latest || date > latest)) {
        latest = date;
      }
    }
    return latest;
  }, null);
}

function fileCheck(rootDir, label, filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      ok: stat.isFile(),
      label,
      path: toRelativePath(rootDir, filePath),
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      label,
      path: toRelativePath(rootDir, filePath),
      error: error.message,
    };
  }
}

function jsonArrayCheck(rootDir, label, filePath, dateFields) {
  const base = fileCheck(rootDir, label, filePath);
  if (!base.ok) {
    return base;
  }

  try {
    const rows = readJsonFile(filePath);
    const newestAt = Array.isArray(rows) ? newestDateFromRows(rows, dateFields) : null;

    return {
      ...base,
      ok: Array.isArray(rows) && rows.length > 0,
      count: Array.isArray(rows) ? rows.length : 0,
      newestAt: newestAt?.toISOString() || null,
      error: Array.isArray(rows) ? null : 'Expected a JSON array.',
    };
  } catch (error) {
    return {
      ...base,
      ok: false,
      count: 0,
      newestAt: null,
      error: error.message,
    };
  }
}

function readLastJsonLine(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return null;

  const lastLine = raw.split('\n').filter(Boolean).at(-1);
  return lastLine ? JSON.parse(lastLine) : null;
}

function heartbeatCheck(rootDir, logDir, nowMs, staleHours = DEFAULT_STALE_HEARTBEAT_HOURS) {
  const heartbeatPath = path.join(logDir, 'heartbeat.jsonl');
  const staleFlagPath = path.join(logDir, 'heartbeat.stall');
  const staleFlagExists = fs.existsSync(staleFlagPath);

  let latestRun = null;
  let latestRunAgeHours = null;
  let logError = null;

  try {
    latestRun = readLastJsonLine(heartbeatPath);
    const finishedAt = parseDate(latestRun?.finishedAt || latestRun?.startedAt);
    if (finishedAt) {
      latestRunAgeHours = +((nowMs - finishedAt.getTime()) / 3_600_000).toFixed(2);
    }
  } catch (error) {
    logError = error.message;
  }

  const heartbeatTooOld = latestRunAgeHours !== null && latestRunAgeHours > staleHours;

  return {
    ok: !staleFlagExists && !latestRun?.stale && !latestRun?.error && !heartbeatTooOld,
    label: 'heartbeat',
    path: toRelativePath(rootDir, heartbeatPath),
    latestRun: latestRun
      ? {
          startedAt: latestRun.startedAt || null,
          finishedAt: latestRun.finishedAt || null,
          snapshotCount: latestRun.snapshotCount ?? latestRun.total ?? null,
          ageHours: latestRun.ageHours ?? null,
          error: latestRun.error || null,
          stale: Boolean(latestRun.stale),
        }
      : null,
    latestRunAgeHours,
    staleFlag: staleFlagExists ? toRelativePath(rootDir, staleFlagPath) : null,
    warning: logError || (!latestRun ? 'No heartbeat log yet.' : null),
  };
}

export function createHealthReport({
  rootDir = process.cwd(),
  distDir = path.join(rootDir, 'dist'),
  publicDir = path.join(rootDir, 'public'),
  logDir = path.join(rootDir, 'logs'),
  now = new Date(),
} = {}) {
  const nowMs = now.getTime();
  const checks = {
    spaShell: fileCheck(rootDir, 'SPA shell', path.join(distDir, 'index.html')),
    dataSnapshot: jsonArrayCheck(
      rootDir,
      'public data snapshot',
      path.join(publicDir, 'data.json'),
      ['postedAt', 'updatedAt', 'createdAt', 'posted_at', 'updated_at', 'created_at'],
    ),
    feedSnapshot: jsonArrayCheck(
      rootDir,
      'public feed snapshot',
      path.join(publicDir, 'feed.json'),
      ['messageDate', 'postedAt', 'updatedAt', 'createdAt', 'message_date', 'posted_at', 'updated_at', 'created_at'],
    ),
    heartbeat: heartbeatCheck(rootDir, logDir, nowMs),
  };

  const criticalChecks = [
    checks.spaShell,
    checks.dataSnapshot,
    checks.feedSnapshot,
    checks.heartbeat,
  ];
  const ok = criticalChecks.every((check) => check.ok);

  return {
    ok,
    status: ok ? 'ok' : 'degraded',
    service: 'air-dnd',
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks,
  };
}
