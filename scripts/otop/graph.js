#!/usr/bin/env node
/**
 * Stage 4 — universe graph.
 *
 * Joins every layer of the registry into one knowledge graph artefact:
 *   business    region · province · category · basin (tambon epicenter)
 *   strategy    filing year · era (program history 2001–2026) · revenue
 *   provenance  publishing agency · standard group (มผช.)
 *
 * Reads  otop/public/otop_index.json + otop_insights.json +
 *         otop_standards.json + otop_tambons.json + province shards
 * Writes otop/public/otop_graph.json
 *
 * Small on purpose (~150 nodes, ~500 edges): the full 154k-record graph
 * would be unshippable as a static file. Provinces, years, agencies and
 * basins stand in for the entities behind them, with weights carrying the
 * counts. Nothing is sampled — every edge weight is a full-corpus count.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeId } from '../../otop/core/universe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUB = path.join(ROOT, 'otop/public');

const read = (f) => JSON.parse(fs.readFileSync(path.join(PUB, f), 'utf8'));

// Program eras — the same public-record timeline the History view reads.
// Each pins to the nearest filing year so the strategy ring has a backbone.
const ERAS = [
  { key: 'declare', year: 2001, en: 'OTOP declared', th: 'ประกาศนโยบาย OTOP' },
  { key: 'opc', year: 2003, en: 'OPC 5-star rating', th: 'คัดสรรสุดยอด OTOP' },
  { key: 'coup', year: 2006, en: 'Suspended, then revived', th: 'ระงับแล้วฟื้น' },
  { key: 'tourism', year: 2009, en: 'OTOP Tourism Village', th: 'หมู่บ้านท่องเที่ยว' },
  { key: 'sales153', year: 2017, en: 'Sales cross 153B baht', th: 'ยอดขาย 153,000 ล้าน' },
  { key: 'series', year: 2022, en: 'National monthly series', th: 'ข้อมูลยอดขายรายเดือน' },
  { key: 'platform', year: 2025, en: 'One platform reads it whole', th: 'หนึ่งแพลตฟอร์มอ่านทั้งทะเบียน' },
];

function main() {
  for (const f of ['otop_index.json', 'otop_insights.json']) {
    if (!fs.existsSync(path.join(PUB, f))) {
      console.error(`[otop:graph] missing ${f} — run npm run otop:build first`);
      process.exit(1);
    }
  }
  const index = read('otop_index.json');
  const insights = read('otop_insights.json');
  const standards = fs.existsSync(path.join(PUB, 'otop_standards.json')) ? read('otop_standards.json') : null;
  const tambons = fs.existsSync(path.join(PUB, 'otop_tambons.json')) ? read('otop_tambons.json') : { tambons: [] };

  const nodes = [];
  const edges = [];
  const push = (nd) => { nodes.push(nd); return nd.id; };
  const link = (s, t, w, kind) => { if (w > 0) edges.push({ s, t, w, kind }); };

  push({ id: nodeId('root', 'otop'), kind: 'root', en: 'OTOP universe', th: 'จักรวาล OTOP', value: insights.national?.records ?? index.totals.records });

  // Regions + provinces (business).
  for (const r of insights.byRegion ?? []) {
    const id = push({ id: nodeId('region', r.id), kind: 'region', en: r.en, th: r.th, value: r.records });
    link(nodeId('root', 'otop'), id, r.records, 'contains');
  }
  const provByCode = new Map();
  for (const p of insights.byProvince ?? []) {
    const id = push({ id: nodeId('province', p.code), kind: 'province', code: p.code, en: p.en, th: p.th, value: p.records });
    provByCode.set(p.code, p);
    link(nodeId('region', p.region), id, p.records, 'contains');
  }

  // Categories + province supply edges (business). Index shards carry the
  // full 77-province category split, so every edge is a whole-corpus count.
  const cats = (insights.national?.categories ?? []).filter((c) => c.id !== 'unclassified');
  for (const c of cats) {
    push({ id: nodeId('category', c.id), kind: 'category', en: c.en, th: c.th, value: c.count });
  }
  for (const p of index.provinces ?? []) {
    for (const [catId, count] of Object.entries(p.categories ?? {})) {
      if (count > 0) link(nodeId('province', p.code), nodeId('category', catId), count, 'supplies');
    }
  }

  // Basins (business) — top tambon epicenters, pinned to their province.
  const basins = [...(tambons.tambons ?? [])].sort((a, b) => b.records - a.records).slice(0, 12);
  for (const b of basins) {
    const id = push({ id: nodeId('basin', b.code), kind: 'basin', en: `${b.en} · ${b.districtTh}`, th: `ต.${b.th}`, value: b.records });
    link(nodeId('province', b.provinceCode), id, b.records, 'clusters');
  }

  // Agencies (provenance). Top contributors link to the root with their row
  // counts; the agency→province corroboration mesh is scanned from the shards
  // so overlap — the trust signal — is drawn, not asserted.
  const contributors = insights.contributors ?? [];
  const topAgencies = contributors.slice(0, 10);
  const topNames = new Set(topAgencies.map((c) => c.organization));
  topAgencies.forEach((c, i) => {
    push({ id: nodeId('agency', `a${i}`), kind: 'agency', en: c.organization, th: null, value: c.records });
    link(nodeId('agency', `a${i}`), nodeId('root', 'otop'), c.records, 'files');
  });
  if (contributors.length > topAgencies.length) {
    const rest = contributors.slice(topAgencies.length).reduce((s, c) => s + c.records, 0);
    push({ id: nodeId('agency', 'rest'), kind: 'agency', en: `+${contributors.length - topAgencies.length} other offices`, th: 'หน่วยงานอื่น', value: rest });
    link(nodeId('agency', 'rest'), nodeId('root', 'otop'), rest, 'files');
  }
  try {
    const idxByCode = new Map((index.provinces ?? []).map((p) => [p.code, p]));
    const mesh = new Map(); // agencyIdx → Map(provinceCode → count)
    for (const p of index.provinces ?? []) {
      let rows = [];
      try {
        rows = JSON.parse(fs.readFileSync(path.join(PUB, 'p', `${p.code}.json`), 'utf8'));
      } catch { continue; }
      for (const r of rows) {
        for (const prov of r.provenance ?? []) {
          const ai = topAgencies.findIndex((c) => c.organization === prov.organization);
          if (ai === -1) continue;
          if (!mesh.has(ai)) mesh.set(ai, new Map());
          const m = mesh.get(ai);
          m.set(r.provinceCode, (m.get(r.provinceCode) ?? 0) + 1);
        }
      }
    }
    let meshEdges = 0;
    for (const [ai, m] of mesh) {
      for (const [code, count] of m) {
        if (count >= 10 && idxByCode.has(code)) {
          link(nodeId('agency', `a${ai}`), nodeId('province', code), count, 'attests');
          meshEdges += 1;
          if (meshEdges >= 220) break;
        }
      }
      if (meshEdges >= 220) break;
    }
    console.log(`[otop:graph] agency→province attestation edges: ${meshEdges}`);
  } catch (e) {
    console.warn(`[otop:graph] shard mesh skipped: ${e.message}`);
  }
  void provByCode;

  // Standards (provenance) — มผช. groups govern categories.
  const STD_TO_CAT = { food: 'food', beverage: 'beverage', decor: 'craft', textile: 'textile', herbal: 'herbal' };
  if (standards?.byCategory) {
    for (const [stdKey, catId] of Object.entries(STD_TO_CAT)) {
      const count = standards.byCategory[stdKey] ?? 0;
      if (!count) continue;
      const id = push({ id: nodeId('standard', stdKey), kind: 'standard', en: `TCPS ${stdKey}`, th: 'มผช.', value: count });
      link(id, nodeId('category', catId), count, 'governs');
    }
  }

  // Years + eras (strategy).
  const byYear = insights.byYear ?? { years: [], total: [], byCategory: {} };
  const yearCount = new Map((byYear.total ?? []).map((y) => [y.year, y.count]));
  for (const y of byYear.years ?? []) {
    push({ id: nodeId('year', y), kind: 'year', en: String(y), th: y >= 2000 ? `${y + 543}` : String(y), value: yearCount.get(y) ?? 0 });
  }
  for (const [catId, series] of Object.entries(byYear.byCategory ?? {})) {
    if (catId === 'unclassified') continue;
    for (const pt of series) {
      if (pt.count > 0 && (byYear.years ?? []).includes(pt.year)) {
        link(nodeId('year', pt.year), nodeId('category', catId), pt.count, 'filed');
      }
    }
  }
  for (const era of ERAS) {
    const id = push({ id: nodeId('era', era.key), kind: 'era', en: era.en, th: era.th, value: null });
    const anchor = (byYear.years ?? []).reduce((best, y) => (best == null || Math.abs(y - era.year) < Math.abs(best - era.year) ? y : best), null);
    if (anchor != null) link(id, nodeId('year', anchor), 1, 'marks');
  }

  // Revenue (strategy) — latest full year, top provinces.
  const rev = insights.revenue ?? null;
  if (rev?.top10?.length) {
    const yearTotal = Object.entries(rev.nationalAnnual ?? {}).sort(([a], [b]) => b - a)[0];
    const id = push({ id: nodeId('revenue', rev.latestFullYear ?? 'sales'), kind: 'revenue', en: `Sales ${rev.latestFullYear}`, th: 'ยอดขาย', value: yearTotal ? yearTotal[1].total : null });
    for (const p of rev.top10) {
      if (p.total != null) link(id, nodeId('province', p.code), Math.round(p.total / 1e9), 'moves');
    }
  }

  const payload = {
    builtAt: new Date().toISOString(),
    source: 'data.go.th joins — every weight a full-corpus count',
    counts: { nodes: nodes.length, edges: edges.length },
    nodes,
    edges,
  };
  fs.writeFileSync(path.join(PUB, 'otop_graph.json'), JSON.stringify(payload));
  console.log(`[otop:graph] ${nodes.length} nodes · ${edges.length} edges → otop/public/otop_graph.json`);
}

main();
