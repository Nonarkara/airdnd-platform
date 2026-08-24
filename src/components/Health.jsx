import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  buildHealthMatrix,
  buildServiceMatrix,
  loadHealthResearchBundle,
} from '../lib/health';
import { useLanguage } from '../context/LanguageContext';
import PageBanner from './PageBanner';
import './Health.css';

function formatBaht(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `฿${Math.round(Number(n)).toLocaleString()}`;
}

function Health({ listings = [] }) {
  const { t } = useLanguage();
  const page = t.pages?.health || {};
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState(null);
  const [lens, setLens] = useState('public');

  useEffect(() => {
    let cancelled = false;
    loadHealthResearchBundle()
      .then((payload) => { if (!cancelled) setBundle(payload); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load'); });
    return () => { cancelled = true; };
  }, []);

  const matrix = useMemo(
    () => (bundle?.hiv
      ? buildHealthMatrix(bundle.hiv, listings, bundle.formalization, bundle.therapeutic)
      : null),
    [bundle, listings],
  );

  const services = useMemo(
    () => (bundle?.services ? buildServiceMatrix(bundle.services, listings) : null),
    [bundle, listings],
  );

  const sti = bundle?.sti || null;
  const maxStiBar = useMemo(() => {
    if (!sti?.series?.length) return 1;
    return Math.max(
      ...sti.series.flatMap((row) => [
        row.msm,
        row.transgenderWomen,
        row.sexWorkerTotal,
      ]),
      1,
    );
  }, [sti]);

  return (
    <div className="health-page">
      <PageBanner image="/heroes/health.jpg" tone="dark" compact ariaLabelledBy="health-title">
        <p className="health-eyebrow">{page.kicker || '01 — Concurrent research'}</p>
        <h1 id="health-title">{page.title || 'HIV, STI & legitimacy beside the inventory'}</h1>
        <p className="health-lead">
          {page.lead || 'Open government case data, BE 2568 service-delivery returns, certified-provider registries, and excise tax on licensed bath & massage — read next to parlour broadcast density from our Telegram pipeline. Five lenses. One map. No stigma theatre — geography for harm reduction.'}
        </p>
        <div className="health-links">
          <a href="https://data.go.th/dataset/s_tuc_sent2" target="_blank" rel="noreferrer">s_tuc_sent2 · Lab results 2568</a>
          <a href="https://opendata.ddc.moph.go.th/dataset/gdpublish-das-01" target="_blank" rel="noreferrer">das-01 · CSO register</a>
          <a href="https://data.go.th/dataset/sasuk01" target="_blank" rel="noreferrer">sasuk01 · STI screening</a>
          <a href="https://data.go.th/dataset/03_1201" target="_blank" rel="noreferrer">03_1201 · Excise</a>
          <a href="https://data.go.th/dataset/hss_11_49" target="_blank" rel="noreferrer">hss_11_49 · Certified</a>
          <a href="https://hivhub.ddc.moph.go.th/" target="_blank" rel="noreferrer">HIVhub · DDC</a>
          <Link to="/map">Open map · Epidemic layer</Link>
          <Link to="/methodology">Methodology · Four tiers</Link>
        </div>
      </PageBanner>

      <nav className="health-lenses" aria-label="Research lenses">
        {[
          { id: 'public', label: 'Public epidemic' },
          { id: 'services', label: 'Services · BE 2568' },
          { id: 'parlour', label: 'Parlour corridor' },
          { id: 'legitimacy', label: 'Legitimacy' },
          { id: 'worker', label: 'Worker side' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={lens === item.id ? 'is-on' : ''}
            onClick={() => setLens(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <p className="health-error">{error}</p>}
      {!matrix && !error && <p className="health-loading">Loading provincial case matrix…</p>}

      {matrix && (
        <>
          <section className="health-stats" aria-label="Snapshot">
            <div>
              <span>National new-in-care</span>
              <strong className="mono">{matrix.nationalTotal.toLocaleString()}</strong>
              <em>Buddhist 2566 / {matrix.year}</em>
            </div>
            <div>
              <span>HSS certified นวด สปา</span>
              <strong className="mono">{(matrix.hssNational || 0).toLocaleString()}</strong>
              <em>registry · not Telegram</em>
            </div>
            <div>
              <span>Excise (latest year)</span>
              <strong className="mono">{formatBaht(matrix.excise?.latest?.taxNetBaht)}</strong>
              <em>BE {matrix.excise?.latest?.yearBuddhist || '—'}</em>
            </div>
            <div>
              <span>Roi Et SW screened</span>
              <strong className="mono">{(sti?.latest?.sexWorkerTotal || 0).toLocaleString()}</strong>
              <em>BE {sti?.latest?.yearBuddhist || '—'} · uptake only</em>
            </div>
          </section>

          <section className="health-copy">
            {lens === 'services' && (services ? (
              <>
                <h2>Where the service actually is — BE 2568 / 2025</h2>
                <p>
                  The case series above counts people entering care in BE 2566. It cannot tell you
                  where to send someone this afternoon. This layer is the service side, two years
                  newer: {services.totals.tested.toLocaleString()} people had an Anti-HIV test
                  recorded across {services.meta.provincesReporting} provinces,
                  {' '}{services.totals.positive.toLocaleString()} were positive
                  ({services.totals.nationalPositivityPer1k} per 1,000 tested), and
                  {' '}{services.totals.totalOrgs} registered civil-society organisations work on HIV
                  across {services.totals.provincesWithOrgs} provinces.
                </p>
                <p className="health-caveat">
                  Read the counts as reporting, not as a census. A facility that filed no return for
                  BE 2568 is invisible here — a low number means thin reporting or thin service,
                  never absence of need. Positivity is testing yield among recorded results: it is
                  not prevalence, and it says nothing about any venue or any worker.
                </p>

                <h3>Testing volume · top provinces</h3>
                <table className="health-table">
                  <thead>
                    <tr>
                      <th>Province</th><th>Tested</th><th>Positive</th>
                      <th>Per 1,000</th><th>Sites</th><th>Venues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.topTesting.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.tested.toLocaleString()}</td>
                        <td className="mono">{row.positive.toLocaleString()}</td>
                        <td className="mono">{row.positivityPer1k ?? '—'}</td>
                        <td className="mono">{row.services?.lab?.facilities ?? '—'}</td>
                        <td className="mono">{row.venueCount || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Outreach priority · venues per 1,000 tested</h3>
                <p>
                  Advertised venue activity measured against testing effort in the same province.
                  A high ratio means the venue population is large relative to how much testing the
                  province recorded — a prompt to look, not a finding.
                </p>
                <table className="health-table">
                  <thead>
                    <tr><th>Province</th><th>Venues</th><th>Tested</th><th>Venues / 1k tested</th></tr>
                  </thead>
                  <tbody>
                    {services.coverageGap.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.tested.toLocaleString()}</td>
                        <td className="mono">{row.venuesPer1kTested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Referral directory · registered organisations</h3>
                <p>
                  From the Department of Disease Control register of volunteers and civil-society
                  organisations working on HIV (BE 2568). &ldquo;Current&rdquo; counts registrations
                  whose certificate has not expired. These are the people to call.
                </p>
                <table className="health-table">
                  <thead>
                    <tr><th>Province</th><th>Organisations</th><th>Current regs</th><th>Named</th></tr>
                  </thead>
                  <tbody>
                    {services.referralDirectory.slice(0, 14).map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.orgs}</td>
                        <td className="mono">{row.currentCerts}</td>
                        <td>{row.civilSociety.orgs.slice(0, 3).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {services.referralGaps.length > 0 && (
                  <>
                    <h3>Referral gaps</h3>
                    <p>
                      Provinces carrying advertised venues with no registered civil-society
                      organisation and no voluntary-testing return for BE 2568:
                      {' '}<strong>{services.referralGaps.map((p) => p.name).join(', ')}</strong>.
                      Advertised supply with no visible service hook is where a referral chain has
                      to be built rather than used.
                    </p>
                  </>
                )}

                <p className="health-caveat">
                  Sources — {Object.values(services.meta.sources).map((s) => s.id).join(', ')}.
                  {' '}Built {new Date(services.meta.builtAt).toISOString().slice(0, 10)}.
                </p>
                <div className="health-links">
                  {Object.values(services.meta.sources).map((s) => (
                    <a key={s.id} href={s.page} target="_blank" rel="noreferrer">{s.id} · {s.label}</a>
                  ))}
                </div>
              </>
            ) : (
              <p className="health-caveat">
                Service dataset not built yet — run <code>node scripts/build_hiv_services.js</code>.
              </p>
            ))}

            {lens === 'public' && (
              <>
                <h2>Public epidemic</h2>
                <p>{matrix.lenses.public}</p>
                <p className="health-caveat">{matrix.meta.caveat || matrix.meta.note}</p>
                <table className="health-table">
                  <thead>
                    <tr><th>Province</th><th>New-in-care 2566</th></tr>
                  </thead>
                  <tbody>
                    {matrix.topCases.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.newCases2566.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {lens === 'parlour' && (
              <>
                <h2>Parlour corridor</h2>
                <p>{matrix.lenses.parlour}</p>
                <p>
                  Co-location is not a guilt score for a shop. It marks provinces where
                  outreach, testing referral, and operator education are worth coordinating
                  because both venue signal and case load are present.
                </p>
                <table className="health-table">
                  <thead>
                    <tr>
                      <th>Province</th>
                      <th>Venues</th>
                      <th>HSS</th>
                      <th>Cases 2566</th>
                      <th>Co-locate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rankedCorridors.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.certifiedProviders.toLocaleString()}</td>
                        <td className="mono">{row.newCases2566.toLocaleString()}</td>
                        <td className="mono">{row.colocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {lens === 'legitimacy' && (
              <>
                <h2>Legitimacy · formalization gap</h2>
                <p>{matrix.lenses.legitimacy}</p>
                <p className="health-caveat">
                  {matrix.formalizationMeta?.caveat
                    || 'Not a legality verdict for any shop, worker, or listing.'}
                </p>
                <p>
                  Cross-read with the four regulatory tiers in{' '}
                  <Link to="/methodology">Methodology §09</Link>
                  {' '}(อาบอบนวด · สปา · นวดแผนไทย · ไซด์ไลน์). Excise and HSS sit closest to
                  the licensed end; Telegram inventory spans the continuum.
                </p>

                {matrix.excise?.series?.length > 0 && (
                  <div className="health-chart" aria-label="Excise tax by year">
                    <h3>Excise tax · bath / massage sector</h3>
                    <ul className="health-bars">
                      {matrix.excise.series.map((row) => {
                        const max = Math.max(...matrix.excise.series.map((s) => s.taxNetBaht), 1);
                        const pct = Math.round((row.taxNetBaht / max) * 100);
                        return (
                          <li key={row.yearBuddhist}>
                            <span className="mono">{row.yearBuddhist}</span>
                            <span className="health-bar-track" aria-hidden>
                              <i style={{ width: `${pct}%` }} />
                            </span>
                            <em className="mono">{formatBaht(row.taxNetBaht)}</em>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {matrix.therapeuticMeta && (
                  <p className="health-caveat">
                    MoPH therapeutic massage (TTAMC {matrix.therapeuticMeta.year}):{' '}
                    {matrix.therapeuticMeta.nationalTotal.toLocaleString()} clinic visits
                    in reporting provinces — public traditional-medicine volume, not Telegram
                    parlours.
                  </p>
                )}

                <h3 className="health-subhead">Grey-heavy · inventory high, registry thin</h3>
                <p>
                  Higher formalization-gap index means more broadcast venues relative to
                  certified นวด สปา providers. Research signal for outreach — not a shop blacklist.
                </p>
                <table className="health-table">
                  <thead>
                    <tr>
                      <th>Province</th>
                      <th>Venues</th>
                      <th>HSS certified</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.greyHeavy.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.certifiedProviders.toLocaleString()}</td>
                        <td className="mono">{row.formalizationGap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3 className="health-subhead">Registered corridors · both signals high</h3>
                <table className="health-table">
                  <thead>
                    <tr>
                      <th>Province</th>
                      <th>Venues</th>
                      <th>HSS certified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.registeredCorridors.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.certifiedProviders.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {lens === 'worker' && (
              <>
                <h2>Worker side · competing readings</h2>
                <p>{matrix.lenses.worker}</p>

                <div className="health-hypotheses">
                  <article>
                    <h3>01 · Vulnerability</h3>
                    <p>
                      Informal tiers (นวดแผนไทย / ไซด์ไลน์) often lack mandatory VD certificates
                      and district registration. No paper trail raises trafficking and health
                      exposure — see Methodology §09.
                    </p>
                  </article>
                  <article>
                    <h3>02 · Professional protection</h3>
                    <p>
                      Workers have economic incentive not to die. Thailand&apos;s 100% Condom
                      Program worked through licensed อาบอบนวด. Sex workers appear in STI
                      screening programs (Roi Et below) — that is uptake, not proof of lower
                      incidence.
                    </p>
                  </article>
                  <article>
                    <h3>03 · Client recklessness</h3>
                    <p>
                      Open data here does not give client STI incidence. Male demand often sits
                      outside workplace health systems. Hypothesis only: carelessness and low
                      awareness on the client side may drive risk as much as worker-side
                      exposure. Point clients to DDC / Red Cross anonymous testing.
                    </p>
                  </article>
                </div>

                {sti && (
                  <div className="health-chart" aria-label="Roi Et STI screening">
                    <h3>Roi Et · key-pop STI screening (sasuk01)</h3>
                    <p className="health-caveat">
                      {sti.source.scope}. {sti.source.note} Screening volume ≠ prevalence.
                    </p>
                    <ul className="health-bars health-bars--multi">
                      {sti.series.map((row) => (
                        <li key={row.yearBuddhist} className="health-bars-year">
                          <span className="mono">{row.yearBuddhist}</span>
                          <div className="health-bars-stack">
                            {[
                              { key: 'msm', label: 'MSM', value: row.msm },
                              { key: 'tg', label: 'TG women', value: row.transgenderWomen },
                              { key: 'sw', label: 'Sex workers', value: row.sexWorkerTotal },
                            ].map((bar) => (
                              <div key={bar.key} className="health-bars-row">
                                <span>{bar.label}</span>
                                <span className="health-bar-track" aria-hidden>
                                  <i style={{ width: `${Math.round((bar.value / maxStiBar) * 100)}%` }} />
                                </span>
                                <em className="mono">{bar.value.toLocaleString()}</em>
                              </div>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <ul className="health-bullets">
                  <li>Concentrate anonymous testing / PrEP where venue density and case load both rise.</li>
                  <li>Never reverse-identify a person from inventory ads, photos, or phone numbers.</li>
                  <li>Do not claim sex workers are “safer” or “more at risk” than clients from these CSVs alone.</li>
                  <li>HIVhub remains the operational dashboard for officers; this page is a public co-reading layer only.</li>
                </ul>

                <h3 className="health-subhead">Harm-reduction priority · HIV × grey-heavy</h3>
                <table className="health-table">
                  <thead>
                    <tr>
                      <th>Province</th>
                      <th>Venues</th>
                      <th>HSS</th>
                      <th>Cases</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.harmReductionPriority.map((row) => (
                      <tr key={row.code}>
                        <td>{row.name}</td>
                        <td className="mono">{row.venueCount}</td>
                        <td className="mono">{row.certifiedProviders.toLocaleString()}</td>
                        <td className="mono">{row.newCases2566.toLocaleString()}</td>
                        <td className="mono">{row.formalizationGap}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>

          <footer className="health-foot">
            Sources: {matrix.meta.national} · hss_11_49 · 03_1201 · sasuk01 · ttamc_op_12_02 · hivhub.ddc.moph.go.th
          </footer>
        </>
      )}
    </div>
  );
}

export default Health;
