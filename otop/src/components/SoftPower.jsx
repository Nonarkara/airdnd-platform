/**
 * Soft Power Monitor — Thailand's soft power, measured on the supply side.
 *
 * The argument: soft power is usually measured abroad, by polling people who
 * have seen a Thai film or eaten a Thai dish. Its supply side — who makes
 * it, where it goes, what the state has certified — is measured here, and
 * the measures are public. Each instrument on this page states what it
 * measures AND what it does not measure, because a number without its scope
 * is a claim.
 *
 * OTOP is one of these instruments, and the most detailed one: 154,050
 * registered producers, placed at tambon, with a phone number or a website
 * in 5.7% of filings. The rest are the other registers on the same portal:
 * the export tables, the handicraft report, the local Thai food inventory,
 * the national film heritage list, the fisheries trade series, the outbound
 * labour register.
 *
 * The composition follows the house move: horizontal data rows, no card
 * grid, one focal point per page. Every number is read from
 * public/soft_power.json, which is built from the raw cache by
 * scripts/otop/softpower.js — never typed by hand.
 */

import { useEffect, useState } from 'react';
import { Bi } from './Bi.jsx';

const LAYER_ORDER = ['supply', 'conveyance', 'recognition'];

function num(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('en-US');
}

function ToolBlock({ tool }) {
  const indicators = tool.indicators ?? [];
  return (
    <article className="sp-tool" data-layer={tool.layer}>
      <header className="sp-tool-h">
        <div className="sp-tool-id">
          <span className="sp-tag">{tool.layer}</span>
          <h3 className="sp-tool-name">
            {tool.en}
            <span className="sp-tool-th" lang="th">{tool.th}</span>
          </h3>
        </div>

        <div className="sp-tool-envelope">
          <p className="sp-measures">
            <Bi en={tool.measuresEn} th={tool.measuresTh} />
          </p>
          <p className="sp-not">
            <span className="sp-not-k">Does not measure</span>
            <span className="sp-not-v">{tool.notEn}</span>
            <span className="sp-not-th" lang="th">{tool.notTh}</span>
          </p>
        </div>
      </header>

      {/* The numbers, as a register: the measure on the left, the value in
          its own column, the scope on the right. A row per indicator, so
          the count of indicators never decides a column count and the last
          row is never left with an empty cell beside it. */}
      <div className="sp-nums">
        {indicators.map((i) => (
          <div className="sp-num" key={i.id}>
            <span className="sp-num-k">
              {i.en}
              <span className="sp-num-th" lang="th">{i.th}</span>
            </span>
            <span className="sp-num-v">
              {num(i.value)}
              <small>{i.unitEn}</small>
            </span>
            <span className="sp-num-s">
              {i.scopeEn}
              <span className="sp-num-sth" lang="th">{i.scopeTh}</span>
            </span>
          </div>
        ))}
      </div>

      {tool.series?.length ? (
        <div className="sp-series">
          <h4 className="sp-series-h">
            <Bi en={tool.seriesLabelEn} th={tool.seriesLabelTh} />
          </h4>
          <dl className="sp-series-list">
            {tool.series.map((s) => (
              <div key={s.label}>
                <dt>{s.label}</dt>
                <dd>{num(s.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <p className="sp-src">
        <span className="sp-src-k">Source</span>
        <span className="sp-src-d">{tool.source?.dataset}</span>
        <span className="sp-src-o">{tool.source?.org}</span>
        {tool.source?.rows ? <span className="sp-src-r">{num(tool.source.rows)} rows</span> : null}
        {tool.source?.retrieved ? <span className="sp-src-d">retrieved {String(tool.source.retrieved).slice(0, 10)}</span> : null}
        {tool.source?.url ? <a href={tool.source.url} target="_blank" rel="noreferrer">dataset ↗</a> : null}
        {tool.route ? <a href={tool.route}>open the instrument →</a> : null}
        {tool.note ? <span className="sp-src-n">{tool.note}</span> : null}
      </p>
    </article>
  );
}

export default function SoftPower() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL ?? '/'}soft_power.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="empty">Could not load the soft-power registers — {error}.</p>;
  if (!data) return <p className="empty">Loading the soft-power instruments…</p>;

  const tools = data.tools ?? [];
  const layers = (data.layers ?? []).slice().sort(
    (a, b) => LAYER_ORDER.indexOf(a.id) - LAYER_ORDER.indexOf(b.id),
  );

  return (
    <div className="sp">
      {/* The frame. Three columns, one flow: the argument in English, the
          same argument in Thai, and how to read the instruments. */}
      <div className="sp-frame">
        <p className="sp-frame-p"><Bi en={data.frame.en} th={data.frame.th} /></p>
        <p className="sp-frame-p sp-frame-how">
          <Bi
            en="Every instrument states its scope. A number without a scope is a claim, not a measurement: these are counts of filings, of trade lines and of registrations — not of people, of sales, or of affection."
            th="ทุกเครื่องมือระบุขอบเขตของตัวเอง ตัวเลขที่ไม่มีขอบเขตคือข้ออ้าง ไม่ใช่การวัด เหล่านี้คือจำนวนรายการยื่น รายการค้า และรายการลงทะเบียน ไม่ใช่จำนวนคน ยอดขาย หรือความรัก"
          />
        </p>
      </div>

      {layers.map((layer) => {
        const inLayer = tools.filter((t) => t.layer === layer.id);
        if (!inLayer.length) return null;
        return (
          <section className="sp-layer" key={layer.id} data-layer={layer.id}>
            <header className="sp-layer-h">
              <h2 className="sp-layer-name">
                {layer.en}
                <span lang="th">{layer.th}</span>
              </h2>
              <p className="sp-layer-note">
                <Bi en={layer.noteEn} th={layer.noteTh} />
              </p>
            </header>
            {inLayer.map((t) => <ToolBlock key={t.id} tool={t} />)}
          </section>
        );
      })}
    </div>
  );
}
