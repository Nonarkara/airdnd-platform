/**
 * One collector per Mac. Two processes on one Telegram session get it revoked
 * (AUTH_KEY_DUPLICATED — then a manual re-login), and the move to a new
 * machine is exactly when an old tmux daemon and a new launchd worker can
 * both be running.
 *
 * The lock file records pid, host and boot time. It is stale — and taken
 * over — when that process is gone or the machine has rebooted since (pids
 * are reused after a reboot, so a live pid alone proves nothing).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const bootTime = () => Math.round((Date.now() - os.uptime() * 1000) / 60_000) * 60_000;

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
}

export function readLock(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function isStale(holder, { isAlive = pidAlive, boot = bootTime(), host = os.hostname() } = {}) {
  if (!holder || !Number.isInteger(holder.pid)) return true;
  if (holder.host && holder.host !== host) return false; // another machine's lock on a shared disk: never ours to break
  if (Math.abs((holder.bootTime || 0) - boot) > 5 * 60_000) return true;
  return !isAlive(holder.pid);
}

export function acquireSingleInstanceLock(file, { pid = process.pid, ...checks } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid, host: os.hostname(), bootTime: bootTime(), startedAt: new Date().toISOString() }));
      fs.closeSync(fd);
      const release = () => {
        if (readLock(file)?.pid === pid) fs.rmSync(file, { force: true });
      };
      process.once('exit', release);
      return { ok: true, release };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = readLock(file);
      if (holder?.pid === pid) return { ok: true, release: () => fs.rmSync(file, { force: true }) };
      if (!isStale(holder, checks)) return { ok: false, holder };
      fs.rmSync(file, { force: true });
    }
  }
  return { ok: false, holder: readLock(file) };
}
