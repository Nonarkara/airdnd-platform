#!/usr/bin/env node
/**
 * Province signature products pack.
 *
 * For each of the 77 provinces, publish what the *registry* says the place is
 * known for — top declared/inferred categories, most-repeated product names,
 * and reachable champions. Nothing invented: every field is a count from the
 * shards, the insights rollup, or the champions artefact.
 *
 * Output: otop/public/otop_province_faces.json
 *
 * The dossier reads this as "what this province is known for" so a buyer or
 * officer gets the signature pack without loading 5,000 shard rows first.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SHARDS = path.join(ROOT, 'otop/public/p');
const INSIGHTS = path.join(ROOT, 'otop/public/otop_insights.json');
const CHAMPIONS = path.join(ROOT, 'otop/public/otop_champions.json');
const OUT = path.join(ROOT, 'otop/public/otop_province_faces.json');

const TOP_PRODUCTS = 8;
const TOP_CATEGORIES = 5;
const TOP_CHAMPIONS = 5;

/** Bare numbers in the name column are prices/codes, not products. */
function isRealProductName(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (t.length < 2) return false;
  if (/^[\d,.\s]+$/.test(t)) return false;
  // Category labels dumped into productName are not signature products.
  if (/^(อาหาร|เครื่องดื่ม|ผ้าและเครื่องแต่งกาย|ของใช้|สมุนไพร|อาหาร\/เครื่องดื่ม)/.test(t) && t.length < 40) {
    return false;
  }
  return true;
}

function main() {
  const t0 = Date.now();
  if (!fs.existsSync(INSIGHTS)) {
    console.error(`missing ${INSIGHTS} — run otop:build first`);
    process.exit(1);
  }
  const insights = JSON.parse(fs.readFileSync(INSIGHTS, 'utf8'));
  const championsArtefact = fs.existsSync(CHAMPIONS)
    ? JSON.parse(fs.readFileSync(CHAMPIONS, 'utf8'))
    : { champions: [], provinces: [] };

  const championsByProvince = new Map();
  for (const c of championsArtefact.champions ?? []) {
    if (c.provinceCode == null) continue;
    if (!championsByProvince.has(c.provinceCode)) championsByProvince.set(c.provinceCode, []);
    championsByProvince.get(c.provinceCode).push(c);
  }

  const provinces = [];
  let shardsRead = 0;
  let shardsFailed = [];

  for (const p of insights.byProvince ?? []) {
    const code = p.code;
    const shardPath = path.join(SHARDS, `${code}.json`);
    let topProducts = [];
    let productNameCoverage = 0;
    let rowsScanned = 0;

    if (fs.existsSync(shardPath)) {
      try {
        const rows = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
        shardsRead++;
        rowsScanned = rows.length;
        const counts = new Map();
        let withName = 0;
        for (const r of rows) {
          if (!isRealProductName(r.productName)) continue;
          withName++;
          counts.set(r.productName, (counts.get(r.productName) ?? 0) + 1);
        }
        productNameCoverage = rows.length > 0
          ? Math.round((withName / rows.length) * 1000) / 10
          : 0;
        topProducts = [...counts.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
          .slice(0, TOP_PRODUCTS)
          .map(([name, count]) => ({ name, count }));
      } catch (e) {
        shardsFailed.push({ code, error: e.message });
      }
    } else {
      shardsFailed.push({ code, error: 'shard missing' });
    }

    const categories = (p.categories ?? [])
      .filter((c) => c.id !== 'unclassified' && c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_CATEGORIES)
      .map((c) => ({
        id: c.id,
        th: c.th,
        en: c.en,
        count: c.count,
        share: c.share,
      }));

    const provChampions = championsByProvince.get(code) ?? [];
    const championSample = provChampions
      .slice()
      .sort((a, b) => b.stars - a.stars || (a.productName ?? '').localeCompare(b.productName ?? '', 'th'))
      .slice(0, TOP_CHAMPIONS)
      .map((c) => ({
        productName: c.productName,
        producerName: c.producerName,
        category: c.category,
        stars: c.stars,
        reach: c.reach,
        district: c.district ?? null,
      }));

    const dominant = categories[0] ?? null;

    provinces.push({
      code: p.code,
      iso: p.iso,
      th: p.th,
      en: p.en,
      region: p.region,
      records: p.records,
      classified: categories.reduce((n, c) => n + c.count, 0),
      dominantCategory: dominant
        ? { id: dominant.id, th: dominant.th, en: dominant.en, share: dominant.share, count: dominant.count }
        : null,
      categories,
      topProducts,
      productNameCoverage,
      shardRows: rowsScanned,
      champions: {
        count: provChampions.length,
        sample: championSample,
      },
      // Query seeds for media fetch — grounded in this province's own mix.
      mediaQuerySeeds: [
        ...(dominant ? [`${p.en} ${dominant.en}`, `${p.th} ${dominant.th}`] : []),
        ...topProducts.slice(0, 3).map((t) => `${p.th} ${t.name}`),
        `${p.en} OTOP`,
        `${p.th} โอทอป`,
      ].filter(Boolean),
    });
  }

  provinces.sort((a, b) => a.code - b.code);

  const out = {
    builtAt: new Date().toISOString(),
    source: 'data.go.th',
    degraded: shardsFailed.length > 0,
    reason: shardsFailed.length > 0
      ? `${shardsFailed.length} province shard(s) failed`
      : null,
    honesty: {
      note: 'Signature packs are registry counts only — repeated product names and category tallies, not claims about production volume or heritage fame.',
      topProducts: TOP_PRODUCTS,
      topCategories: TOP_CATEGORIES,
      championFilter: championsArtefact.filters ?? { minStars: 4, requireContact: true },
    },
    counts: {
      provinces: provinces.length,
      shardsRead,
      shardsFailed: shardsFailed.length,
      withDominantCategory: provinces.filter((p) => p.dominantCategory).length,
      withNamedProducts: provinces.filter((p) => p.topProducts.length > 0).length,
      withChampions: provinces.filter((p) => p.champions.count > 0).length,
    },
    provinces,
  };

  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  const ms = Date.now() - t0;
  console.log(
    `[${new Date().toISOString()}] province-faces: ${provinces.length} provinces · ` +
      `${out.counts.withNamedProducts} with named products · ` +
      `${out.counts.withChampions} with champions · ${ms}ms → ${path.relative(ROOT, OUT)}`,
  );
  if (shardsFailed.length) {
    console.log(`  failed: ${shardsFailed.slice(0, 5).map((f) => `${f.code}:${f.error}`).join(', ')}`);
  }
}

main();
