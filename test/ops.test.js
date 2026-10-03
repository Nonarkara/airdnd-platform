import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Everything the Mac runs on its own. With LOCAL_DB=1 none of it may reach
// Supabase: the switch lives in scripts/lib/data_store.js, and a script that
// imports supabase-js directly bypasses it (the bot and the notifier did,
// and would have failed against the cancelled project).
const ALWAYS_ON = [
  'scripts/telegram_bot.js',
  'scripts/notify.js',
  'scripts/heartbeat.js',
  'scripts/refresh_public_snapshot.js',
  'scripts/refresh_feed_snapshot.js',
  'scripts/compute_patterns.js',
  'scripts/integrity_check.js',
  'scripts/publish_photos.js',
];

test('always-on scripts reach the listing store only through the LOCAL_DB switch', () => {
  for (const file of ALWAYS_ON) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /from ['"]@supabase\/supabase-js['"]/, `${file} imports supabase-js directly`);
  }
});

test('backup retention keeps the last 7 days and one copy for each of the last 4 weeks', async () => {
  const { planRetention } = await import('../scripts/lib/db_backup.js');
  const days = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 9, 3) - i * 86_400_000).toISOString().slice(0, 10));
  const names = [...days.map((d) => `sabai-${d}.db`), 'latest.json', 'state-2026-10-03', 'sabai-2026-10-03.db.failed'];
  const removed = new Set(planRetention(names));
  const kept = names.filter((n) => n.startsWith('sabai-') && n.endsWith('.db') && !removed.has(n));
  // 7 newest days (Sat 3 Oct back to Sun 27 Sep), plus the newest copy of the
  // three earlier ISO weeks — four weeks in all, the current one included.
  assert.deepEqual(kept, [
    'sabai-2026-10-03.db', 'sabai-2026-10-02.db', 'sabai-2026-10-01.db', 'sabai-2026-09-30.db',
    'sabai-2026-09-29.db', 'sabai-2026-09-28.db', 'sabai-2026-09-27.db',
    'sabai-2026-09-20.db', 'sabai-2026-09-13.db',
  ]);
  assert.ok(!removed.has('latest.json') && !removed.has('sabai-2026-10-03.db.failed'), 'only dated backups are ever rotated out');
});

test('a backup is a checked, consistent copy taken while another connection writes', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { openLocalDb } = await import('../scripts/lib/local_store.js');
  const { backupDatabase, readLatestBackup } = await import('../scripts/lib/db_backup.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-'));
  const dbPath = path.join(dir, 'sabai.db');
  const writer = openLocalDb(dbPath);
  const insert = writer.prepare('INSERT INTO companions (name, phone, is_safe_image) VALUES (?, ?, ?)');
  for (let i = 0; i < 50; i += 1) insert.run(`Spa ${i}`, `08${String(i).padStart(8, '0')}`, i % 2);
  writer.exec('BEGIN'); // an open write transaction must not block or tear the copy
  insert.run('uncommitted', '0899999999', 1);
  fs.writeFileSync(path.join(dir, '.sabai-scraper-state.json'), '{"lastSeenMessageIds":{"a":1}}');

  const result = await backupDatabase({ dbPath, destDir: path.join(dir, 'backups'), root: dir, date: new Date('2026-10-03T20:00:00Z') });
  writer.exec('ROLLBACK');
  writer.close();

  assert.equal(result.ok, true);
  assert.match(result.file, /sabai-2026-10-04\.db$/, 'named by the Bangkok date');
  assert.equal(result.counts.companions, 50, 'the copy holds committed rows only');
  const { DatabaseSync } = await import('node:sqlite');
  const copy = new DatabaseSync(result.file);
  assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM companions WHERE is_safe_image = 0').get().n, 25);
  copy.close();
  assert.ok(fs.existsSync(path.join(dir, 'backups', 'state-2026-10-04', '.sabai-scraper-state.json')));
  assert.equal(readLatestBackup(path.join(dir, 'backups')).file, result.file);
});

test('a second collector on the same Mac is refused; a dead or pre-reboot one is taken over', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { acquireSingleInstanceLock, bootTime } = await import('../scripts/lib/single_instance.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-'));
  const file = path.join(dir, 'collector.lock');

  const first = acquireSingleInstanceLock(file, { pid: 1111, isAlive: () => true });
  assert.equal(first.ok, true);
  const second = acquireSingleInstanceLock(file, { pid: 2222, isAlive: () => true });
  assert.equal(second.ok, false);
  assert.equal(second.holder.pid, 1111);

  assert.equal(acquireSingleInstanceLock(file, { pid: 3333, isAlive: () => false }).ok, true, 'holder died');
  // After a reboot the old pid may belong to an unrelated process: still stale.
  fs.writeFileSync(file, JSON.stringify({ pid: 3333, host: os.hostname(), bootTime: bootTime() - 3_600_000 }));
  assert.equal(acquireSingleInstanceLock(file, { pid: 4444, isAlive: () => true }).ok, true, 'machine rebooted since');
  // A lock written by another machine is never broken from here.
  fs.writeFileSync(file, JSON.stringify({ pid: 5, host: 'm5-macbook', bootTime: 0 }));
  assert.equal(acquireSingleInstanceLock(file, { pid: 5555, isAlive: () => false }).ok, false);
});

