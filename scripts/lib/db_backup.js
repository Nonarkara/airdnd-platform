/**
 * Nightly backup of the local SQLite store.
 *
 * VACUUM INTO writes a consistent copy from a single read transaction, so it
 * is safe while the collector keeps writing. Each copy is then opened and
 * checked (integrity_check, row counts) before it replaces anything; a copy
 * that fails the check is kept aside as *.failed and reported, never rotated
 * in. Small state files the database does not hold (the collector's
 * last-seen message ids, the photo ledger and map, the Maps cache) are copied
 * next to it.
 *
 * Retention: the newest `keepDaily` copies, plus the newest copy of each of
 * the last `keepWeekly` ISO weeks.
 */
import fs from 'node:fs';
import path from 'node:path';

export const BACKUP_PATTERN = /^sabai-(\d{4}-\d{2}-\d{2})\.db$/;

const STATE_FILES = ['.sabai-scraper-state.json', 'data/photo_ledger.json', 'data/photo_map.json', '.maps_cache.json', '.geocoder_cache.json'];

function isoWeek(dateString) {
  const d = new Date(`${dateString}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Names (from `names`) to delete under the retention rule. Pure. */
export function planRetention(names, { keepDaily = 7, keepWeekly = 4 } = {}) {
  const dated = names
    .map((name) => ({ name, date: BACKUP_PATTERN.exec(name)?.[1] }))
    .filter((f) => f.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const keep = new Set(dated.slice(0, keepDaily).map((f) => f.name));
  const weeks = new Set();
  for (const f of dated) {
    const week = isoWeek(f.date);
    if (weeks.has(week)) continue;
    weeks.add(week);
    if (weeks.size > keepWeekly) break;
    keep.add(f.name);
  }
  return dated.filter((f) => !keep.has(f.name)).map((f) => f.name);
}

function countTables(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  return Object.fromEntries(tables.map((t) => [t, Number(db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n)]));
}

/**
 * @returns {{ ok: boolean, file?: string, bytes?: number, counts?: object, removed?: string[], error?: string }}
 */
export async function backupDatabase({ dbPath, destDir, root, date = new Date(), keepDaily = 7, keepWeekly = 4 }) {
  const { DatabaseSync } = await import('node:sqlite');
  // Opening a missing path would create an empty database — and "back it up".
  if (!fs.existsSync(dbPath)) return { ok: false, error: `no database at ${dbPath}` };
  fs.mkdirSync(destDir, { recursive: true });
  const day = new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10); // Bangkok date
  const finalPath = path.join(destDir, `sabai-${day}.db`);
  const tmpPath = `${finalPath}.tmp`;
  fs.rmSync(tmpPath, { force: true });

  const source = new DatabaseSync(dbPath);
  source.exec('PRAGMA busy_timeout = 15000;');
  try {
    source.exec(`VACUUM INTO '${tmpPath.replaceAll("'", "''")}'`);
  } finally {
    source.close();
  }

  const copy = new DatabaseSync(tmpPath);
  let check;
  let counts;
  try {
    check = copy.prepare('PRAGMA integrity_check').all().map((r) => Object.values(r)[0]);
    counts = countTables(copy);
  } finally {
    copy.close();
  }
  if (check.length !== 1 || check[0] !== 'ok') {
    fs.renameSync(tmpPath, `${finalPath}.failed`);
    return { ok: false, error: `integrity_check: ${check.slice(0, 3).join('; ')}` };
  }
  fs.renameSync(tmpPath, finalPath);

  if (root) {
    const stateDir = path.join(destDir, `state-${day}`);
    fs.mkdirSync(stateDir, { recursive: true });
    for (const rel of STATE_FILES) {
      const from = path.join(root, rel);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(stateDir, rel.replaceAll('/', '__')));
    }
  }

  const bytes = fs.statSync(finalPath).size;
  const removed = planRetention(fs.readdirSync(destDir), { keepDaily, keepWeekly });
  for (const name of removed) {
    fs.rmSync(path.join(destDir, name), { force: true });
    fs.rmSync(path.join(destDir, name.replace(BACKUP_PATTERN, 'state-$1')), { recursive: true, force: true });
  }
  const manifest = { ok: true, at: date.toISOString(), file: finalPath, bytes, counts, removed };
  fs.writeFileSync(path.join(destDir, 'latest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

/** The newest successful backup recorded in destDir, or null. */
export function readLatestBackup(destDir) {
  try { return JSON.parse(fs.readFileSync(path.join(destDir, 'latest.json'), 'utf8')); } catch { return null; }
}
