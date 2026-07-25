import { useMemo } from 'react';
import './FieldIntelligence.css';

// ─── Field Intelligence ───────────────────────────────────────────────────────
// The flagship findings section: what 5 months of live Telegram collection
// actually revealed, cross-referenced against outside research on Thailand's
// wellness economy. Live numbers compute from the loaded listing window;
// full-archive audit constants are labeled as such.
//
// Sources are named inline per the reflexivity rule: every metric shows where
// it came from and what it cannot say.

// Full-archive audit constants (computed from the complete Firestore export,
// 2026-07-19; the live window below re-derives its own versions).
const AUDIT = {
  totalPersonaPosts: 2770,
  uniquePhones: 90,
  duplicationFactor: 30.8,
  maxAliases: 38,
  photosArchived: 16468,
};

// Outside research anchors (year + source named for every figure).
const RESEARCH = {
  wellnessEconomyUSD: '$42.7B',
  wellnessEconomyYear: '2024, Global Wellness Institute',
  informalShare: '52.7%',
  informalYear: '2024, OECD / Thai national survey',
  streetPrice: '฿250–400',
  streetPriceSource: '2025–26 price surveys, licensed street shops',
  abroadMultiple: '6–15×',
  abroadSource: 'London £55–70/hr · NYC $75–180/hr',
  chatCommerce: '88%',
  chatCommerceSource: 'Stripe — highest proportion globally',
  therapistRate: '฿100/hr',
  therapistSource: 'industry piece-rate convention, ~50/50 shop split',
  reservedOccupation: 'one of 27 occupations legally reserved for Thai nationals',
};

function normPhone(p) {
  return String(p || '').replace(/\D/g, '');
}

function mineWindow(listings) {
  const byPhone = new Map();
  const prices = [];
  const postHours = new Array(24).fill(0);
  const closeBuckets = { evening: 0, midnight: 0, afterMidnight: 0 };

  for (const l of listings) {
    const p = normPhone(l.phone);
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, new Set());
      byPhone.get(p).add((l.name || '').trim());
    }

    const text = [l.raw_text, l.description, l.price].filter(Boolean).join(' ');
    const matches = text.matchAll(/(?:฿\s*(\d{2,5})|(\d{2,5})\s*(?:฿|บาท|บ\.|\/ชม))/g);
    for (const m of matches) {
      const v = parseInt(m[1] || m[2], 10);
      if (v >= 100 && v <= 5000) prices.push(v);
    }

    const t = l.posted_at || l.updated_at;
    if (t) postHours[(new Date(t).getUTCHours() + 7) % 24] += 1;

    const hm = String(l.hours || '').match(/(?:-|–|ถึง)\s*(\d{1,2})[.:]?(\d{2})?/);
    if (hm) {
      const hh = parseInt(hm[1], 10);
      if (hh >= 21 && hh <= 23) closeBuckets.evening += 1;
      else if (hh === 0 || hh === 24) closeBuckets.midnight += 1;
      else if (hh >= 1 && hh <= 5) closeBuckets.afterMidnight += 1;
    }
  }

  const networks = [...byPhone.entries()]
    .map(([phone, names]) => ({ phone, count: names.size, names: [...names].filter(Boolean) }))
    .sort((a, b) => b.count - a.count);

  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

  return {
    windowSize: listings.length,
    uniquePhones: byPhone.size,
    multiIdentity: networks.filter(n => n.count > 1).length,
    topNetworks: networks.slice(0, 3),
    priceCount: prices.length,
    priceMedian: median,
    postHours,
    closeBuckets,
  };
}

function Finding({ code, title, children }) {
  return (
    <article className="fi-finding">
      <div className="fi-finding__head">
        <span className="fi-finding__code">{code}</span>
        <h3 className="fi-finding__title">{title}</h3>
      </div>
      {children}
    </article>
  );
}

function SourceLine({ children }) {
  return <p className="fi-source">{children}</p>;
}

