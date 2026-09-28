#!/usr/bin/env node
/**
 * Stage 1 of 2 — pull raw OTOP data from data.go.th into a local cache.
 *
 * This is the ONLY step that touches the network. It writes untouched CKAN
 * responses to otop/data/raw/ and transforms nothing, so that:
 *   - stage 2 (`build.js`) is a pure, reproducible function of files on disk
 *     and runs anywhere, including CI and machines with no access to data.go.th;
 *   - the raw cache is an archive. If a publisher deletes or silently rewrites
 *     a dataset, the version this project analysed still exists and the finding
 *     drawn from it is still defensible.
 *
 * Built for the full catalogue: the "OTOP" search runs to ~28 pages of datasets,
 * each with several resources, so this stage is resumable, runs a small
 * concurrency pool, and reports progress. Interrupt it and run it again — every
 * resource already on disk is skipped.
 *
 * Usage:
 *   node scripts/otop/fetch.js                    # full catalogue, resumable
 *   node scripts/otop/fetch.js --discover         # list what would be pulled
 *   node scripts/otop/fetch.js --limit 5          # cap resources (smoke test)
 *   node scripts/otop/fetch.js --concurrency 6    # default 4
 *   node scripts/otop/fetch.js --refetch          # ignore the cache, pull again
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CkanClient, selectResources } from '../../otop/core/ckan.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'otop/data/raw');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'otop.config.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OTOP_RE = /otop|โอทอป|หนึ่งตำบล|ผลิตภัณฑ์ชุมชน|สินค้าชุมชน|วิสาหกิจชุมชน/i;

function isOtopPackage(pkg) {
  const haystack = [pkg.title, pkg.name, pkg.notes, ...(pkg.tags ?? []).map((t) => t.display_name ?? t.name)]
    .filter(Boolean)
    .join(' ');
  return OTOP_RE.test(haystack);
}

/** Resource ids can contain characters that are not safe as filenames. */
const cacheFile = (resourceId) => path.join(RAW_DIR, `${String(resourceId).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`);

