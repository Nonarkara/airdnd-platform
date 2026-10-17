import { useEffect, useMemo, useState } from 'react';
import PageBanner from './PageBanner';
import { Link } from 'react-router-dom';
import { buildPublicWorks } from '../lib/publicWorks';
import './PublicWorks.css';
import './Analytics.css'; // Reuse analytics CSS for layout

export default function PublicWorks({ listings = [], dataState = {} }) {
  const [area, setArea] = useState('all');
  const [search, setSearch] = useState('');
  const [recentOnly, setRecentOnly] = useState(false);
  const analysis = useMemo(() => buildPublicWorks(listings), [listings]);
  const visible = analysis.rows.filter((row) =>
    (area === 'all' || row.area === area)
    && (!recentOnly || row.recent)
    && [row.listing.name, row.listing.location, row.listing.sourceChannel].join(' ').toLowerCase().includes(search.toLowerCase().trim())
  ).sort((a, b) => (b.posted || 0) - (a.posted || 0));
  const date = (value) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }) + ' ICT' : 'Not recorded';
  const [infrastructure, setInfrastructure] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/infrastructure.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setInfrastructure(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="an-page pw-page">
      <header className="an-header">
        <div className="an-header-meta">
          <Link to="/">← Directory</Link><span>Public Works · Location evidence</span>
        </div>
      </header>

      <PageBanner image="/heroes/methodology.jpg" tone="dark" compact className="an-hero-banner" ariaLabelledBy="pw-title">
        <h1 id="pw-title">Where the community places its venues</h1>
        <p>
          Explore the areas named in collected listings, inspect their source evidence, and see where location verification is still missing.
        </p>
      </PageBanner>

      <section className="pw-summary" aria-label="Dataset coverage">
        <p><strong>{listings.length}</strong> directory venues · {analysis.resolved} matched to a named area · {analysis.located} with stored coordinates · {analysis.recent} posted in the last 7 days</p>
        <p>Source: {dataState.sourceLabel || dataState.source || 'Loading'} · Tier: {['firestore', 'supabase'].includes(dataState.source) ? 'database records, not independently verified' : 'fallback snapshot'}.</p>
        <p>Latest source post: {date(analysis.latest)}. Retrieved: {date(dataState.lastLoadedAt)}.</p>
        {dataState.warning && <p role="status">Live source unavailable or delayed. The directory fallback is being used where needed.</p>}
      </section>
      {dataState.isLoading && <p role="status">Loading the directory’s location evidence…</p>}
      {!dataState.isLoading && listings.length === 0 && <p role="status">No directory records are available. Try the directory refresh; no area totals can be computed yet.</p>}
      <section className="pw-section" aria-labelledby="pw-areas">
        <h2 id="pw-areas">Where listings concentrate</h2>
        <p>Named areas are matched from listing location text. These are counts in this directory, not municipal districts, population density or a census of businesses. Select an area to inspect its venues below.</p>
        <div className="pw-scroll"><table>
          <caption>Area evidence · {listings.length} directory records</caption>
          <thead><tr><th scope="col">Named area</th><th scope="col">Venues</th><th scope="col">Posted within 7 days</th><th scope="col">Stored coordinates</th></tr></thead>
          <tbody>{analysis.areas.map((group) => <tr key={group.area}>
            <th scope="row"><button type="button" aria-pressed={area === group.area} onClick={() => setArea(area === group.area ? 'all' : group.area)}>{group.area}</button></th>
            <td>{group.count}</td><td>{group.recent}</td><td>{group.coordinates} / {group.count}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section className="pw-section" aria-labelledby="pw-evidence">
        <h2 id="pw-evidence">Inspect the venue evidence</h2>
        <div className="pw-controls">
          <label>Search venues, locations or channels<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Named area<select value={area} onChange={(event) => setArea(event.target.value)}><option value="all">All areas</option>{analysis.areas.map((group) => <option key={group.area}>{group.area}</option>)}</select></label>
          <label className="pw-check"><input type="checkbox" checked={recentOnly} onChange={(event) => setRecentOnly(event.target.checked)} /> Posted within 7 days</label>
          <button type="button" onClick={() => { setArea('all'); setSearch(''); setRecentOnly(false); }}>Reset filters</button>
        </div>
        <p role="status">{visible.length} of {listings.length} venues shown.</p>
        <div className="pw-scroll"><table>
          <caption>Source locations and reference transit proximity</caption>
          <thead><tr><th scope="col">Venue / source</th><th scope="col">Reported location</th><th scope="col">Location evidence</th><th scope="col">Latest source post</th></tr></thead>
          <tbody>{visible.map(({ listing, coords, transit, posted }) => <tr key={listing.id}>
            <th scope="row"><Link to={`/?listing=${encodeURIComponent(listing.id)}`}>{listing.name}</Link><small>{listing.sourceChannel || 'Channel not recorded'}</small></th>
            <td>{listing.location || 'Not recorded'}</td>
            <td>{coords ? <>{coords.join(', ')}<small>{transit ? `${transit.name}: ${transit.km.toFixed(1)} km straight-line (reference)` : 'No transit comparison'}</small></> : listing.mapsUrl ? 'Maps link recorded; coordinates not extracted' : 'Text only; location needs verification'}</td>
            <td>{date(posted)}</td>
          </tr>)}</tbody>
        </table></div>
        {visible.length === 0 && !dataState.isLoading && <p>No venues match these filters. Reset filters to restore the directory.</p>}
      </section>
      <section className="pw-section">
        <h2>What this evidence can support</h2>
        <p>Use the area counts to choose where to verify locations or investigate coverage. A recent source post is evidence of posting activity, not confirmation that a venue is open.</p>
        <p>{analysis.located === 0 ? 'No stored venue coordinates are available in this dataset, so station distances are not calculated.' : 'Distances use stored venue coordinates and the app’s curated, incomplete station reference. They are not walking routes or proof of the nearest station on the whole network.'} Area-centre estimates are excluded.</p>
        <p>No official zoning boundaries are connected. This page cannot establish land use, licences or zoning compliance.</p>
      </section>
      {infrastructure && (
        <details className="pw-reference"><summary>Legacy infrastructure reference · illustrative, excluded from analysis</summary>
        <p>The original page used simulated infrastructure data. These retained examples are not official zoning evidence and do not contribute to the counts above.</p>
        <div className="an-grid">
          <section className="an-card an-wide">
            <h2>Transit Corridors (BTS/MRT)</h2>
            <p className="an-card-sub">
              Selected station names from the original illustrative reference. This is not a complete network.
            </p>
            <div className="an-table">
              <div className="an-table-head">
                <span>Line</span>
                <span>Stations Mapped</span>
              </div>
              {infrastructure.transitCorridors.map((corridor) => (
                <div key={corridor.line} className="an-table-row">
                  <span style={{ fontWeight: 'bold' }}>{corridor.line}</span>
                  <span>{corridor.stations.map(s => s.name).join(', ')}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="an-card an-wide">
            <h2>Municipal Zoning Districts</h2>
            <p className="an-card-sub">
              Illustrative labels only. No verified municipal boundary or parcel-level zoning source is attached.
            </p>
            <div className="an-table">
              <div className="an-table-head">
                <span>District / Area</span>
                <span>Zone Type</span>
                <span>Code</span>
              </div>
              {infrastructure.zoningDistricts.map((zone) => (
                <div key={zone.name} className="an-table-row">
                  <span>{zone.name}</span>
                  <span>{zone.type}</span>
                  <strong style={{ color: 'var(--color-data)' }}>{zone.code}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
        </details>
      )}
    </div>
  );
}
