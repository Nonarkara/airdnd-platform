/**
 * What the heartbeat checks every 30 minutes, and when it tells you.
 *
 * An alert goes out when a check turns bad, again every 6 hours while it stays
 * bad, and once when it recovers — never on every run, so a real alarm is not
 * buried under repeats.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPEAT_MS = 6 * 3_600_000;

const minutes = (ms) => (ms < 90 * 60_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`);

/** Pure: checks [{id, ok, message}] + previous state → { messages, state }. */
export function evaluateChecks(checks, previous = {}, now = Date.now(), { repeatMs = REPEAT_MS } = {}) {
  const messages = [];
  const state = {};
  for (const check of checks) {
    const prev = previous[check.id];
    if (check.ok) {
      if (prev && !prev.ok) messages.push(`✅ Recovered: ${check.recovered || check.id} (was down ${minutes(now - prev.since)})`);
      state[check.id] = { ok: true };
      continue;
    }
    if (!prev || prev.ok) {
      messages.push(`⚠️ ${check.message}`);
      state[check.id] = { ok: false, since: now, alertedAt: now };
    } else if (now - prev.alertedAt >= repeatMs) {
      messages.push(`⚠️ Still: ${check.message} (for ${minutes(now - prev.since)})`);
      state[check.id] = { ...prev, alertedAt: now };
    } else {
      state[check.id] = prev;
    }
  }
  return { messages, state };
}

/**
 * Build today's checks from what the workers left on disk.
 * facts: { collector, data, freeBytes, backup, localStore, photos, r2, heartbeatError }
 */
export function buildChecks(facts, now = Date.now()) {
  const checks = [];
  const c = facts.collector || {};
  checks.push({
    id: 'collector',
    ok: c.pulseAgeMinutes != null && c.pulseAgeMinutes <= 10,
    message: c.pulseAgeMinutes == null
      ? 'Collector has never reported — Telegram intake is not running. Run: npm run ops:status'
      : `Collector silent for ${minutes(c.pulseAgeMinutes * 60_000)} — Telegram intake has stopped. Run: npm run ops:status`,
    recovered: 'Telegram intake is running again',
  });
  if (facts.data && Number.isFinite(facts.data.ageHours)) {
    checks.push({
      id: 'freshness',
      ok: facts.data.ageHours <= 24,
      message: `No new listing for ${facts.data.ageHours.toFixed(0)} h — the channels may be quiet, or extraction is failing.`,
      recovered: 'new listings are arriving again',
    });
  }
  if (Number.isFinite(facts.freeBytes)) {
    checks.push({
      id: 'disk',
      ok: facts.freeBytes >= 5 * 1024 ** 3,
      message: `Disk almost full: ${(facts.freeBytes / 1024 ** 3).toFixed(1)} GB free. Photos and the database stop saving when it fills.`,
      recovered: 'disk space',
    });
  }
  if (facts.localStore) {
    const b = facts.backup;
    const age = b?.at ? now - Date.parse(b.at) : Infinity;
    checks.push({
      id: 'backup',
      ok: Boolean(b?.ok) && age <= 36 * 3_600_000,
      message: !b ? 'No database backup has ever completed. Run: npm run ops:backup'
        : !b.ok ? `Last database backup FAILED: ${b.error}`
          : `Last database backup is ${minutes(age)} old (expected nightly).`,
      recovered: 'database backups',
    });
  }
  if (facts.r2) {
    const p = facts.photos;
    const age = p?.at ? now - Date.parse(p.at) : Infinity;
    checks.push({
      id: 'photos',
      ok: Boolean(p?.ok) && age <= 48 * 3_600_000,
      message: !p ? 'Photo publishing has never completed. Run: node scripts/publish_photos.js --upload'
        : !p.ok ? `Photo publishing failed: ${p.error || `${p.failed} uploads failed`}`
          : `Photos last published ${minutes(age)} ago (expected nightly).`,
      recovered: 'photo publishing',
    });
  }
  checks.push({
    id: 'heartbeat',
    ok: !facts.heartbeatError,
    message: `Heartbeat job failed: ${facts.heartbeatError}`,
    recovered: 'heartbeat jobs',
  });
  return checks;
}

export function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}
