#!/usr/bin/env node
/**
 * Harvest every OTOP dataset manifest from Thailand's CKAN open-data portals.
 *
 *   node scripts/otop_catalog.js            # default: q=OTOP on both portals
 *   node scripts/otop_catalog.js --q โอทอป  # override the query
 *
 * Writes data/otop_catalog.json — one entry per dataset, with every resource
 * (id, format, url, size) needed to download it later. This is metadata only;
 * no data files are fetched here. Run scripts/otop_ingest.js for that.
 *
 * data.go.th and gdcatalog.go.th are both CKAN, so one client serves both. The
 * provincial GD Catalog nodes (chonburi., trat., …) expose the identical API;
 * add them to PORTALS as they become relevant.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, '../data/otop_catalog.json');

const PORTALS = [
  { id: 'data.go.th', base: 'https://data.go.th' },
  { id: 'gdcatalog.go.th', base: 'https://gdcatalog.go.th' },
];

const PAGE_SIZE = 100;
const TIMEOUT_MS = 45_000;
const MAX_RETRIES = 4;
const POLITE_DELAY_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SabaiSabaiResearch/1.0 (OTOP open-data study)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt > MAX_RETRIES) throw err;
    const backoff = 2 ** attempt * 1000;
    console.warn(`    retry ${attempt}/${MAX_RETRIES} in ${backoff / 1000}s — ${err.message}`);
    await sleep(backoff);
    return fetchJson(url, attempt + 1);
  } finally {
    clearTimeout(timer);
  }
}

function slimResource(r) {
  return {
    id: r.id,
    name: r.name || null,
    format: (r.format || '').toUpperCase() || null,
    url: r.url || null,
    size: r.size ?? null,
    // Present only when CKAN has ingested the file into its datastore, which is
    // what makes datastore_search available instead of a raw file download.
    datastore_active: r.datastore_active ?? false,
    last_modified: r.last_modified || r.created || null,
  };
}

function slimPackage(pkg, portal) {
  return {
    portal,
    id: pkg.id,
    name: pkg.name,
    title: pkg.title || null,
    notes: pkg.notes ? String(pkg.notes).slice(0, 1200) : null,
    organization: pkg.organization?.title || pkg.organization?.name || null,
    ministry: pkg.extras?.find?.((e) => /ministry|กระทรวง/i.test(e.key))?.value || null,
    tags: (pkg.tags || []).map((t) => t.display_name || t.name).filter(Boolean),
    groups: (pkg.groups || []).map((g) => g.display_name || g.title || g.name).filter(Boolean),
    license: pkg.license_title || pkg.license_id || null,
    // CKAN reports update cadence in a handful of inconsistent extras keys.
    update_frequency:
      pkg.extras?.find?.((e) => /frequency|ความถี่/i.test(e.key))?.value || null,
    created: pkg.metadata_created || null,
    modified: pkg.metadata_modified || null,
    url: `${PORTALS.find((p) => p.id === portal)?.base}/dataset/${pkg.name}`,
    resources: (pkg.resources || []).map(slimResource),
  };
}

async function harvestPortal(portal, query) {
  console.log(`\n── ${portal.id} · q="${query}"`);
  const first = await fetchJson(
    `${portal.base}/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=1&start=0`,
  );
  const total = first?.result?.count ?? 0;
  console.log(`   ${total} datasets reported`);
  if (!total) return [];

  const out = [];
  for (let start = 0; start < total; start += PAGE_SIZE) {
    const url = `${portal.base}/api/3/action/package_search?q=${encodeURIComponent(query)}&rows=${PAGE_SIZE}&start=${start}`;
    const page = await fetchJson(url);
    const results = page?.result?.results || [];
    if (!results.length) break;
    out.push(...results.map((p) => slimPackage(p, portal.id)));
    process.stdout.write(`\r   harvested ${out.length}/${total}`);
    await sleep(POLITE_DELAY_MS);
  }
  console.log(`\n   done — ${out.length} datasets`);
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const qIndex = argv.indexOf('--q');
  const query = qIndex >= 0 ? argv[qIndex + 1] : 'OTOP';

  const datasets = [];
  for (const portal of PORTALS) {
    try {
      datasets.push(...(await harvestPortal(portal, query)));
    } catch (err) {
      console.error(`   FAILED ${portal.id}: ${err.message}`);
    }
  }

  const resources = datasets.flatMap((d) => d.resources);
  const byFormat = {};
  for (const r of resources) byFormat[r.format || 'UNKNOWN'] = (byFormat[r.format || 'UNKNOWN'] || 0) + 1;

  const manifest = {
    query,
    harvested_at: new Date().toISOString(),
    portals: PORTALS.map((p) => p.id),
    dataset_count: datasets.length,
    resource_count: resources.length,
    resource_formats: Object.fromEntries(Object.entries(byFormat).sort((a, b) => b[1] - a[1])),
    datastore_backed: resources.filter((r) => r.datastore_active).length,
    datasets,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n${'='.repeat(52)}`);
  console.log(`datasets        ${manifest.dataset_count}`);
  console.log(`resources       ${manifest.resource_count}`);
  console.log(`datastore-ready ${manifest.datastore_backed}  (queryable without download)`);
  console.log(`formats         ${JSON.stringify(manifest.resource_formats)}`);
  console.log(`written to      ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log('='.repeat(52));
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
