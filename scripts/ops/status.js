/**
 * One small JSON file (logs/ops-status.json) where each worker records how
 * its last run went. The watchdog and `npm run ops:doctor` read it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const STATUS_PATH = () => process.env.OPS_STATUS_PATH || path.join(ROOT, 'logs', 'ops-status.json');

export function readStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_PATH(), 'utf8')); } catch { return {}; }
}

export function recordStatus(worker, fields) {
  const file = STATUS_PATH();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const all = readStatus();
  all[worker] = { ...fields, at: new Date().toISOString() };
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(all, null, 2));
  fs.renameSync(`${file}.tmp`, file);
  return all[worker];
}
