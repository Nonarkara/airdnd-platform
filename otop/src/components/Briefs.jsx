/**
 * Briefs — shareable infographic cards + deterministic insight analysis.
 *
 * Each card answers one question with one big number, one small chart, and
 * two analysis lines (So what / Now what) precomputed by scripts/otop/briefs.js
 * into otop_briefs.json. The screen prints those strings verbatim; the SVG/PNG
 * export carries the same numbers plus {source, builtAt} so a forwarded image
 * never loses provenance.
 *
 * Export is data-driven, not a screenshot: the SVG is built by
 * otop/core/briefs.js cardSvg() from the same values on screen.
 */

import { useEffect, useMemo, useState } from 'react';
import { n, bnBaht } from './atlas/fmt.jsx';
import Composition, { categoryParts } from './atlas/Composition.jsx';
import Bars from './charts/Bars.jsx';
import { loadInsights } from '../lib/insights.js';
import { cardSvg } from '../../core/briefs.js';

async function loadBriefs() {
  const r = await fetch('/otop_briefs.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`otop_briefs.json ${r.status}`);
  return r.json();
}

function download(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function downloadSvg(name, svg) {
  download(name, svg, 'image/svg+xml;charset=utf-8');
}

function downloadPng(name, svg) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fdf3df';
    ctx.fillRect(0, 0, 1200, 630);
    ctx.drawImage(img, 0, 0, 1200, 630);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const out = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = out; a.download = name; a.click();
      URL.revokeObjectURL(out);
    }, 'image/png');
  };
  img.src = url;
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch { return false; }
}

function CardShell({ id, q, title, th, big, sub, lines, source, builtAt, cardParam, children, onCopy }) {
  const [copied, setCopied] = useState(false);
  const share = `${window.location.origin}${window.location.pathname}?view=briefs&card=${id}${cardParam ?? ''}`;
  const svg = cardSvg({ eyebrow: `one³ · OTOP BRIEF — ${q}`, title, th, big, sub, lines, source, builtAt });
  const stamp = (builtAt ?? '').slice(0, 10);
  return (
    <article className="bf-card" data-card={id} id={`brief-${id}`}>
      <p className="bf-q">{q}</p>
      <h3 className="bf-t">{title} <span className="bf-th" lang="th">{th}</span></h3>
      <p className="bf-big">{big}</p>
      {sub && <p className="bf-sub">{sub}</p>}
      <div className="bf-chart">{children}</div>
      <dl className="bf-why">
        {lines.slice(0, 2).map((l, i) => (
          <div key={i} className="bf-why-row">
            <dt>{i === 0 ? 'So what' : 'Now what'}</dt>
            <dd>{l}</dd>
          </div>
        ))}
      </dl>
      <p className="bf-src">Source <code>{source}</code> · built {stamp} · counts measure the registry, not the economy.</p>
      <div className="bf-actions">
        <button type="button" className="reset" onClick={async () => { const ok = await copyLink(share); setCopied(ok); onCopy?.(id); }}>Copy link{copied ? ' ✓' : ''}</button>
        <button type="button" className="reset" onClick={() => downloadSvg(`otop-brief-${id}-${stamp}.svg`, svg)}>SVG</button>
        <button type="button" className="reset" onClick={() => downloadPng(`otop-brief-${id}-${stamp}.png`, svg)}>PNG</button>
        <button type="button" className="reset" onClick={() => window.print()}>Print</button>
      </div>
    </article>
  );
}

