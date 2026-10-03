/**
 * Keep logs/ bounded. launchd holds each worker's log open for as long as the
 * worker lives, so logs are rotated by copy-then-truncate (the open handle
 * appends, so it carries on at the start of the emptied file).
 */
import fs from 'node:fs';
import path from 'node:path';

export function rotateLogs(dir, { maxBytes = 20 * 1_048_576, keep = 3 } = {}) {
  const rotated = [];
  if (!fs.existsSync(dir)) return rotated;
  for (const name of fs.readdirSync(dir)) {
    if (!/\.(log|err|jsonl)$/.test(name)) continue;
    const file = path.join(dir, name);
    const { size } = fs.statSync(file);
    if (size <= maxBytes) continue;
    for (let i = keep - 1; i >= 1; i -= 1) {
      if (fs.existsSync(`${file}.${i}`)) fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`);
    }
    fs.copyFileSync(file, `${file}.1`);
    fs.truncateSync(file, 0);
    rotated.push(name);
  }
  return rotated;
}
