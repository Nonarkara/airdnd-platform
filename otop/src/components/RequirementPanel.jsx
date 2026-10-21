import { CATEGORY_LABEL, REGION_LABEL } from '../lib/labels.js';

/**
 * The requirement is a sourcing brief, not a filter bar.
 *
 * It round-trips through the URL so a buyer can send "here is what I need and
 * here is who can supply it" as a link — which is the only reason to put a
 * brief on the web instead of in an email.
 */
export default function RequirementPanel({ requirement, onChange, lens, provinces }) {
  const set = (patch) => onChange({ ...requirement, ...patch });

  const toggleCategory = (id) => {
    const next = requirement.categories.includes(id)
      ? requirement.categories.filter((c) => c !== id)
      : [...requirement.categories, id];
    set({ categories: next });
  };

  return (
    <div className="req">
      <div className="req-cats">
        <span className="field-label">Product group · ประเภทผลิตภัณฑ์</span>
        <div className="chips">
          {Object.entries(CATEGORY_LABEL).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={requirement.categories.includes(id)}
              onClick={() => toggleCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters" data-lens={lens}>
        <div className="field">
          <label htmlFor="q">Search · ค้นหา</label>
          <input
            id="q" type="search" value={requirement.query}
            placeholder="product, producer, district"
            onChange={(event) => set({ query: event.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="region">Region · ภาค</label>
          <select
            id="region"
            value={requirement.regions[0] ?? ''}
            onChange={(event) => set({ regions: event.target.value ? [event.target.value] : [], provinceCodes: [] })}
          >
            <option value="">All Thailand</option>
            {Object.entries(REGION_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="province">Province · จังหวัด</label>
          <select
            id="province"
            value={requirement.provinceCodes[0] ?? ''}
            onChange={(event) => set({ provinceCodes: event.target.value ? [Number(event.target.value)] : [] })}
          >
            <option value="">All</option>
            {provinces.map((p) => (
              <option key={p.code} value={String(p.code)}>{p.th} ({p.records})</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="stars">Min OPC · ดาว</label>
          <select
            id="stars" value={requirement.minStars ?? ''}
            onChange={(event) => set({ minStars: event.target.value ? Number(event.target.value) : null })}
          >
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={String(s)}>{'★'.repeat(s)}</option>)}
          </select>
        </div>

        {lens === 'b2b' && (
          <div className="field">
            <label htmlFor="age">Filed within · ปีที่ยื่น</label>
            <select
              id="age" value={requirement.maxFilingAge ?? ''}
              onChange={(event) => set({ maxFilingAge: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">Any</option>
              <option value="3">3 years</option>
              <option value="5">5 years</option>
              <option value="10">10 years</option>
            </select>
          </div>
        )}

        <div className="field checks">
          <span className="field-label">Narrow the result · จำกัดผลลัพธ์</span>
          <div className="check-row">
            <label>
              <input
                type="checkbox" checked={requirement.requireSignal}
                onChange={(event) => set({ requireSignal: event.target.checked })}
              />
              {' '}Hide name-only registrations
            </label>
            <label>
              <input
                type="checkbox" checked={requirement.requireContact}
                onChange={(event) => set({ requireContact: event.target.checked })}
              />
              {' '}Contactable only
            </label>
            {lens === 'b2b' && (
              <label>
                <input
                  type="checkbox" checked={requirement.requireCorroborated}
                  onChange={(event) => set({ requireCorroborated: event.target.checked })}
                />
                {' '}Corroborated by 2+ agencies
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
