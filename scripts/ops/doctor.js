#!/usr/bin/env node
/**
 * npm run ops:doctor — is this Mac ready to run the platform on its own?
 *
 * Prints one line per check (✓ fine, ! look at it, ✗ fix it) and, for every
 * problem, the exact command or setting that fixes it. Reads names in .env,
 * never values. Exit code 1 when anything needs fixing.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GB = 1024 ** 3;

const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};

function freeBytes(dir) {
  try { const st = fs.statfsSync(dir); return st.bavail * st.bsize; } catch { return null; }
}

export async function gatherFacts() {
  const envPath = path.join(ROOT, '.env');
  const envFile = fs.existsSync(envPath);
  const env = envFile ? dotenv.parse(fs.readFileSync(envPath)) : {};
  const { isLocalStore } = await import('../lib/data_store.js');
  const { DEFAULT_DB_PATH } = await import('../lib/local_store.js');
  const { computeCollectorHealth } = await import('../heartbeat.js');
  const { readLock, isStale } = await import('../lib/single_instance.js');
  const { readLatestBackup } = await import('../lib/db_backup.js');
  const { readStatus } = await import('./status.js');
  const isMac = process.platform === 'darwin';

  const dbPath = path.resolve(env.LOCAL_DB_PATH || DEFAULT_DB_PATH);
  let db = null;
  if (fs.existsSync(dbPath)) {
    db = { path: dbPath, bytes: fs.statSync(dbPath).size, walBytes: fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0 };
    try {
      const { DatabaseSync } = await import('node:sqlite');
      const conn = new DatabaseSync(dbPath);
      conn.exec('PRAGMA busy_timeout = 15000;');
      db.quickCheck = Object.values(conn.prepare('PRAGMA quick_check').get())[0];
      db.counts = {};
      for (const t of ['companions', 'channel_messages', 'photo_archive']) {
        try { db.counts[t] = Number(conn.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n); } catch { db.counts[t] = null; }
      }
      try { db.newest = conn.prepare('SELECT MAX(created_at) AS t FROM companions').get().t; } catch { /* no table */ }
      conn.close();
    } catch (error) {
      db.error = error.message;
    }
  }

  const lockFile = path.join(ROOT, 'data', 'collector.lock');
  const holder = readLock(lockFile);
  let jobs = null;
  if (isMac) {
    const { jobStatus } = await import('./launchd.js');
    const { workerCatalogue } = await import('./workers.js');
    jobs = Object.fromEntries(workerCatalogue().map((w) => [w.id, jobStatus(w.label)]));
  }
  const backupDir = path.resolve(env.BACKUP_DIR || path.join(ROOT, 'backups'));
  const pmset = isMac ? run('pmset', ['-g']) : null;
  const sameDisk = (() => {
    try { return fs.statSync(backupDir).dev === fs.statSync(path.dirname(dbPath)).dev; } catch { return null; }
  })();
  let photoMapAt = null;
  try { photoMapAt = fs.statSync(path.join(ROOT, 'data', 'photo_map.json')).mtime.toISOString(); } catch { /* none */ }

  return {
    isMac,
    arch: process.arch,
    host: os.hostname(),
    root: ROOT,
    home: os.homedir(),
    nodeVersion: process.versions.node,
    envFile,
    env: Object.fromEntries(Object.keys(env).map((k) => [k, Boolean(env[k])])),
    localStore: isLocalStore(env),
    db,
    dbPath,
    collector: computeCollectorHealth(path.join(ROOT, '.sabai-scraper-state.json')),
    lock: holder ? { ...holder, stale: isStale(holder) } : null,
    jobs,
    legacy: isMac ? {
      plist: fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.sabai.scraper.plist')),
      daemonRunning: run('pgrep', ['-f', 'scripts/daemon.sh']) !== null,
    } : null,
    backup: { dir: backupDir, explicit: Boolean(env.BACKUP_DIR), latest: readLatestBackup(backupDir), sameDisk },
    freeRoot: freeBytes(ROOT),
    freeDb: freeBytes(path.dirname(dbPath)),
    power: pmset ? {
      sleep: Number(/^\s*sleep\s+(\d+)/m.exec(pmset)?.[1] ?? NaN),
      autorestart: Number(/^\s*autorestart\s+(\d+)/m.exec(pmset)?.[1] ?? NaN),
    } : null,
    fileVault: isMac ? (/On/.test(run('fdesetup', ['status']) || '') ? 'on' : 'off') : null,
    photoMapAt,
    status: readStatus(),
  };
}

const ago = (iso, now) => {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  return ms < 3_600_000 ? `${Math.round(ms / 60_000)} min ago` : ms < 2 * 86_400_000 ? `${(ms / 3_600_000).toFixed(1)} h ago` : `${Math.round(ms / 86_400_000)} days ago`;
};

