/**
 * Find — pure logic for the search-first, phone-first landing.
 *
 * The component (otop/src/components/Find.jsx) is mostly UI; the actual
 * filter + sort is here so it can be tested without a DOM and reasoned
 * about without React state.
 *
 * Three exports:
 *   scoreRecord(r)        — the contactability-first ranking
 *   filterRecords(rs, q)  — the filter pipeline
 *   findToUrl(s)         — URL serialisation (so a search is shareable)
 *   findFromUrl(p)       — URL deserialisation
 *
 * What we deliberately do not do: we do not infer what the registry does
 * not attest (no capacity, no MOQ, no lead time). We rank on what it does
 * attest: stars (state quality grade), phone (you can reach them), and
 * field completeness (a sub-district address is more useful than a
 * province-only one). Records with no phone and no stars end up at the
 * bottom — not removed, just de-prioritised.
 */

export const STAR_ANY = 'any';
export const STAR_FIVE = '5';
export const STAR_FOUR_FIVE = '4-5';

export const ALL_PROVINCES = 'all';

function norm(s) {
  return (s == null ? '' : String(s)).trim().toLowerCase();
}

/**
 * A simple, transparent ranking. The order of magnitude (100 / 50 / 30)
 * is chosen so that a 5★ record with a phone is always above a phone-only
 * record, which is always above a 4★-only record, with no ties that would
 * shuffle the result set on small ranking changes.
 */
export function scoreRecord(r) {
  let s = 0;
  if (r.stars === 5) s += 100;
  else if (r.stars === 4) s += 50;
  else if (r.stars && r.stars >= 1) s += 20;
  if (r.phone) s += 30;
  if (r.productName) s += 10;
  if (r.description) s += 5;
  if (r.subdistrict) s += 3;
  if (r.district) s += 1;
  return s;
}

function matchesQuery(r, q) {
  if (!q) return true;
  return (
    norm(r.producerName).includes(q) ||
    norm(r.productName).includes(q) ||
    norm(r.description).includes(q) ||
    norm(r.district).includes(q) ||
    norm(r.subdistrict).includes(q) ||
    norm(r.category).includes(q)
  );
}

function matchesProvince(r, provinceCode) {
  if (provinceCode == null || provinceCode === '' || provinceCode === ALL_PROVINCES) return true;
  return r.provinceCode === Number(provinceCode);
}

function matchesStars(r, stars) {
  if (stars == null || stars === '' || stars === STAR_ANY) return true;
  if (stars === STAR_FIVE) return r.stars === 5;
  if (stars === STAR_FOUR_FIVE) return r.stars === 4 || r.stars === 5;
  return true;
}

function matchesContactable(r, onlyContactable) {
  return onlyContactable ? Boolean(r.phone) : true;
}

/**
 * The filter pipeline. Pure. Returns a new array sorted by scoreRecord desc.
 * Stable for ties (slice-then-sort is stable in V8 since the spec change).
 */
export function filterRecords(records, { query, provinceCode, stars, onlyContactable } = {}) {
  if (!records) return [];
  const q = norm(query);
  const out = [];
  for (const r of records) {
    if (!matchesQuery(r, q)) continue;
    if (!matchesProvince(r, provinceCode)) continue;
    if (!matchesStars(r, stars)) continue;
    if (!matchesContactable(r, onlyContactable)) continue;
    out.push(r);
  }
  out.sort((a, b) => scoreRecord(b) - scoreRecord(a));
  return out;
}

/**
 * URL serialisation. A search is shareable. The view=find is omitted on the
 * default landing so the URL stays clean; deep links to filtered views
 * include the params that diverge from defaults.
 */
export function findToUrl({ query, provinceCode, stars, onlyContactable } = {}) {
  const p = new URLSearchParams();
  let has = false;
  if (query && query.trim()) { p.set('q', query.trim()); has = true; }
  if (provinceCode && provinceCode !== ALL_PROVINCES) { p.set('p', String(provinceCode)); has = true; }
  if (stars && stars !== STAR_ANY) { p.set('s', stars); has = true; }
  if (onlyContactable) { p.set('c', '1'); has = true; }
  if (has) p.set('view', 'find');
  return `${window.location.pathname}${p.toString() ? '?' + p.toString() : ''}`;
}

export function findFromUrl(search) {
  const p = new URLSearchParams(search || window.location.search);
  return {
    query: p.get('q') ?? '',
    provinceCode: p.get('p') ?? ALL_PROVINCES,
    stars: p.get('s') ?? STAR_ANY,
    onlyContactable: p.get('c') === '1',
  };
}

/**
 * Recent searches — small, session-scoped, capped at 5.
 * Returning visitors land where they left off. Nothing is sent anywhere.
 * Cleared when the tab closes; not visible across browsers.
 */
const RECENT_KEY = 'otop_find_recent_v1';
const RECENT_MAX = 5;

export function recentSearches() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

export function pushRecentSearch(state) {
  if (typeof window === 'undefined') return;
  const { query, provinceCode, stars, onlyContactable } = state;
  // A search has to have at least one signal to be worth remembering; an
  // empty search is the default landing, not a "where I was".
  const meaningful = (query && query.trim()) ||
                     (provinceCode && provinceCode !== ALL_PROVINCES) ||
                     (stars && stars !== STAR_ANY) ||
                     onlyContactable;
  if (!meaningful) return;
  const entry = {
    query: (query || '').trim(),
    provinceCode: provinceCode || ALL_PROVINCES,
    stars: stars || STAR_ANY,
    onlyContactable: !!onlyContactable,
    at: Date.now(),
  };
  const prev = recentSearches().filter((e) =>
    !(e.query === entry.query &&
      e.provinceCode === entry.provinceCode &&
      e.stars === entry.stars &&
      e.onlyContactable === entry.onlyContactable)
  );
  const next = [entry, ...prev].slice(0, RECENT_MAX);
  try { sessionStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
}
