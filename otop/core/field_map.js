/**
 * Field discovery.
 *
 * OTOP data on data.go.th is published by many agencies with no shared schema —
 * the same concept appears as "ชื่อผู้ผลิต", "ผู้ประกอบการ", "producer_name" or
 * "GROUP_NAME" depending on who exported it. Hardcoding column names guarantees
 * a silent zero-row ingest the first time a publisher renames a header.
 *
 * So the mapping is discovered per resource: score every source column against
 * the alias dictionary, take the best assignment, and *report* it. A resource
 * whose mapping cannot find a name column is skipped loudly, not silently.
 */

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s_\-.()[\]/]+/g, '')
    .trim()
    .toLowerCase();
}

/**
 * @param {string[]} headers  columns present in the resource
 * @param {Record<string,string[]>} aliases  canonical field -> accepted names
 * @returns {{map: Record<string,string>, unmapped: string[], ambiguous: object[]}}
 */
export function discoverFieldMap(headers, aliases) {
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }));
  const map = {};
  const claimed = new Set();
  const ambiguous = [];

  // Exact alias match first, in alias order (the dictionary is written most
  // specific first, so "รหัสจังหวัด" is considered before "จังหวัด").
  for (const [field, names] of Object.entries(aliases)) {
    const wanted = names.map(normalizeHeader);
    let best = null;
    for (const col of normalized) {
      if (claimed.has(col.raw)) continue;
      const rank = wanted.indexOf(col.key);
      if (rank !== -1 && (best === null || rank < best.rank)) best = { col, rank };
    }
    if (best) { map[field] = best.col.raw; claimed.add(best.col.raw); }
  }

  // Then substring match for the fields still unfilled, longest alias first so
  // "ชื่อผลิตภัณฑ์" beats "ผลิตภัณฑ์" on a column named "ชื่อผลิตภัณฑ์หลัก".
  for (const [field, names] of Object.entries(aliases)) {
    if (map[field]) continue;
    const wanted = [...names].map(normalizeHeader).sort((a, b) => b.length - a.length);
    const hits = [];
    for (const col of normalized) {
      if (claimed.has(col.raw)) continue;
      const alias = wanted.find((w) => w.length >= 3 && col.key.includes(w));
      if (alias) hits.push({ col, alias });
    }
    if (hits.length === 1) { map[field] = hits[0].col.raw; claimed.add(hits[0].col.raw); }
    else if (hits.length > 1) {
      hits.sort((a, b) => b.alias.length - a.alias.length || a.col.key.length - b.col.key.length);
      map[field] = hits[0].col.raw;
      claimed.add(hits[0].col.raw);
      ambiguous.push({ field, chose: hits[0].col.raw, over: hits.slice(1).map((h) => h.col.raw) });
    }
  }

  return {
    map,
    unmapped: normalized.filter((c) => !claimed.has(c.raw)).map((c) => c.raw),
    ambiguous,
  };
}

/** Does this resource carry enough to be an OTOP record at all? */
export function isUsableMapping(map) {
  const hasName = Boolean(map.productName || map.producerName);
  const hasArea = Boolean(map.province || map.address);
  return hasName && hasArea;
}

/**
 * Resource kind. Every "how many economic aggregates are in the catalogue"
 * count goes through this one function so the number cannot drift between
 * audits. A revenue series is a title match, a monetary unmapped column, or —
 * the leak this closes — a monetary column that field discovery mistook for
 * the name column ("รายได้จากผลิตภัณฑ์" is a value, not a product).
 * ponytail: title/column heuristic; upgrade path is CKAN group tags if
 * data.go.th ever fills them in.
 */
export const ECON_TITLE = /มูลค่า|รายได้|จำหน่าย|ยอดขาย|revenue|sales|income/i;
export const MONEY_COLUMN = /มูลค่า|รายได้|ยอดขาย|ยอดจำหน่าย|value|amount|baht|บาท/i;

/** @returns {'aggregate-economic' | 'producer' | 'other'} */
export function classifyResource({ title = '', map = {}, unmapped = [] }) {
  const nameColumn = map.productName ?? map.producerName ?? '';
  if (nameColumn && MONEY_COLUMN.test(nameColumn)) return 'aggregate-economic';
  if (isUsableMapping(map)) return 'producer';
  if (ECON_TITLE.test(title) || unmapped.some((c) => MONEY_COLUMN.test(String(c ?? '')))) return 'aggregate-economic';
  return 'other';
}

export function applyFieldMap(row, map) {
  const out = {};
  for (const [field, column] of Object.entries(map)) out[field] = row[column];
  return out;
}
