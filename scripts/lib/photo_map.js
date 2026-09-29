/**
 * The published-photo map (data/photo_map.json, written by
 * scripts/publish_photos.js --upload). Absent until photos have been
 * published — callers then leave photo links unchanged. Re-read whenever the
 * file changes, so a long-running scraper picks up a new publishing run
 * without a restart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/photo_map.json');
let cached = null;
let cachedStamp = null;

export function getPhotoMap() {
  const file = process.env.PHOTO_MAP_PATH || DEFAULT;
  let stamp;
  try {
    const st = fs.statSync(file);
    stamp = `${file}:${st.mtimeMs}:${st.size}`;
  } catch {
    cached = null;
    cachedStamp = null;
    return null;
  }
  if (stamp === cachedStamp) return cached;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    cached = new Map(Object.entries(parsed.map || {}));
  } catch {
    cached = null;
  }
  cachedStamp = stamp;
  return cached;
}