test('worker plists are generated from this machine\'s paths and are well-formed', async () => {
  const { renderPlist, selectWorkers, workerCatalogue } = await import('../scripts/ops/workers.js');
  const env = { TELEGRAM_API_ID: '1', TELEGRAM_API_HASH: 'h', TELEGRAM_SESSION: 's', LOCAL_DB: '1' };
  const workers = Object.fromEntries(selectWorkers(workerCatalogue(), env).map((w) => [w.id, w]));
  assert.equal(workers.collector.enabled, true);
  assert.equal(workers.backup.enabled, true);
  assert.deepEqual(workers.photos.missing, ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'PHOTO_PUBLIC_BASE_URL']);
  assert.deepEqual(selectWorkers(workerCatalogue(), {}).find((w) => w.id === 'backup').missing, ['LOCAL_DB=1']);

  const plist = renderPlist(workers.collector, { root: '/Users/non/Sabai & Co/air-dnd', node: '/opt/homebrew/bin/node', logDir: '/Users/non/Sabai & Co/air-dnd/logs' });
  assert.match(plist, /<string>\/opt\/homebrew\/bin\/node<\/string>\s*<string>\/Users\/non\/Sabai &amp; Co\/air-dnd\/scripts\/telegram_scraper\.js<\/string>\s*<string>--watch<\/string>/);
  assert.match(plist, /<key>KeepAlive<\/key><true\/>/);
  assert.doesNotMatch(plist, /& /, 'ampersands escaped');
  const backup = renderPlist(workers.backup, { root: '/r', node: '/n/node', logDir: '/r/logs' });
  assert.match(backup, /<key>StartCalendarInterval<\/key>\s*<dict><key>Hour<\/key><integer>3<\/integer><key>Minute<\/key><integer>17<\/integer><\/dict>/);
  assert.match(backup, /<key>LowPriorityIO<\/key><true\/>/);
  // Balanced tags: every <dict>/<array> closes.
  for (const tag of ['dict', 'array', 'plist']) {
    assert.equal((plist.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (plist.match(new RegExp(`</${tag}>`, 'g')) || []).length, tag);
  }
});

test('launchctl status output is read correctly', async () => {
  const { parseLaunchctlPrint } = await import('../scripts/ops/launchd.js');
  const out = 'gui/501/com.sabai.collector = {\n\tactive count = 1\n\tpath = /Users/non/Library/LaunchAgents/com.sabai.collector.plist\n\tstate = running\n\n\tprogram = /opt/homebrew/bin/node\n\truns = 3\n\tpid = 4242\n\tlast exit code = 75\n}';
  assert.deepEqual(parseLaunchctlPrint(out), { state: 'running', pid: '4242', lastExit: '75', runs: '3' });
});

test('logs rotate by copy-then-truncate and keep three generations', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { rotateLogs } = await import('../scripts/ops/rotate_logs.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logs-'));
  const log = path.join(dir, 'collector.log');
  const handle = fs.openSync(log, 'a'); // stands in for launchd's open handle
  for (let round = 1; round <= 4; round += 1) {
    fs.writeSync(handle, `round ${round} `.padEnd(200, 'x'));
    assert.deepEqual(rotateLogs(dir, { maxBytes: 100 }), ['collector.log']);
  }
  fs.writeSync(handle, 'after');
  fs.closeSync(handle);
  assert.equal(fs.readFileSync(log, 'utf8'), 'after', 'the open handle keeps writing at the start of the emptied file');
  assert.match(fs.readFileSync(`${log}.1`, 'utf8'), /^round 4/);
  assert.match(fs.readFileSync(`${log}.3`, 'utf8'), /^round 2/);
  assert.equal(fs.existsSync(`${log}.4`), false);
});

