#!/usr/bin/env node
/**
 * Stage 4 — Reachable Champions.
 *
 * The Atlas's "Hidden Champions" list (4-5★ + NO contact) is the
 * contact-drive target: state-certified names nobody can telephone.
 *
 * The opposite list is a seller's starting point: 4-5★ producers the
 * registry says CAN be reached — by phone, email, or website. These
 * are the people a buyer, a journalist, a brand scout, or a
 * cross-border importer can call on Monday morning.
 *
 * This stage joins every producer shard, keeps those with a 4-5★
 * grade and at least one contact channel, and publishes
 *   otop/public/otop_champions.json
 *
 * Fields: sourceRowId, producerName, productName, province, provinceEn,
 * provinceCode, district, subdistrict, category, stars, phone, email,
 * website, address, reach (one of "phone" | "email" | "web"), plus the
 * held มผช. certificates (certs) with the build-time standing (certStatus
 * one of "valid" | "expired" | "unknown" | null, judged as of certAsOf).
 *
 * Sorted by: stars desc, then province asc, then producerName asc.
 *
 * The build is idempotent: rerun produces a byte-identical artefact.
 * A degraded artefact is written if a shard is missing, so the site
 * can show a list of partial champions rather than nothing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHARDS = path.join(ROOT, 'otop/public/p');
const OUT = path.join(ROOT, 'otop/public/otop_champions.json');

const STAR_MIN = 4;

function reachOf(record) {
  if (record.phone && String(record.phone).trim()) return 'phone';
  if (record.email && String(record.email).trim()) return 'email';
  if (record.website && String(record.website).trim()) return 'web';
  return null;
}

function main() {
  const t0 = Date.now();
  if (!fs.existsSync(SHARDS)) {
    console.error(`shards dir missing: ${SHARDS}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SHARDS).filter((f) => /^\d+\.json$/.test(f)).sort();
  const champions = [];
  let rowsScanned = 0;
  let shardsRead = 0;
  let shardsFailed = [];
  for (const f of files) {
    const full = path.join(SHARDS, f);
    try {
      const rows = JSON.parse(fs.readFileSync(full, 'utf8'));
      shardsRead++;
      for (const r of rows) {
        rowsScanned++;
        if (r.stars == null || r.stars < STAR_MIN) continue;
        const reach = reachOf(r);
        if (!reach) continue;
        champions.push({
          sourceRowId: r.sourceRowId ?? null,
          producerName: r.producerName ?? null,
          productName: r.productName ?? null,
          category: r.category ?? null,
          categoryConfidence: r.categoryConfidence ?? null,
          stars: r.stars,
          province: r.province ?? null,
          provinceEn: r.provinceEn ?? null,
          provinceCode: r.provinceCode ?? null,
          region: r.region ?? null,
          district: r.district ?? null,
          subdistrict: r.subdistrict ?? null,
          tambonCode: r.tambonCode ?? null,
          address: r.address ?? null,
          phone: r.phone ?? null,
          email: r.email ?? null,
          website: r.website ?? null,
          imageUrl: r.imageUrl ?? null,
          certs: r.certs ?? [],
          certStatus: r.certStatus ?? null,
          certAsOf: r.certAsOf ?? null,
          reach,
        });
      }
    } catch (e) {
      shardsFailed.push({ file: f, error: e.message });
    }
  }
  champions.sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    if (a.provinceEn !== b.provinceEn) return (a.provinceEn ?? '').localeCompare(b.provinceEn ?? '');
    return (a.producerName ?? '').localeCompare(b.producerName ?? '');
  });
  // Per-province rollup so the front-end can show a leaderboard
  // without re-iterating the producer list.
  const byProvince = {};
  for (const c of champions) {
    const k = c.provinceCode;
    if (!byProvince[k]) byProvince[k] = { code: k, name_th: c.province, name_en: c.provinceEn, region: c.region, count: 0, byCategory: {}, byReach: { phone: 0, email: 0, web: 0 } };
    byProvince[k].count++;
    byProvince[k].byCategory[c.category] = (byProvince[k].byCategory[c.category] ?? 0) + 1;
    byProvince[k].byReach[c.reach] = (byProvince[k].byReach[c.reach] ?? 0) + 1;
  }
  const provinceList = Object.values(byProvince).sort((a, b) => b.count - a.count);

  const out = {
    builtAt: new Date().toISOString(),
    source: 'data.go.th',
    degraded: shardsFailed.length > 0,
    reason: shardsFailed.length > 0 ? `${shardsFailed.length} of ${files.length} shards failed` : null,
    filters: { minStars: STAR_MIN, requireContact: true },
    counts: {
      shardsRead,
      shardsFailed: shardsFailed.length,
      rowsScanned,
      champions: champions.length,
      provinces: provinceList.length,
    },
    provinces: provinceList,
    champions,
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  const ms = Date.now() - t0;
  console.log(`[${new Date().toISOString()}] champions: ${champions.length} of ${rowsScanned} rows across ${shardsRead}/${files.length} shards in ${ms}ms`);
  if (shardsFailed.length > 0) {
    console.log(`  failed: ${shardsFailed.slice(0, 3).map((f) => `${f.file}:${f.error}`).join(', ')}`);
  }
}

main();
