import { FORMATS, HOURS, LANGUAGES, SERVICE_LINES, categorizeListing, supportFor } from '../lib/taxonomy';
import { useHealthServices } from '../lib/useHealthServices';
import './ListingCategory.css';

/**
 * How this service is offered, and what support exists where it is.
 * Categories come from the listing's own words (src/lib/taxonomy.js); support
 * is the province's public disease-control service data.
 */
export default function ListingCategory({ listing }) {
  const services = useHealthServices();
  if (!listing) return null;
  const c = listing.category || categorizeListing(listing);
  const support = supportFor(listing, services);

  const chips = [
    `${FORMATS[c.format].en} · ${FORMATS[c.format].th}`,
    c.alsoOutcall && 'Also outcall · รับนอกสถานที่',
    `${SERVICE_LINES[c.serviceLine].en} · ${SERVICE_LINES[c.serviceLine].th}`,
    c.hours !== 'unstated' && `${HOURS[c.hours].en} · ${HOURS[c.hours].th}`,
    ...c.languages.filter((code) => code !== 'th').map((code) => `Ad in ${LANGUAGES[code]}`),
  ].filter(Boolean);

  const facts = support ? [
    ['Testing sites', 'จุดตรวจ', support.testingSites],
    ['STI clinics', 'คลินิกโรคติดต่อทางเพศ', support.stiClinics],
    ['Condom points', 'จุดแจกถุงยาง', support.condomPoints],
    ['Counselling', 'ให้คำปรึกษา', support.counselling],
  ] : [];

  return (
    <section className="listing-category" aria-label="Category and support">
      <span className="listing-category-eyebrow">Category · หมวด</span>
      <ul className="listing-category-chips">
        {chips.map((chip) => <li key={chip}>{chip}</li>)}
      </ul>

      {support && (
        <div className="listing-support">
          <span className="listing-category-eyebrow">
            Support in {support.province.th} · {support.province.en} — facilities that reported{support.year ? `, BE ${support.year}` : ''}
          </span>
          <dl className="listing-support-facts">
            {facts.map(([en, th, n]) => (
              <div key={en}>
                <dt>{en}<small>{th}</small></dt>
                <dd>{n == null ? <span className="listing-support-none">not reported</span> : n.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
          {support.organisations.length > 0 && (
            <p className="listing-support-orgs">
              <span>Community organisations · องค์กรชุมชน</span>
              {support.organisations.slice(0, 6).join(' · ')}
            </p>
          )}
          <p className="listing-support-note">
            Counts facilities that filed a report with the Department of Disease Control — not every place offering the
            service. A low number means under-reporting, not that help is absent.{' '}
            <a href="https://hivhub.ddc.moph.go.th/" target="_blank" rel="noreferrer">Find a service · HIVhub (DDC)</a>
          </p>
        </div>
      )}
    </section>
  );
}
