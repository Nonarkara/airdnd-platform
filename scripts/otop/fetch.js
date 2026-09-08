#!/usr/bin/env node
/**
 * Stage 1 of 2 — pull raw OTOP data from data.go.th into a local cache.
 *
 * This is the ONLY step that touches the network. It writes untouched CKAN
 * responses to otop/data/raw/ and never transforms them, so that:
 *   - stage 2 (`build.js`) is a pure, reproducible function of files on disk
 *     and can run anywhere, including CI and machines with no access to
 *     data.go.th;
 *   - the raw cache is an archive. If a publisher deletes or rewrites a
 *     dataset, the version this project analysed still exists and the finding
 *     is still defensible.
 *
 * Usage:
 *   node scripts/otop/fetch.js               # full discovery + pull
 *   node scripts/otop/fetch.js --discover    # list what would be pulled, pull nothing
 *   node scripts/otop/fetch.js --limit 5     # cap resources (smoke test)
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

const OTOP_RE = /otop|โอทอป|หนึ่งตำบล|ผลิตภัณฑ์ชุมชน|สินค้าชุมชน/i;

function isOtopPackage(pkg) {
  const haystack = [pkg.title, pkg.name, pkg.notes, ...(pkg.tags ?? []).map((t) => t.display_name ?? t.name)]
    .filter(Boolean)
    .join(' ');
  return OTOP_RE.test(haystack);
}

async function main() {
  const client = new CkanClient({ api: CONFIG.source.api });
  const startedAt = new Date().toISOString();

  console.log(`[otop:fetch] portal ${CONFIG.source.portal}`);

  // ---- discovery -----------------------------------------------------------
  const seen = new Map();
  const discoveryErrors = [];

  for (const query of CONFIG.source.queries) {
    try {
      const { count, packages } = await client.searchPackages(query);
      const kept = packages.filter(isOtopPackage);
      console.log(`[otop:fetch] q=${JSON.stringify(query.q)} → ${packages.length}/${count} fetched, ${kept.length} OTOP-relevant`);
      for (const pkg of kept) seen.set(pkg.id, pkg);
    } catch (error) {
      discoveryErrors.push({ query, error: error.message, blocked: Boolean(error.blocked) });
      console.error(`[otop:fetch] q=${JSON.stringify(query.q)} FAILED — ${error.message}`);
      if (error.blocked) break;
    }
  }

  for (const org of CONFIG.source.organizations ?? []) {
    try {
      const { packages } = await client.searchPackages({ q: '', fq: `organization:${org}`, rows: 100, max: 500 });
      const kept = packages.filter(isOtopPackage);
      console.log(`[otop:fetch] org=${org} → ${kept.length} OTOP-relevant`);
      for (const pkg of kept) seen.set(pkg.id, pkg);
    } catch (error) {
      discoveryErrors.push({ org, error: error.message, blocked: Boolean(error.blocked) });
      console.error(`[otop:fetch] org=${org} FAILED — ${error.message}`);
      if (error.blocked) break;
    }
  }

  const packages = [...seen.values()];
  console.log(`[otop:fetch] ${packages.length} distinct OTOP datasets discovered`);

  const targets = [];
  for (const pkg of packages) {
    for (const resource of selectResources(pkg, CONFIG.source.excludeFormats)) {
      targets.push({ pkg, resource });
    }
  }
  const limit = Number(value('limit', targets.length));
  const selected = targets.slice(0, limit);
  console.log(`[otop:fetch] ${targets.length} tabular resources; pulling ${selected.length}`);

  if (flag('discover')) {
    for (const { pkg, resource } of selected) {
      console.log(`  ${resource.format.padEnd(6)} ${resource.datastoreActive ? 'datastore' : 'download '} ${pkg.title} :: ${resource.name ?? resource.id}`);
    }
    writeManifest({ startedAt, packages, targets: selected, results: [], discoveryErrors, discoverOnly: true });
    return;
  }

  // ---- pull ----------------------------------------------------------------
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const results = [];

  for (const [index, { pkg, resource }] of selected.entries()) {
    const label = `[${index + 1}/${selected.length}] ${resource.name ?? resource.id}`;
    const record = {
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
        const ds = await client.datastoreRows(resource.id);
        if (ds) payload = { method: 'datastore_search', rows: ds.rows, fields: ds.fields, truncated: ds.truncated };
      }

      if (!payload && resource.url) {
        const dl = await client.downloadRows(resource.url);
        payload = { method: 'download', rows: dl.rows, encoding: dl.encoding, format: dl.format, bytes: dl.bytes, lossy: dl.lossy };
      }

      if (!payload) throw new Error('no datastore and no downloadable url');

      const out = { ...record, ...payload };
      fs.writeFileSync(path.join(RAW_DIR, `${resource.id}.json`), JSON.stringify(out));
      results.push({ ...record, method: payload.method, rowCount: payload.rows.length, ok: true });
      console.log(`${label} → ${payload.rows.length} rows via ${payload.method}${payload.encoding ? ` (${payload.encoding})` : ''}`);
    } catch (error) {
      results.push({ ...record, ok: false, error: error.message, blocked: Boolean(error.blocked) });
      console.error(`${label} FAILED — ${error.message}`);
      if (error.blocked) {
        console.error('[otop:fetch] egress blocked; stopping. Run this stage from a network that can reach data.go.th.');
        break;
      }
    }
  }

  writeManifest({ startedAt, packages, targets: selected, results, discoveryErrors, discoverOnly: false });

  const ok = results.filter((r) => r.ok);
  const rows = ok.reduce((n, r) => n + r.rowCount, 0);
  console.log(`[otop:fetch] done — ${ok.length}/${results.length} resources, ${rows} raw rows cached in otop/data/raw/`);
  if (ok.length === 0) process.exitCode = 1;
}

function writeManifest({ startedAt, packages, targets, results, discoveryErrors, discoverOnly }) {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RAW_DIR, 'manifest.json'),
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        portal: CONFIG.source.portal,
        discoverOnly,
        datasetCount: packages.length,
        resourceCount: targets.length,
        datasets: packages.map((p) => ({
          id: p.id,
          name: p.name,
          title: p.title,
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
