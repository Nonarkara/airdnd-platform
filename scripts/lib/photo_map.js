/**
 * The published-photo map (data/photo_map.json, written by
 * scripts/publish_photos.js --upload), loaded once per process. Absent until
 * photos have been published — callers then leave photo links unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/photo_map.json');
let cached;

export function getPhotoMap() {
  if (cached !== undefined) return cached;
  const file = process.env.PHOTO_MAP_PATH || DEFAULT;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    cached = new Map(Object.entries(parsed.map || {}));
  } catch {
    cached = null;
  }
  return cached;
}