test('alerts fire when a check turns bad, repeat every 6 h, and say when it recovers', async () => {
  const { evaluateChecks } = await import('../scripts/ops/watchdog.js');
  const H = 3_600_000;
  const bad = [{ id: 'collector', ok: false, message: 'Collector silent for 25 min', recovered: 'Telegram intake is running again' }];
  const good = [{ id: 'collector', ok: true, message: '', recovered: 'Telegram intake is running again' }];

  let r = evaluateChecks(bad, {}, 0);
  assert.deepEqual(r.messages, ['⚠️ Collector silent for 25 min']);
  r = evaluateChecks(bad, r.state, 0.5 * H);
  assert.deepEqual(r.messages, [], 'no repeat on the next heartbeat');
  r = evaluateChecks(bad, r.state, 6 * H);
  assert.deepEqual(r.messages, ['⚠️ Still: Collector silent for 25 min (for 6.0 h)']);
  r = evaluateChecks(good, r.state, 7 * H);
  assert.deepEqual(r.messages, ['✅ Recovered: Telegram intake is running again (was down 7.0 h)']);
  assert.deepEqual(evaluateChecks(good, r.state, 8 * H).messages, [], 'silence while healthy');
});

test('checks cover the collector, freshness, disk, backups and photos with plain fixes', async () => {
  const { buildChecks } = await import('../scripts/ops/watchdog.js');
  const now = Date.parse('2026-10-03T12:00:00Z');
  const checks = Object.fromEntries(buildChecks({
    collector: { pulseAgeMinutes: 42 },
    data: { ageHours: 3 },
    freeBytes: 2 * 1024 ** 3,
    localStore: true,
    backup: { ok: true, at: '2026-10-01T20:17:00Z' },
    r2: true,
    photos: { ok: false, failed: 3 },
    heartbeatError: null,
  }, now).map((c) => [c.id, c]));
  assert.equal(checks.collector.ok, false);
  assert.match(checks.collector.message, /42 min.*npm run ops:status/);
  assert.equal(checks.freshness.ok, true);
  assert.equal(checks.disk.ok, false);
  assert.match(checks.disk.message, /2\.0 GB free/);
  assert.equal(checks.backup.ok, false, 'a 40-hour-old backup is overdue');
  assert.equal(checks.photos.ok, false);
  assert.equal(checks.heartbeat.ok, true);
  assert.equal(buildChecks({ collector: {}, localStore: false, r2: false }, now).some((c) => c.id === 'backup' || c.id === 'photos'), false,
    'no backup or photo alarms before those are switched on');
});

test('an alert is logged even when Telegram is unreachable, and sent when it is', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { sendOwnerAlert, pingHealthcheck } = await import('../scripts/ops/alert.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alert-'));
  const calls = [];
  const fetchImpl = async (url, opts) => { calls.push({ url, body: opts?.body && JSON.parse(opts.body) }); return { ok: true }; };

  assert.equal((await sendOwnerAlert('no token', { env: {}, logDir: dir, fetchImpl })).sent, false);
  const env = { TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_NOTIFY_CHAT_ID: '42', HEALTHCHECK_URL: 'https://hc.example/abc/' };
  assert.equal((await sendOwnerAlert('collector down', { env, logDir: dir, fetchImpl })).sent, true);
  assert.deepEqual(calls[0].body, { chat_id: '42', text: 'collector down', disable_web_page_preview: true });
  const failing = async () => { throw new Error('offline'); };
  assert.equal((await sendOwnerAlert('offline', { env, logDir: dir, fetchImpl: failing })).sent, false);
  assert.equal(fs.readFileSync(path.join(dir, 'alerts.jsonl'), 'utf8').trim().split('\n').length, 3, 'every alert is on disk');

  await pingHealthcheck(true, { env, fetchImpl });
  await pingHealthcheck(false, { env, fetchImpl });
  assert.deepEqual(calls.slice(1).map((c) => c.url), ['https://hc.example/abc', 'https://hc.example/abc/fail']);
});

test('the heartbeat and integrity check really read the local store (their queries are awaited)', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { openLocalDb } = await import('../scripts/lib/local_store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reads-'));
  const dbPath = path.join(dir, 'sabai.db');
  const db = openLocalDb(dbPath);
  const insert = db.prepare('INSERT INTO companions (name, phone, location) VALUES (?, ?, ?)');
  for (let i = 0; i < 3; i += 1) insert.run(`Spa ${i}`, `081000000${i}`, 'Bangkok');
  db.close();
  const env = { ...process.env, LOCAL_DB: '1', LOCAL_DB_PATH: dbPath, VITE_SUPABASE_URL: '', VITE_SUPABASE_SERVICE_ROLE_KEY: '' };

  const rows = execFileSync(process.execPath, ['--input-type=module', '-e',
    "const { pullSnapshot } = await import('./scripts/heartbeat.js'); console.log((await pullSnapshot()).length);"], { env, encoding: 'utf8' });
  assert.equal(rows.trim().split('\n').pop(), '3', 'an unawaited query returned [] and the heartbeat wrote an empty data.json');

  const report = execFileSync(process.execPath, ['scripts/integrity_check.js'], { env, encoding: 'utf8' });
  assert.match(report, /Total listings: 3/);
});

