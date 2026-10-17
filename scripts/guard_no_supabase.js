#!/usr/bin/env node
/**
 * guard_no_supabase.js — refuse to build or deploy the public site if it would
 * talk to Supabase again.
 *
 * Supabase restricted the org behind this project on 2026-10-18. The public
 * site must stay static: listings from public/data.json + feed.json, photos
 * from https://airdnd-media.pages.dev. This guard fails when:
 *   - any file under src/ imports @supabase/* or contains a *.supabase.co URL
 *   - public/data.json / feed.json / feed_meta.json reference *.supabase.co
 *   - with --dist: any built file under dist/ contains a *.supabase.co URL or
 *     the supabase-js client
 *
 * Usage: node scripts/guard_no_supabase.js [--dist]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_DIST = process.argv.includes('--dist');
const HOST = /[a-z0-9]{20}\.supabase\.co/i;
const IMPORT = /from\s+['"]@supabase\/|require\(\s*['"]@supabase\//;
const CLIENT_MARKERS = /supabase-js|createClient\([^)]*supabase/i;

function walk(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

const problems = [];
for (const file of walk(path.join(ROOT, 'src'), ['.js', '.jsx', '.ts', '.tsx', '.mjs'])) {
  const text = fs.readFileSync(file, 'utf8');
  if (IMPORT.test(text)) problems.push(`${path.relative(ROOT, file)} imports @supabase/*`);
  if (HOST.test(text)) problems.push(`${path.relative(ROOT, file)} contains a *.supabase.co URL`);
}
for (const name of ['data.json', 'feed.json', 'feed_meta.json']) {
  const file = path.join(ROOT, 'public', name);
  if (fs.existsSync(file) && HOST.test(fs.readFileSync(file, 'utf8'))) {
    problems.push(`public/${name} references *.supabase.co (photos must point at airdnd-media)`);
  }
}
if (CHECK_DIST) {
  const files = walk(path.join(ROOT, 'dist'), ['.js', '.html', '.json', '.css']);
  if (files.length === 0) problems.push('dist/ is empty — build first');
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (HOST.test(text) || CLIENT_MARKERS.test(text)) problems.push(`${path.relative(ROOT, file)} ships Supabase`);
  }
}

if (problems.length) {
  console.error('✖ guard:no-supabase — refusing to continue:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log(`✓ guard:no-supabase — no Supabase in src/, snapshots${CHECK_DIST ? ', dist/' : ''}`);