/** Run `worker` over `items` with at most `limit` in flight. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

const HUMAN = (n) => n.toLocaleString('en-US');

async function main() {
  const client = new CkanClient({ api: CONFIG.source.api });
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  console.log(`[otop:fetch] portal ${CONFIG.source.portal}`);

  // ---- discovery -----------------------------------------------------------
  const seen = new Map();
  const discoveryErrors = [];
  let blocked = false;

  const record = (packages) => { for (const pkg of packages) seen.set(pkg.id, pkg); };

  for (const query of CONFIG.source.queries) {
    if (blocked) break;
    try {
      const { count, packages } = await client.searchPackages({ ...query, max: Number(value('max-datasets', 5000)) });
      const kept = packages.filter(isOtopPackage);
      console.log(`[otop:fetch] q=${JSON.stringify(query.q)} → ${HUMAN(packages.length)}/${HUMAN(count)} fetched, ${HUMAN(kept.length)} OTOP-relevant`);
      record(kept);
    } catch (error) {
      discoveryErrors.push({ query, error: error.message, blocked: Boolean(error.blocked) });
      console.error(`[otop:fetch] q=${JSON.stringify(query.q)} FAILED — ${error.message}`);
      blocked = blocked || Boolean(error.blocked);
    }
  }

  for (const org of CONFIG.source.organizations ?? []) {
    if (blocked) break;
    try {
      const { packages } = await client.searchPackages({ q: '', fq: `organization:${org}`, rows: 100, max: 2000 });
      const kept = packages.filter(isOtopPackage);
      console.log(`[otop:fetch] org=${org} → ${HUMAN(kept.length)} OTOP-relevant`);
      record(kept);
    } catch (error) {
      discoveryErrors.push({ org, error: error.message, blocked: Boolean(error.blocked) });
      console.error(`[otop:fetch] org=${org} FAILED — ${error.message}`);
      blocked = blocked || Boolean(error.blocked);
    }
  }

  if (blocked) {
    console.error('');
    console.error('[otop:fetch] data.go.th refused the connection (HTTP 403 at the egress proxy).');
    console.error('[otop:fetch] Nothing was fetched. Run this stage from a network that can reach data.go.th.');
    writeManifest({ startedAt, packages: [], targets: [], results: [], discoveryErrors, discoverOnly: false, blocked: true });
    process.exitCode = 1;
    return;
  }

  const packages = [...seen.values()];
  const targets = [];
  for (const pkg of packages) {
    for (const resource of selectResources(pkg, CONFIG.source.excludeFormats)) targets.push({ pkg, resource });
  }

  console.log(`[otop:fetch] ${HUMAN(packages.length)} distinct OTOP datasets · ${HUMAN(targets.length)} tabular resources`);

  const limited = targets.slice(0, Number(value('limit', targets.length)));

  if (flag('discover')) {
    for (const { pkg, resource } of limited) {
      console.log(`  ${resource.format.padEnd(6)} ${resource.datastoreActive ? 'datastore' : 'download '} ${pkg.title} :: ${resource.name ?? resource.id}`);
    }
    writeManifest({ startedAt, packages, targets: limited, results: [], discoveryErrors, discoverOnly: true });
    return;
  }

  // ---- pull ----------------------------------------------------------------
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const refetch = flag('refetch');
  const pending = refetch ? limited : limited.filter(({ resource }) => !fs.existsSync(cacheFile(resource.id)));
  const skipped = limited.length - pending.length;
  if (skipped > 0) console.log(`[otop:fetch] ${HUMAN(skipped)} resources already cached — resuming with ${HUMAN(pending.length)}`);

const MAX_CONCURRENCY = 20;
const MAX_ROWS_PER_RESOURCE = 500_000;
const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Number(value('concurrency', 4)) || 4));
const maxRows = Math.min(MAX_ROWS_PER_RESOURCE, Number(value('max-rows-per-resource', 200_000)) || 200_000);
  let done = 0;
  let aborted = false;

  const results = await pool(pending, concurrency, async ({ pkg, resource }) => {
    if (aborted) return null;

    const meta = {
      resourceId: resource.id,
      datasetId: pkg.id,
      datasetName: pkg.name,
      datasetTitle: pkg.title,
      organization: pkg.organization?.title ?? null,
      licence: pkg.license_title ?? null,
      format: resource.format,
      resourceUrl: resource.url,
      lastModified: resource.lastModified,
      retrievedAt: new Date().toISOString(),
    };

    try {
      let payload = null;

      if (resource.datastoreActive) {
        const ds = await client.datastoreRows(resource.id, { max: maxRows });
        if (ds) payload = { method: 'datastore_search', rows: ds.rows, fields: ds.fields, truncated: ds.truncated };
      }
      if (!payload && resource.url) {
        const dl = await client.downloadRows(resource.url);
        payload = { method: 'download', rows: dl.rows, encoding: dl.encoding, format: dl.format, bytes: dl.bytes, lossy: dl.lossy };
      }
      if (!payload) throw new Error('no datastore and no downloadable url');

      fs.writeFileSync(cacheFile(resource.id), JSON.stringify({ ...meta, ...payload }));
      done += 1;
      const elapsed = (Date.now() - t0) / 1000;
      const rate = done / Math.max(elapsed, 1);
      const eta = rate > 0 ? Math.round((pending.length - done) / rate) : 0;
      console.log(
        `[${done}/${pending.length}] ${HUMAN(payload.rows.length)} rows · ${payload.method}` +
          `${payload.encoding && payload.encoding !== 'utf-8' ? ` · ${payload.encoding}` : ''}` +
          ` · eta ${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s · ${(pkg.title ?? '').slice(0, 48)}`,
      );
      return { ...meta, method: payload.method, rowCount: payload.rows.length, ok: true };
    } catch (error) {
      if (error.blocked) {
        aborted = true;
        console.error('[otop:fetch] egress blocked mid-pull; stopping.');
      } else {
        console.error(`[otop:fetch] FAILED ${resource.name ?? resource.id} — ${error.message}`);
      }
      return { ...meta, ok: false, error: error.message, blocked: Boolean(error.blocked) };
    }
  });

  const settled = results.filter(Boolean);
  writeManifest({ startedAt, packages, targets: limited, results: settled, discoveryErrors, discoverOnly: false, blocked: aborted });

  const ok = settled.filter((r) => r.ok);
  const rows = ok.reduce((n, r) => n + r.rowCount, 0);
  console.log(`[otop:fetch] done — ${HUMAN(ok.length)}/${HUMAN(settled.length)} resources this run, ${HUMAN(rows)} raw rows, ${HUMAN(skipped)} already cached`);
  if (ok.length === 0 && skipped === 0) process.exitCode = 1;
}

function writeManifest({ startedAt, packages, targets, results, discoveryErrors, discoverOnly, blocked = false }) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RAW_DIR, 'manifest.json'),
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        portal: CONFIG.source.portal,
        discoverOnly,
        blocked,
        datasetCount: packages.length,
        resourceCount: targets.length,
        datasets: packages.map((p) => ({
          id: p.id, name: p.name, title: p.title,
          organization: p.organization?.title ?? null,
          licence: p.license_title ?? null,
          metadataModified: p.metadata_modified ?? null,
        })),
        results,
        discoveryErrors,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('[otop:fetch] fatal —', error.message);
  process.exitCode = 1;
});
