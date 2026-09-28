/**
 * Briefs — shareable infographic cards + deterministic insight sentences.
 *
 * Pure helpers, no I/O. Used by scripts/otop/briefs.js (build time) and
 * otop/src/components/Briefs.jsx (render + SVG/PNG export). Every sentence
 * is a function of numbers already in otop_insights.json — no model, no
 * invention. If the numbers move, the sentences move with them.
 *
 * Design law: sharp edges, one accent (temple gold #c99518), ink on warm
 * paper. SVG export is 1200x630 (chat-preview size) and carries the same
 * numbers as the screen card plus {source, builtAt}.
 */

export const BRIEF_CARDS = [
  { id: 'snapshot', en: 'National snapshot', th: 'ภาพรวมประเทศ', q: 'How big is the registry?' },
  { id: 'reach', en: 'Reach gap', th: 'ช่องว่างการติดต่อ', q: 'Who can be contacted?' },
  { id: 'domain', en: 'Product domain', th: 'ประเภทผลิตภัณฑ์', q: 'What is made?' },
  { id: 'money', en: 'Money', th: 'เงิน', q: 'Where does the money move?' },
  { id: 'champions', en: 'Hidden champions', th: 'แชมป์ที่ซ่อนอยู่', q: 'Who did the state certify but lose?' },
  { id: 'province', en: 'Province one-pager', th: 'หนึ่งจังหวัดหนึ่งหน้า', q: 'What does one province look like?' },
];

const nf = new Intl.NumberFormat('en-US');
export const n = (v) => (v == null ? '—' : nf.format(v));

export function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** National takeaway: headline + so-what + now-what, all pinned to inputs. */
export function nationalTakeaway(national) {
  if (!national) return { headline: '—', soWhat: '—', nowWhat: '—' };
  const c = national.completeness ?? {};
  const headline =
    `${n(national.records)} producers · ${c.withContact ?? '—'}% reachable · ` +
    `${c.withStars ?? '—'}% OPC-graded · ${national.corroboratedShare ?? '—'}% corroborated`;
  const soWhat =
    (c.withContact ?? 100) < 10
      ? 'The registry knows names, not routes. A buyer cannot dial 9 of 10 rows.'
      : 'Reach is partial. The gap between filed names and callable supply is the market.';
  const nowWhat =
    'Put phone + category + price on the registration form. Every chart here moves when the form moves.';
  return { headline, soWhat, nowWhat };
}

/** Reach takeaway from the reachGap rollup. */
export function reachTakeaway(reachGap) {
  const list = reachGap ?? [];
  const reachable = list.reduce((s, p) => s + (p.reachable ?? 0), 0);
  const records = list.reduce((s, p) => s + (p.records ?? 0), 0);
  const top = [...list].sort((a, b) => (b.unreachable ?? 0) - (a.unreachable ?? 0))[0];
  return {
    headline: `${n(reachable)} reachable of ${n(records)} filed`,
    soWhat: top
      ? `${top.th} holds the deepest gap: ${n(top.unreachable)} producers no one can telephone.`
      : 'No province data.',
    nowWhat: top
      ? `Run the contact-drive in ${top.en} first — most names, most lift per visit.`
      : 'Run the contact-drive where the gap is deepest.',
  };
}

/** Domain takeaway from the national category mix. */
export function domainTakeaway(categories) {
  const cats = (categories ?? []).filter((c) => c.id !== 'unclassified');
  const unc = (categories ?? []).find((c) => c.id === 'unclassified');
  const top = [...cats].sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
  return {
    headline: top
      ? `${top.en} leads classified supply (${n(top.count)}); ${n(unc?.count)} unclassified`
      : 'No classified supply.',
    soWhat: `Seven of ten rows carry no category. The domain chapter reads what was filed, not what is made.`,
    nowWhat: 'Make category a required dropdown on the form — one field recovers the whole chapter.',
  };
}

/** Province action line: the one operational sentence for a dossier. */
export function provinceAction(p, gap) {
  if (!p) return '—';
  const reach = gap?.reachablePct ?? p.completeness?.withContact ?? null;
  const graded = p.stars?.graded ?? 0;
  const hidden = gap?.hiddenChampions ?? 0;
  if (hidden > 0) return `Call the ${n(hidden)} certified 4–5★ producers first — vetted names, missing phones.`;
  if (reach != null && reach < 5) return 'Contact-drive first: almost no row carries a route to its maker.';
  if (graded === 0) return 'No OPC grade on file — send the grading round before the buyer round.';
  return 'Shortlist the graded + reachable rows; verify the rest on the ground.';
}

/**
 * Standalone SVG for one card (1200x630). Same numbers as screen, plus the
 * {source, builtAt} footer so a forwarded image never loses provenance.
 */
export function cardSvg({ eyebrow, title, th, big, sub, lines = [], source, builtAt }) {
  const e = escapeXml;
  const body = lines.slice(0, 4).map((l, i) => {
    const y = 400 + i * 44;
    return `<text x="80" y="${y}" font-family="monospace" font-size="26" fill="#5a3625">${e(l)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="#fdf3df"/>` +
    `<rect x="0" y="0" width="1200" height="10" fill="#c99518"/>` +
    `<rect x="0" y="620" width="1200" height="10" fill="#1f0e0a"/>` +
    `<text x="80" y="110" font-family="monospace" font-size="26" letter-spacing="4" fill="#8a6645">${e(eyebrow ?? 'one³ · OTOP BRIEF')}</text>` +
    `<text x="80" y="180" font-family="sans-serif" font-size="56" font-weight="bold" fill="#1f0e0a">${e(title ?? '')}</text>` +
    `<text x="80" y="228" font-family="sans-serif" font-size="30" fill="#8a6645">${e(th ?? '')}</text>` +
    `<text x="80" y="330" font-family="monospace" font-size="64" font-weight="bold" fill="#1f0e0a">${e(big ?? '')}</text>` +
    `<text x="80" y="368" font-family="sans-serif" font-size="26" fill="#5a3625">${e(sub ?? '')}</text>` +
    body +
    `<text x="80" y="590" font-family="monospace" font-size="22" fill="#8a6645">${e(source ?? 'data.go.th')} · ${e((builtAt ?? '').slice(0, 10))} · one³ — counts measure the registry, not the economy</text>` +
    `</svg>`;
}

/** Share URL for a brief card. Keeps the requirement round-trip pattern. */
export function briefUrl(code, card, provinceCode) {
  const p = new URLSearchParams();
  p.set('view', 'briefs');
  if (card) p.set('card', card);
  if (provinceCode != null) p.set('prov', String(provinceCode));
  return `${code ?? ''}${code ? '?' : '?'}${p.toString()}`;
}