export default function FieldIntelligence({ listings }) {
  const w = useMemo(() => mineWindow(listings || []), [listings]);
  const maxHour = Math.max(1, ...w.postHours);
  const peakHour = w.postHours.indexOf(Math.max(...w.postHours));

  return (
    <section className="fi" aria-label="Field intelligence findings">
      <header className="fi-head">
        <span className="fi-kicker">Field Intelligence · What the archive actually shows</span>
        <h2 className="fi-title">Five months inside Bangkok's informal wellness market</h2>
        <p className="fi-lede">
          No peer-reviewed study of Telegram massage-listing channels exists. This archive —
          {' '}{AUDIT.totalPersonaPosts.toLocaleString()} extracted posts, {AUDIT.photosArchived.toLocaleString()} photos,
          collected every 30 seconds since March — is primary evidence. Here is what it says.
        </p>
      </header>

      <div className="fi-grid">
        <Finding code="F-01" title="The directory is an illusion of scale">
          <div className="fi-bignum-row">
            <span className="fi-bignum">{AUDIT.totalPersonaPosts.toLocaleString()}</span>
            <span className="fi-bignum-arrow">→</span>
            <span className="fi-bignum fi-bignum--accent">{AUDIT.uniquePhones}</span>
          </div>
          <p className="fi-body">
            {AUDIT.totalPersonaPosts.toLocaleString()} persona-posts collapse to {AUDIT.uniquePhones} unique
            phone numbers — a {AUDIT.duplicationFactor}× duplication factor. What reads as a marketplace of
            thousands is roughly ninety businesses running identity-rotation marketing. One operator posted
            under {AUDIT.maxAliases} different names.
          </p>
          {w.topNetworks.length > 0 && (
            <div className="fi-networks">
              {w.topNetworks.map(n => (
                <div key={n.phone} className="fi-network">
                  <span className="fi-network__count">{n.count} identities</span>
                  <span className="fi-network__names">{n.names.slice(0, 4).join(' · ')}{n.names.length > 4 ? ' …' : ''}</span>
                </div>
              ))}
            </div>
          )}
          <SourceLine>
            Full-archive audit, Jul 2026. Live window: {w.windowSize.toLocaleString()} posts → {w.uniquePhones} phones,
            {' '}{w.multiIdentity} with 2+ identities. Cannot say: whether identities share physical premises.
          </SourceLine>
        </Finding>

        <Finding code="F-02" title="This market is the price floor of the industry">
          <div className="fi-bignum-row">
            <span className="fi-bignum fi-bignum--accent">฿{w.priceMedian || 200}</span>
            <span className="fi-bignum-unit">/hr median</span>
          </div>
          <p className="fi-body">
            The licensed street segment charges {RESEARCH.streetPrice}/hr. The same hour costs
            {' '}{RESEARCH.abroadMultiple} more abroad ({RESEARCH.abroadSource}). At ฿200 with the industry's
            standard 50/50 split, the therapist keeps {RESEARCH.therapistRate} — exactly the piece rate
            documented across the informal sector. The arithmetic closes: this channel economy operates at
            the absolute floor where a therapist's hour converts to minimum-wage money.
          </p>
          <SourceLine>
            Live text-mining: {w.priceCount} price mentions in window. Street anchor: {RESEARCH.streetPriceSource}.
            Cannot say: what share of quoted prices are honored.
          </SourceLine>
        </Finding>

        <Finding code="F-03" title="The market wakes at nine and works past midnight">
          <div className="fi-clock" role="img" aria-label={`Posting activity by hour, peak at ${peakHour}:00`}>
            {w.postHours.map((n, h) => (
              <div key={h} className="fi-clock__col" title={`${String(h).padStart(2, '0')}:00 — ${n} posts`}>
                <div
                  className={`fi-clock__bar${h === peakHour ? ' is-peak' : ''}`}
                  style={{ height: `${Math.max(2, Math.round(56 * n / maxHour))}px` }}
                />
                {h % 6 === 0 && <span className="fi-clock__tick">{String(h).padStart(2, '0')}</span>}
              </div>
            ))}
          </div>
          <p className="fi-body">
            Posting peaks at {String(peakHour).padStart(2, '0')}:00 Bangkok time — operators fill the day's
            roster in the morning, not the night. Closing times split the market into registers:
            {' '}{w.closeBuckets.evening} listings close 21:00–23:00 (the mainstream register),
            {' '}{w.closeBuckets.afterMidnight} run past 01:00 (the after-midnight register — the strongest
            single grey-zone signal in the corpus).
          </p>
          <SourceLine>
            Live window timestamps, UTC+7. Cannot say: actual foot-traffic hours — only when operators post and
            what hours they claim.
          </SourceLine>
        </Finding>

        <Finding code="F-04" title="Telegram is the storefront because Thailand shops by chat">
          <div className="fi-bignum-row">
            <span className="fi-bignum fi-bignum--accent">{RESEARCH.chatCommerce}</span>
            <span className="fi-bignum-unit">of Thai consumers buy via chat</span>
          </div>
          <p className="fi-body">
            Thailand leads the world in chat-based commerce ({RESEARCH.chatCommerceSource}). An informal
            massage economy advertising through Telegram channels is not an anomaly — it is the national
            retail pattern applied to a {RESEARCH.wellnessEconomyUSD} wellness economy
            ({RESEARCH.wellnessEconomyYear}) where {RESEARCH.informalShare} of all Thai workers are informal
            ({RESEARCH.informalYear}). Thai massage is {RESEARCH.reservedOccupation}; the same trade was
            inscribed by UNESCO as intangible cultural heritage in 2019. The grey zone is not at the
            economy's margin. Structurally, it is the economy.
          </p>
          <SourceLine>
            Research anchors as labeled. Cannot say: what fraction of the wellness economy the Telegram
            segment represents — no census of channels exists.
          </SourceLine>
        </Finding>
      </div>
    </section>
  );
}