test('ops:doctor passes a healthy M3 and names the fix for each real problem', async () => {
  const { diagnose } = await import('../scripts/ops/doctor.js');
  const now = Date.parse('2026-10-03T12:00:00Z');
  const healthy = {
    isMac: true, host: 'm3', root: '/Users/non/Projects/air-dnd', home: '/Users/non', nodeVersion: '22.12.0',
    envFile: true,
    env: Object.fromEntries(['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION', 'GEMINI_API_KEY', 'LOCAL_DB', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_NOTIFY_CHAT_ID', 'HEALTHCHECK_URL', 'BACKUP_DIR', 'R2_BUCKET', 'PHOTO_PUBLIC_BASE_URL'].map((k) => [k, true])),
    localStore: true,
    db: { path: '/x', bytes: 800 * 1_048_576, walBytes: 4096, quickCheck: 'ok', counts: { companions: 120, channel_messages: 40000, photo_archive: 50000 }, newest: '2026-10-03T11:40:00Z' },
    dbPath: '/Users/non/Projects/air-dnd/data/sabai.db',
    collector: { pulseAgeMinutes: 0.5 },
    lock: { pid: 4242, host: 'm3', stale: false },
    jobs: {
      collector: { installed: true, state: 'running', pid: '4242', lastExit: '(never exited)' },
      bot: { installed: true, state: 'running', pid: '4243' },
      heartbeat: { installed: true, state: 'not running', lastExit: '0' },
      backup: { installed: true, state: 'not running', lastExit: '0' },
      photos: { installed: true, state: 'not running', lastExit: '0' },
    },
    legacy: { plist: false, daemonRunning: false },
    backup: { dir: '/Volumes/Spare/sabai-backups', explicit: true, sameDisk: false, latest: { at: '2026-10-02T20:17:00Z', bytes: 700 * 1_048_576 } },
    freeRoot: 300 * 1024 ** 3, freeDb: 300 * 1024 ** 3,
    power: { sleep: 0, autorestart: 1 },
    fileVault: 'off',
    status: { photos: { ok: true, at: '2026-10-02T21:07:00Z' } },
  };
  const rows = diagnose(healthy, now);
  assert.deepEqual(rows.filter((r) => r.level !== 'ok'), [], 'a healthy machine is all green');

  const broken = {
    ...healthy,
    root: '/Users/non/Documents/air-dnd',
    env: { ...healthy.env, LOCAL_DB: false },
    localStore: false,
    jobs: { ...healthy.jobs, collector: { installed: true, state: 'not running', lastExit: '1' } },
    legacy: { plist: true, daemonRunning: true },
    collector: { pulseAgeMinutes: 95 },
    power: { sleep: 10, autorestart: 0 },
  };
  const fails = diagnose(broken, now).filter((r) => r.level === 'fail');
  const said = fails.map((r) => `${r.title} → ${r.fix}`).join('\n');
  assert.match(said, /Documents.*→ move it/);
  assert.match(said, /LOCAL_DB is not set.*→ add the line LOCAL_DB=1/);
  assert.match(said, /old setup is still active.*→ npm run ops:install/);
  assert.match(said, /Worker collector is not running, last exit 1/);
  assert.match(said, /95 min ago/);
  assert.match(said, /allowed to sleep.*sudo pmset -a sleep 0/);
});

test('in local mode the snapshot is built on the Mac with placement and categories, no cloud', async () => {
  const os = await import('node:os');
  const path = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { openLocalDb } = await import('../scripts/lib/local_store.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snap-'));
  fs.mkdirSync(path.join(dir, 'public'));
  const dbPath = path.join(dir, 'sabai.db');
  const db = openLocalDb(dbPath);
  db.prepare('INSERT INTO companions (name, location, phone, hours, description, is_safe_image) VALUES (?, ?, ?, ?, ?, ?)')
    .run('Garden Spa', 'แขวงบางชัน เขตคลองสามวา กรุงเทพมหานคร', '0811111111', '10:00-02:00', 'Thai massage and foot massage shop, open late', 1);
  db.close();
  const env = { ...process.env, LOCAL_DB: '1', LOCAL_DB_PATH: dbPath, VITE_SUPABASE_URL: '', VITE_SUPABASE_SERVICE_ROLE_KEY: '', HTTPS_PROXY: 'http://127.0.0.1:9' };
  execFileSync(process.execPath, [path.resolve('scripts/refresh_public_snapshot.js')], { cwd: dir, env, encoding: 'utf8' });
  const [listing] = JSON.parse(fs.readFileSync(path.join(dir, 'public', 'data.json'), 'utf8'));
  assert.equal(listing.geoPrecision, 'tambon');
  assert.equal(listing.geoUnit.district.en, 'Khlong Sam Wa');
  assert.ok(listing.category, 'categories are computed on the Mac and stored with the listing');
  assert.equal(listing.category.hours, 'late-night');
});