/** Pure: facts → [{ level: 'ok'|'warn'|'fail', title, fix? }] */
export function diagnose(f, now = Date.now()) {
  const out = [];
  const ok = (title) => out.push({ level: 'ok', title });
  const warn = (title, fix) => out.push({ level: 'warn', title, fix });
  const fail = (title, fix) => out.push({ level: 'fail', title, fix });

  const [major, minor] = f.nodeVersion.split('.').map(Number);
  if (major > 22 || (major === 22 && minor >= 5)) ok(`Node ${f.nodeVersion} (built-in SQLite)`);
  else fail(`Node ${f.nodeVersion} is too old for the local database (needs 22.5+)`, 'brew install node@22, then: npm run ops:install');

  const where = f.root;
  if (where.includes('/Library/Mobile Documents/') || ['Desktop', 'Documents', 'Downloads'].some((d) => where.startsWith(path.join(f.home, d)))) {
    fail(`Project folder is in ${where.replace(f.home, '~')} — iCloud can sync or offload files mid-write, and background jobs are blocked there by macOS privacy rules`,
      `move it: mkdir -p ~/Projects && mv "${where}" ~/Projects/, then run npm run ops:install from the new place`);
  } else ok(`Project folder ${where.replace(f.home, '~')}`);

  if (!f.envFile) {
    fail('.env is missing — no Telegram session, no keys', 'copy .env from the old Mac into the project folder (AirDrop is fine; never email it)');
  } else {
    const missing = ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION', 'GEMINI_API_KEY'].filter((k) => !f.env[k]);
    if (missing.length) fail(`.env lacks ${missing.join(', ')}`, 'copy them from the old Mac\'s .env');
    else ok('.env has the Telegram session and Gemini key');
    if (!f.localStore) fail('LOCAL_DB is not set — the collector still writes to Supabase', 'add the line LOCAL_DB=1 to .env, then: npm run ops:install');
    else ok('Local database switch is on (LOCAL_DB=1)');
    if (!f.env.TELEGRAM_BOT_TOKEN || !f.env.TELEGRAM_NOTIFY_CHAT_ID) warn('Alerts cannot reach you: TELEGRAM_BOT_TOKEN or TELEGRAM_NOTIFY_CHAT_ID missing', 'add both to .env (the chat id is your own Telegram user id)');
    else ok('Alerts go to your Telegram');
    if (!f.env.HEALTHCHECK_URL) warn('No outside alarm if the Mac itself goes down (power cut, crash, no internet)', 'free: create a check at healthchecks.io (period 30 min, grace 30 min), add HEALTHCHECK_URL=<its ping URL> to .env');
    else ok('Outside alarm (HEALTHCHECK_URL) set');
  }

  if (f.localStore) {
    if (!f.db) {
      fail(`No local database at ${f.dbPath.replace(f.home, '~')}`, 'import the Supabase export: npm run exit:import -- --from <export folder>');
    } else if (f.db.error || f.db.quickCheck !== 'ok') {
      fail(`Database check failed: ${f.db.error || f.db.quickCheck}`, 'stop workers (npm run ops:stop) and send me this output; the nightly backups are in the backup folder');
    } else {
      const c = f.db.counts;
      ok(`Database healthy · ${(f.db.bytes / 1_048_576).toFixed(0)} MB · ${c.companions ?? '?'} listings · ${c.channel_messages ?? '?'} messages · ${c.photo_archive ?? '?'} photos${f.db.newest ? ` · newest listing ${ago(f.db.newest, now)}` : ''}`);
      if (f.db.walBytes > 512 * 1_048_576) warn(`Write-ahead log is ${(f.db.walBytes / 1_048_576).toFixed(0)} MB (normally small)`, 'npm run ops:stop && npm run ops:start (lets SQLite fold it back in)');
    }
  }

  if (f.jobs) {
    const legacyOn = f.legacy?.plist || f.legacy?.daemonRunning;
    if (legacyOn) fail('The old setup is still active (com.sabai.scraper / daemon.sh) — two collectors revoke the Telegram session', 'npm run ops:install (it retires the old job and stops stray copies)');
    const periodic = new Set(['heartbeat', 'backup', 'photos']);
    for (const [id, s] of Object.entries(f.jobs)) {
      const exited = s.lastExit && !['0', '(never exited)'].includes(s.lastExit);
      if (s.state === 'not loaded') {
        if (s.installed) warn(`Worker ${id} is installed but not loaded`, 'npm run ops:start');
        else if (id === 'collector' || id === 'heartbeat') fail(`Worker ${id} is not installed`, 'npm run ops:install');
      } else if (periodic.has(id)) {
        if (exited) warn(`Worker ${id}: last run exited ${s.lastExit}`, `read logs/${id}.err`);
        else ok(`Worker ${id}: scheduled${s.state === 'running' ? ', running now' : ''}`);
      } else if (s.state === 'running') {
        ok(`Worker ${id}: running (pid ${s.pid})`);
      } else {
        (id === 'collector' ? fail : warn)(`Worker ${id} is ${s.state}${exited ? `, last exit ${s.lastExit}` : ''}`, `read logs/${id}.err, then npm run ops:start`);
      }
    }
  }

  const pulse = f.collector?.pulseAgeMinutes;
  if (pulse == null) warn('Collector has not run on this Mac yet', 'npm run ops:install, then check again in 2 minutes');
  else if (pulse > 10) fail(`Collector last reported ${Math.round(pulse)} min ago — intake has stopped`, 'npm run ops:status, then read logs/collector.err');
  else ok(`Collector reported ${Math.round(pulse)} min ago`);
  if (f.lock && !f.lock.stale && f.lock.host && f.lock.host !== f.host) warn(`Collector lock belongs to ${f.lock.host}`, 'make sure that machine is stopped (npm run ops:uninstall there)');

  if (f.localStore) {
    const b = f.backup;
    if (!b.latest) warn('No database backup yet', 'npm run ops:backup');
    else if (now - Date.parse(b.latest.at) > 36 * 3_600_000) fail(`Last backup ${ago(b.latest.at, now)}`, 'npm run ops:backup, then check logs/backup.err');
    else ok(`Last backup ${ago(b.latest.at, now)} (${(b.latest.bytes / 1_048_576).toFixed(0)} MB)`);
    if (!b.explicit || b.sameDisk) warn('Backups sit on the same disk as the database — one drive failure loses both', 'plug in a second drive and add BACKUP_DIR=/Volumes/<drive>/sabai-backups to .env; also turn on Time Machine');
  }

  for (const [label, bytes] of [['Project disk', f.freeRoot], ['Database disk', f.freeDb]]) {
    if (bytes == null) continue;
    if (bytes < 5 * GB) fail(`${label}: only ${(bytes / GB).toFixed(1)} GB free`, 'free space or move photos/backups to an external drive');
    else if (bytes < 20 * GB) warn(`${label}: ${(bytes / GB).toFixed(0)} GB free (photos arrive at ~5–6 GB a month)`, 'put new photos on an external drive: PHOTO_ARCHIVE_DIR=/Volumes/<drive>/sabai-photos in .env');
  }

  if (f.power) {
    if (f.power.sleep !== 0) fail('The Mac is allowed to sleep — workers stop when it does', 'sudo pmset -a sleep 0 disksleep 0 (a MacBook must also stay on power)');
    else ok('Sleep is off');
    if (f.power.autorestart !== 1) warn('The Mac will not switch itself back on after a power cut', 'sudo pmset -a autorestart 1 (desktop Macs; MacBooks restart when power returns if the lid is open)');
    else ok('Restarts automatically after a power cut');
  }
  if (f.fileVault === 'on') warn('FileVault is on: after a power cut the Mac waits for your password, and workers start only once you log in', 'keep it on (the data holds phone numbers); the outside alarm (HEALTHCHECK_URL) tells you when to log in');

  if (f.env.R2_BUCKET && f.env.PHOTO_PUBLIC_BASE_URL) {
    const p = f.status?.photos;
    if (!p) warn('Photos have not been published from this Mac yet', 'node scripts/publish_photos.js, then --upload (tasks/supabase-exit.md step 6)');
    else if (!p.ok) fail(`Last photo publishing failed: ${p.error || `${p.failed} failures`}`, 'node scripts/publish_photos.js --upload (it resumes)');
    else ok(`Photos published ${ago(p.at, now)}`);
  } else {
    warn('Photos are not published to R2 yet — the live site still loads them from Supabase', 'tasks/supabase-exit.md step 6');
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const facts = await gatherFacts();
  const rows = diagnose(facts);
  const mark = { ok: '✓', warn: '!', fail: '✗' };
  console.log(`\nSabai Sabai — machine check · ${facts.host} (${facts.isMac ? 'macOS' : process.platform}, ${facts.arch})\n`);
  for (const level of ['fail', 'warn', 'ok']) {
    for (const r of rows.filter((x) => x.level === level)) {
      console.log(` ${mark[level]} ${r.title}`);
      if (r.fix) console.log(`     → ${r.fix}`);
    }
  }
  const n = (level) => rows.filter((r) => r.level === level).length;
  console.log(`\n${n('fail')} to fix · ${n('warn')} to look at · ${n('ok')} fine\n`);
  process.exit(n('fail') ? 1 : 0);
}
