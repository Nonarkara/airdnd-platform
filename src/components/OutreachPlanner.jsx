import { useMemo, useState } from 'react';
import { AUDIENCES, OUTREACH, summarizeByDistrict, supportFor } from '../lib/taxonomy';
import { useHealthServices } from '../lib/useHealthServices';

const COLUMNS = ['hard-to-reach', 'late-night', 'other-language', 'adult-signals', 'new-staff'];

/**
 * District-level outreach planning for disease control and social workers.
 * Aggregated by design: it routes services to places, it does not profile
 * anyone. Every count comes from the listings' own public text.
 */
export default function OutreachPlanner({ listings = [] }) {
  const services = useHealthServices();
  const [audience, setAudience] = useState('ddc');
  const signals = AUDIENCES[audience].signals;

  const rows = useMemo(() => {
    const summary = summarizeByDistrict(listings);
    const weight = (row) => signals.reduce((sum, s) => sum + (row.outreach[s] || 0), 0);
    return summary
      .map((row) => ({ ...row, weight: weight(row) }))
      .sort((a, b) => (b.isDistrict - a.isDistrict) || (b.weight - a.weight) || (b.listings - a.listings));
  }, [listings, signals]);

  const orgsFor = (row) => (row.provinceCode
    ? supportFor({ geoUnit: { province: { code: row.provinceCode } } }, services)?.organisations || []
    : []);

  const districts = rows.filter((r) => r.isDistrict).length;

  return (
    <>
      <h2>Outreach planner · วางแผนลงพื้นที่</h2>
      <p>
        {listings.length} listings, grouped into {districts} districts by the place each listing names. Each column counts
        listings showing one signal in their own public text. Nothing here describes a person; it shows where services
        are needed, and in what form.
      </p>

      <div className="outreach-audiences" role="tablist" aria-label="Who is planning">
        {['ddc', 'social', 'people'].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={audience === id}
            className={audience === id ? 'is-on' : ''}
            onClick={() => setAudience(id)}
          >
            <strong>{AUDIENCES[id].en}</strong>
            <span>{AUDIENCES[id].th}</span>
          </button>
        ))}
      </div>
      <p className="outreach-lead">{AUDIENCES[audience].lead}</p>
      {audience === 'people' ? (
        <p className="outreach-lead">
          Use the directory's Category filter to find a service by how it is offered, and open any listing to see the
          testing sites, STI clinics, condom points and community organisations in its province.
        </p>
      ) : (
        <ul className="outreach-signals">
          {signals.map((s) => (
            <li key={s}><strong>{OUTREACH[s].en}</strong> · {OUTREACH[s].th} — {OUTREACH[s].why}</li>
          ))}
        </ul>
      )}

      <div className="outreach-table-wrap">
        <table className="health-table outreach-table">
          <thead>
            <tr>
              <th>District · เขต/อำเภอ</th>
              <th>Listings</th>
              {COLUMNS.map((c) => (
                <th key={c} className={signals?.includes(c) ? 'is-focus' : ''} title={OUTREACH[c].why}>
                  {OUTREACH[c].en}
                </th>
              ))}
              <th>Community organisations in province</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const orgs = orgsFor(row);
              return (
                <tr key={row.key} className={row.isDistrict ? '' : 'is-unplaced'}>
                  <td>
                    {row.th}
                    <small>{row.en}{row.isDistrict && row.provinceEn ? ` · ${row.provinceEn}` : ''}</small>
                  </td>
                  <td className="mono">{row.listings}</td>
                  {COLUMNS.map((c) => (
                    <td key={c} className={`mono${signals?.includes(c) ? ' is-focus' : ''}`}>{row.outreach[c] || '·'}</td>
                  ))}
                  <td className="outreach-orgs">{orgs.length ? orgs.slice(0, 4).join(' · ') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="health-caveat">
        Signals come from ad text and are sparse: most listings state no format, hours or language, and a blank is not a
        "no". Rows without a district are listings that name only a province — the "No stated place" signal, visible to no
        area-based programme. Community organisations and service counts: Department of Disease Control, province level.
      </p>
    </>
  );
}
