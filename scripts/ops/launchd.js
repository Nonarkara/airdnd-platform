#!/usr/bin/env node
/**
 * Run the platform's workers under macOS launchd, from wherever this
 * repository and Node live on this Mac.
 *
 *   npm run ops:install     write + start every worker this .env can run
 *   npm run ops:status      what is running, since when, last exit
 *   npm run ops:stop        stop all workers (e.g. before restoring a backup)
 *   npm run ops:start       start them again
 *   npm run ops:uninstall   stop and remove the jobs
 *
 * Install also retires the old setup: the com.sabai.scraper job (daemon.sh)
 * and any daemon.sh / collector / bot started by hand, so exactly one
 * collector is left on the Telegram session.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { LEGACY_LABELS, renderPlist, selectWorkers, workerCatalogue } from './workers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG_DIR = path.join(ROOT, 'logs');
const AGENTS = path.join(os.homedir(), 'Library', 'LaunchAgents');
const RETIRED = path.join(AGENTS, 'sabai-retired');
const isMac = process.platform === 'darwin';
const domain = () => `gui/${process.getuid()}`;

dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });

function launchctl(args, { quiet = false } = {}) {
  try {
    return { ok: true, out: execFileSync('launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    if (!quiet) console.log(`  launchctl ${args.join(' ')}: ${String(error.stderr || error.message).trim()}`);
    return { ok: false, out: String(error.stdout || '') };
  }
}

export function parseLaunchctlPrint(out) {
  const pick = (re) => re.exec(out)?.[1];
  return {
    state: pick(/^\s*state = (.+)$/m) || 'unknown',
    pid: pick(/^\s*pid = (\d+)$/m) || null,
    lastExit: pick(/^\s*last exit code = (.+)$/m) || null,
    runs: pick(/^\s*runs = (\d+)$/m) || null,
  };
}

export function jobStatus(label) {
  if (!isMac) return { installed: false, state: 'not macOS' };
  const res = launchctl(['print', `${domain()}/${label}`], { quiet: true });
  if (!res.ok) return { installed: fs.existsSync(path.join(AGENTS, `${label}.plist`)), state: 'not loaded' };
  return { installed: true, ...parseLaunchctlPrint(res.out) };
}

function stopStrays() {
  // Hand-started copies (tmux daemon.sh, `npm run scrape:watch`) are outside
  // launchd; a second collector on the same session gets it revoked.
  for (const pattern of ['scripts/daemon.sh', 'scripts/telegram_scraper.js', 'scripts/telegram_bot.js']) {
    try {
      execFileSync('pkill', ['-f', pattern], { stdio: 'ignore' });
      console.log(`  stopped running ${pattern}`);
    } catch { /* none running */ }
  }
}

function retireLegacy() {
  fs.mkdirSync(RETIRED, { recursive: true });
  for (const label of LEGACY_LABELS) {
    const plist = path.join(AGENTS, `${label}.plist`);
    launchctl(['bootout', `${domain()}/${label}`], { quiet: true });
    if (fs.existsSync(plist)) {
      fs.renameSync(plist, path.join(RETIRED, `${label}.plist`));
      console.log(`  retired ${label} (moved to ${path.relative(os.homedir(), RETIRED)})`);
    }
  }
}

function install({ dryRun }) {
  const node = process.execPath;
  const workers = selectWorkers(workerCatalogue(), process.env);
  if (!process.env.LOCAL_DB && !process.env.DATA_STORE) {
    console.log('! LOCAL_DB is not set in .env — the collector would still write to Supabase. Add LOCAL_DB=1 first (see tasks/m3-operations.md).');
  }
  if (!isMac || dryRun) {
    if (!isMac) console.log('launchd exists only on macOS — showing what would be installed:\n');
    for (const w of workers) {
      console.log(`# ${w.label} — ${w.enabled ? 'would install' : `skipped (missing ${w.missing.join(', ')})`}`);
      if (w.enabled) console.log(renderPlist(w, { root: ROOT, node, logDir: LOG_DIR }));
    }
    return isMac ? 0 : 1;
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.mkdirSync(AGENTS, { recursive: true });
  console.log(`Repository: ${ROOT}\nNode: ${node} (${process.version})\n`);
  console.log('Retiring the old setup…');
  for (const w of workers) launchctl(['bootout', `${domain()}/${w.label}`], { quiet: true });
  retireLegacy();
  stopStrays();
  execFileSync('sleep', ['2']);

  console.log('\nInstalling workers…');
  for (const w of workers) {
    const plist = path.join(AGENTS, `${w.label}.plist`);
    if (!w.enabled) {
      if (fs.existsSync(plist)) fs.rmSync(plist);
      console.log(`  – ${w.id.padEnd(9)} skipped: .env lacks ${w.missing.join(', ')}`);
      continue;
    }
    fs.writeFileSync(plist, renderPlist(w, { root: ROOT, node, logDir: LOG_DIR }));
    launchctl(['enable', `${domain()}/${w.label}`], { quiet: true });
    const res = launchctl(['bootstrap', domain(), plist]);
    console.log(`  ${res.ok ? '✓' : '✗'} ${w.id.padEnd(9)} ${w.what}`);
  }
  console.log('\nCheck in a minute with: npm run ops:status');
  return 0;
}

function each(action) {
  if (!isMac) { console.log('launchd exists only on macOS.'); return 1; }
  for (const w of workerCatalogue()) {
    const plist = path.join(AGENTS, `${w.label}.plist`);
    if (!fs.existsSync(plist)) continue;
    if (action === 'stop' || action === 'uninstall') launchctl(['bootout', `${domain()}/${w.label}`], { quiet: true });
    if (action === 'start') launchctl(['bootstrap', domain(), plist], { quiet: true });
    if (action === 'uninstall') fs.rmSync(plist);
    console.log(`  ${action} ${w.label}`);
  }
  return 0;
}

export function status() {
  const rows = workerCatalogue().map((w) => ({ w, s: jobStatus(w.label) }));
  for (const { w, s } of rows) {
    const detail = s.state === 'running' ? `pid ${s.pid}` : s.lastExit ? `last exit ${s.lastExit}` : '';
    console.log(`  ${w.id.padEnd(9)} ${String(s.state).padEnd(11)} ${detail}`);
  }
  return rows;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = 'status'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  const code = command === 'install' ? install({ dryRun })
    : ['start', 'stop', 'uninstall'].includes(command) ? each(command)
      : (status(), 0);
  process.exit(code);
}
