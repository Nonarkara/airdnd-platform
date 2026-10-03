/**
 * The Mac's workers, and the launchd job each one runs as.
 *
 * Plists are generated from where the repository and Node actually are on
 * this machine — the hand-written ones named /Users/nonarkara/Projects/air-dnd
 * and /opt/homebrew/bin/node, and silently did nothing anywhere else.
 */
import path from 'node:path';
import { isLocalStore } from '../lib/data_store.js';

export const LEGACY_LABELS = ['com.sabai.scraper']; // ran scripts/daemon.sh (collector + bot in one bash loop)

export function workerCatalogue() {
  return [
    {
      id: 'collector',
      label: 'com.sabai.collector',
      script: 'scripts/telegram_scraper.js',
      args: ['--watch'],
      keepAlive: true,
      what: 'Reads the Telegram channels every 30 s; extracts, deduplicates, categorises, saves, syncs Firestore.',
      requires: ['TELEGRAM_API_ID', 'TELEGRAM_API_HASH', 'TELEGRAM_SESSION'],
    },
    {
      id: 'bot',
      label: 'com.sabai.bot',
      script: 'scripts/telegram_bot.js',
      keepAlive: 'crash',
      what: 'Owner bot: posts and photos forwarded to it become listings.',
      requires: ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'],
    },
    {
      id: 'heartbeat',
      label: 'com.sabai.heartbeat',
      script: 'scripts/heartbeat.js',
      interval: 1800,
      what: 'Every 30 min: snapshot, feed, patterns, share cards; health check, alerts, log rotation.',
      requires: [],
    },
    {
      id: 'backup',
      label: 'com.sabai.backup',
      script: 'scripts/backup_db.js',
      calendar: { Hour: 3, Minute: 17 },
      background: true,
      what: 'Nightly 03:17: verified copy of the database (+ collector state) to BACKUP_DIR.',
      requires: [],
      localStoreOnly: true,
    },
    {
      id: 'photos',
      label: 'com.sabai.photos',
      script: 'scripts/publish_photos.js',
      args: ['--upload'],
      calendar: { Hour: 4, Minute: 7 },
      background: true,
      what: 'Nightly 04:07: publish new unique, screened photos to R2; remove ones since withheld.',
      requires: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'PHOTO_PUBLIC_BASE_URL'],
    },
  ];
}

/** Which workers this .env can run, and why the others are skipped. */
export function selectWorkers(catalogue, env = process.env) {
  return catalogue.map((w) => {
    const missing = w.requires.filter((name) => !env[name]);
    if (w.localStoreOnly && !isLocalStore(env)) missing.push('LOCAL_DB=1');
    return { ...w, enabled: missing.length === 0, missing };
  });
}

const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPlist(worker, { root, node, logDir }) {
  const lines = [];
  const add = (s) => lines.push(s);
  add('<?xml version="1.0" encoding="UTF-8"?>');
  add('<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">');
  add('<plist version="1.0">');
  add('<dict>');
  add(`  <key>Label</key><string>${xml(worker.label)}</string>`);
  add('  <key>ProgramArguments</key>');
  add('  <array>');
  for (const arg of [node, path.join(root, worker.script), ...(worker.args || [])]) add(`    <string>${xml(arg)}</string>`);
  add('  </array>');
  add(`  <key>WorkingDirectory</key><string>${xml(root)}</string>`);
  add('  <key>EnvironmentVariables</key>');
  add('  <dict>');
  add(`    <key>PATH</key><string>${xml(`${path.dirname(node)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string>`);
  add('    <key>LANG</key><string>en_US.UTF-8</string>');
  add('  </dict>');
  add('  <key>RunAtLoad</key><true/>');
  if (worker.keepAlive === true) {
    add('  <key>KeepAlive</key><true/>');
  } else if (worker.keepAlive === 'crash') {
    add('  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>');
  }
  if (worker.keepAlive) add('  <key>ThrottleInterval</key><integer>30</integer>');
  if (worker.interval) add(`  <key>StartInterval</key><integer>${worker.interval}</integer>`);
  if (worker.calendar) {
    add('  <key>StartCalendarInterval</key>');
    add(`  <dict>${Object.entries(worker.calendar).map(([k, v]) => `<key>${k}</key><integer>${v}</integer>`).join('')}</dict>`);
  }
  if (worker.background) {
    add('  <key>ProcessType</key><string>Background</string>');
    add('  <key>LowPriorityIO</key><true/>');
  }
  add(`  <key>StandardOutPath</key><string>${xml(path.join(logDir, `${worker.id}.log`))}</string>`);
  add(`  <key>StandardErrorPath</key><string>${xml(path.join(logDir, `${worker.id}.err`))}</string>`);
  add('</dict>');
  add('</plist>');
  return `${lines.join('\n')}\n`;
}
