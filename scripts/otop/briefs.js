#!/usr/bin/env node
/**
 * Stage — Briefs (shareable infographics + insight sentences).
 *
 * Reads otop/public/otop_insights.json + otop_meta.json (+ revenue when
 * present) and writes otop/public/otop_briefs.json: precomputed headlines,
 * so-what / now-what lines, and per-province one-liners. The frontend
 * prints these strings verbatim — one definition of each sentence, no
 * second number in prose.
 *
 * Refuses to write when the insights artefact is missing or degraded
 * beyond use; a brief with no honest denominator is not printed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  nationalTakeaway,
  reachTakeaway,
  domainTakeaway,
  provinceAction,
} from '../../otop/core/briefs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUB = path.join(ROOT, 'otop/public');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(PUB, file), 'utf8'));
}

function main() {
  const insightsPath = path.join(PUB, 'otop_insights.json');
  const metaPath = path.join(PUB, 'otop_meta.json');
  if (!fs.existsSync(insightsPath) || !fs.existsSync(metaPath)) {
    console.error('[otop:briefs] missing otop_insights.json or otop_meta.json — run otop:build first');
    process.exit(1);
  }
  const insights = readJson('otop_insights.json');
  const meta = readJson('otop_meta.json');
  let revenue = null;
  try { revenue = readJson('otop_revenue.json'); } catch { revenue = null; }

  const national = insights.national;
  const cards = {
    snapshot: nationalTakeaway(national),
    reach: reachTakeaway(insights.reachGap ?? []),
    domain: domainTakeaway(national.categories ?? []),
  };

  // Money headline: latest full year total + online share, when the series exists.
  if (insights.revenue?.nationalAnnual) {
    const years = Object.entries(insights.revenue.nationalAnnual).sort(([a], [b]) => a - b);
    const [y, a] = years.at(-1) ?? [];
    cards.money = {
      headline: a ? `${(a.total / 1e9).toFixed(1)}B ฿ in ${Number(y) + 543} BE (${a.months} of 12 months)` : '—',
      soWhat: 'Money and names are different datasets. Totals say how much moved, never who earned it.',
      nowWhat: 'Read either money filing, never their average — the two series disagree by design.',
    };
  } else {
    cards.money = { headline: 'No money series published', soWhat: 'No province filed a usable sales total.', nowWhat: 'Require the monthly filing before quoting a national total.' };
  }

  const hidden = insights.hiddenChampions ?? [];
  const hiddenTotal = hidden.reduce((s, p) => s + (p.hiddenChampions ?? 0), 0);
  cards.champions = {
    headline: `${hiddenTotal.toLocaleString('en-US')} certified 4–5★ producers with no contact channel`,
    soWhat: hidden[0]
      ? `${hidden[0].th} holds the most (${hidden[0].hiddenChampions} of ${hidden[0].highStars} 4–5★). The certificate is on file; the route is not.`
      : 'No hidden champions on file.',
    nowWhat: 'Hand the hidden list to the contact-drive. Certified names, not cold calls.',
  };

  const byGap = new Map((insights.reachGap ?? []).map((g) => [g.code, g]));
  const provinces = (insights.byProvince ?? []).map((p) => {
    const gap = byGap.get(p.code) ?? null;
    const topCat = [...(p.categories ?? [])].filter((c) => c.id !== 'unclassified')
      .sort((a, b) => b.count - a.count)[0] ?? null;
    return {
      code: p.code, th: p.th, en: p.en, region: p.region,
      records: p.records,
      reachablePct: gap?.reachablePct ?? null,
      graded: p.stars?.graded ?? 0,
      graded45: (p.stars?.distribution?.[4] ?? 0) + (p.stars?.distribution?.[5] ?? 0),
      hiddenChampions: gap?.hiddenChampions ?? 0,
      topCategory: topCat ? { id: topCat.id, en: topCat.en, th: topCat.th, count: topCat.count } : null,
      action: provinceAction(p, gap),
    };
  });

  const out = {
    builtAt: new Date().toISOString(),
    source: meta.source ?? insights.source ?? 'data.go.th',
    degraded: Boolean(meta.degraded),
    reason: meta.reason ?? null,
    national: {
      records: national.records,
      corroboratedShare: national.corroboratedShare,
      duplicatesCollapsed: national.duplicatesCollapsed ?? meta.counts?.duplicatesCollapsed ?? null,
      completeness: national.completeness,
    },
    cards,
    provinces,
    revenue: revenue && !revenue.degraded
      ? { latestFullYear: insights.revenue?.latestFullYear ?? null, provincesWithData: insights.revenue?.coverage?.provincesWithData ?? null }
      : null,
  };

  fs.writeFileSync(path.join(PUB, 'otop_briefs.json'), JSON.stringify(out, null, 2));
  console.log(`[otop:briefs] ${provinces.length} province one-liners · cards: ${Object.keys(cards).join(', ')}`);
}

main();