export default function Briefs({ insights: passed, onSelectProvince }) {
  const [insights, setInsights] = useState(passed ?? null);
  const [briefs, setBriefs] = useState(null);
  const [error, setError] = useState(null);
  const [prov, setProv] = useState(() => Number(new URLSearchParams(window.location.search).get('prov')) || null);
  const go = onSelectProvince ?? ((code) => { window.location.href = `/?view=province&code=${code}`; });

  useEffect(() => {
    let cancelled = false;
    if (!insights) loadInsights().then((d) => { if (!cancelled) setInsights(d); }).catch((e) => { if (!cancelled) setError(e.message); });
    loadBriefs().then((d) => { if (!cancelled) setBriefs(d); }).catch((e) => { if (!cancelled) setError((s) => s ?? e.message); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focus = new URLSearchParams(window.location.search).get('card');

  const cards = useMemo(() => {
    if (!insights) return null;
    const { national, reachGap = [], hiddenChampions = [], revenue = null, specialization = [] } = insights;
    const c = national.completeness ?? {};
    const top = [...reachGap].sort((a, b) => b.unreachable - a.unreachable).slice(0, 8);
    const hidden = [...hiddenChampions].slice(0, 8);
    return { national, c, top, hidden, revenue, specialization };
  }, [insights]);

  if (error && !insights) return <p className="empty">Briefs could not be loaded — {error}. Nothing is shown rather than something substituted.</p>;
  if (!insights || !cards || !briefs) return <p className="empty">Loading shareable briefs…</p>;

  const { national, c, top, hidden, revenue, specialization } = cards;
  const source = briefs.source ?? insights.source;
  const builtAt = briefs.builtAt ?? insights.builtAt;
  const order = focus ? [focus, ...['snapshot', 'reach', 'domain', 'money', 'champions', 'province'].filter((x) => x !== focus)] : ['snapshot', 'reach', 'domain', 'money', 'champions', 'province'];
  const provBrief = briefs.provinces?.find((p) => p.code === prov) ?? null;
  const provFull = insights.byProvince?.find((p) => p.code === prov) ?? null;

  const renderCard = (id) => {
    switch (id) {
      case 'snapshot': {
        const b = briefs.cards.snapshot;
        return (
          <CardShell id="snapshot" q="How big is the registry?" title="National snapshot" th="ภาพรวมประเทศ"
            big={`${n(national.records)} producers`} sub={`${national.corroboratedShare}% corroborated · ${n(briefs.national.duplicatesCollapsed)} duplicates collapsed`}
            lines={[b.soWhat, b.nowWhat]} source={source} builtAt={builtAt}>
            <div className="bf-gauges">
              {[['Reachable', `${c.withContact}%`, 'ติดต่อได้'], ['OPC-graded', `${c.withStars}%`, 'ได้ระดับดาว'], ['Category declared', `${c.categoryDeclared}%`, 'ระบุประเภทเอง'], ['Subdistrict placed', `${c.withSubdistrict}%`, 'ระบุถึงตำบล']].map(([l, v, th]) => (
                <div key={l} className="bf-gauge"><span className="bf-gauge-n">{v}</span><span className="bf-gauge-l">{l}</span><span className="bf-gauge-th" lang="th">{th}</span></div>
              ))}
            </div>
          </CardShell>
        );
      }
      case 'reach': {
        const b = briefs.cards.reach;
        return (
          <CardShell id="reach" q="Who can be contacted?" title="Reach gap" th="ช่องว่างการติดต่อ"
            big={b.headline} sub="Bars are producers no one can telephone — the contact-drive list."
            lines={[b.soWhat, b.nowWhat]} source={source} builtAt={builtAt}>
            <Bars label="Most unreachable producers by province" onSelect={go} format={n}
              rows={top.map((p) => ({ code: p.code, label: p.th, sub: `${n(p.reachable)} reachable`, value: p.unreachable }))} />
          </CardShell>
        );
      }
      case 'domain': {
        const b = briefs.cards.domain;
        return (
          <CardShell id="domain" q="What is made?" title="Product domain" th="ประเภทผลิตภัณฑ์"
            big={b.headline} sub="Ground is unclassified — the filing gap, not the making gap."
            lines={[b.soWhat, b.nowWhat]} source={source} builtAt={builtAt}>
            <Composition parts={categoryParts(national)} total={national.records} />
            {specialization.length > 0 && (
              <p className="t-note">Call first: {specialization.slice(0, 3).map((s) => `${s.en} → ${s.leaders[0]?.th} (${n(s.leaders[0]?.count)})`).join(' · ')}.</p>
            )}
          </CardShell>
        );
      }
      case 'money': {
        const b = briefs.cards.money;
        const annual = revenue ? Object.entries(revenue.nationalAnnual).sort(([a], [b]) => b - a) : [];
        return (
          <CardShell id="money" q="Where does the money move?" title="Money" th="เงิน"
            big={b.headline} sub="Money and names are different datasets — never divide one by the other."
            lines={[b.soWhat, b.nowWhat]} source={source} builtAt={builtAt}>
            {annual.length > 0 && (
              <Bars label="Annual national OTOP sales" format={bnBaht}
                rows={annual.map(([y, a]) => ({ label: `${Number(y) + 543} BE${a.months < 12 ? ` (${a.months}m)` : ''}`, value: a.total }))} />
            )}
            {revenue?.top10 && (
              <p className="t-note">Top {revenue.latestFullYear + 543} BE: {revenue.top10.slice(0, 3).map((p) => `${p.th} ${bnBaht(p.total)}`).join(' · ')}.</p>
            )}
          </CardShell>
        );
      }
      case 'champions': {
        const b = briefs.cards.champions;
        return (
          <CardShell id="champions" q="Who did the state certify but lose?" title="Hidden champions" th="แชมป์ที่ซ่อนอยู่"
            big={b.headline} sub="4–5★, corroborated by ≥2 agencies, no phone. Certified names, not cold calls."
            lines={[b.soWhat, b.nowWhat]} source={source} builtAt={builtAt}>
            {hidden.length > 0 && (
              <Bars label="Hidden champions by province" onSelect={go} format={n}
                rows={hidden.map((p) => ({ code: p.code, label: p.th, sub: `${p.highStars} 4–5★ total`, value: p.hiddenChampions }))} />
            )}
          </CardShell>
        );
      }
      case 'province': {
        const list = briefs.provinces ?? [];
        return (
          <CardShell id="province" q="What does one province look like?" title="Province one-pager" th="หนึ่งจังหวัดหนึ่งหน้า"
            big={provBrief ? `${provBrief.th} · ${provBrief.en}` : 'Pick a province'}
            sub={provBrief ? `${n(provBrief.records)} records · ${provBrief.reachablePct}% reachable · ${n(provBrief.graded)} graded · ${n(provBrief.hiddenChampions)} hidden champions` : `${list.length} provinces, each a hand-across-the-table link.`}
            lines={provBrief ? [provBrief.topCategory ? `Leads in ${provBrief.topCategory.en} (${n(provBrief.topCategory.count)}).` : 'No classified lead category.', provBrief.action] : ['Choose a province — the one-pager prints its ranks, its lead category, and its one action.', 'Every row links to the full dossier.']}
            source={source} builtAt={builtAt} cardParam={prov ? `&prov=${prov}` : ''}>
            <div className="bf-prov-picker">
              <select aria-label="Province for one-pager" value={prov ?? ''} onChange={(e) => {
                const v = Number(e.target.value) || null;
                setProv(v);
                const p = new URLSearchParams(window.location.search);
                p.set('view', 'briefs'); p.set('card', 'province');
                if (v) p.set('prov', String(v)); else p.delete('prov');
                window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
              }}>
                <option value="">— choose —</option>
                {list.map((p) => <option key={p.code} value={p.code}>{p.th} · {p.en} ({n(p.records)})</option>)}
              </select>
              {provFull && <button type="button" className="reset" onClick={() => go(prov)}>Open full dossier →</button>}
            </div>
            {provFull && <Composition parts={categoryParts(provFull)} total={provFull.records} />}
          </CardShell>
        );
      }
      default: return null;
    }
  };

  return (
    <div className="bf-wrap">
      <p className="t-note bf-lede">
        Six cards, each one forwardable: a big number, its chart, what it means, what to do.
        Copy the link, download the SVG/PNG, or print — the image carries its source and build date.
      </p>
      <div className="bf-grid">{order.map((id) => <div key={id}>{renderCard(id)}</div>)}</div>
    </div>
  );
}
