/**
 * WHERE A VIEW LIVES, AND WHAT IT CALLS ITSELF.
 *
 * Two jobs, both about being found.
 *
 * ONE — THE ADDRESS OF A VIEW.
 *
 * The site's state used to live only in a query string: `?view=atlas`. That
 * works for a reader who is already on the site, and it fails completely for
 * anyone who is not: a search engine sees `/` with a different query string,
 * a link in a message is unreadable, and a crawler cannot tell that
 * `/?view=history` is a document about twenty-five years of a national
 * programme. The URL is now the path — `/history/`, `/province/50/` — and
 * the query string still works, so every link that already exists keeps
 * working.
 *
 * TWO — WHAT THE VIEW CALLS ITSELF.
 *
 * A title is not a label. It is the one line a reader (or a crawler) gets
 * before deciding whether to read. Every view names OTOP in its title, and
 * says in one sentence what that view is FOR. A site that hides its subject
 * behind a brand name is a site nobody searching for the subject will find.
 */

export const SITE = 'https://otop.nonarkara.org';
export const SITE_NAME = 'one³';
export const SITE_TAGLINE = "One Tambon, One Product, One Platform — Thailand's soft-power monitor";

/** The views the site has, in the order the nav reads them. */
export const VIEWS = [
  'find', 'match', 'atlas', 'province', 'matchmaker', 'briefs',
  'tides', 'champions', 'story', 'history', 'critic', 'crossrefs',
  'bank', 'method', 'softpower',
];

/** The path a view answers on. */
export const PATHS = {
  find: '/',
  match: '/match/',
  atlas: '/atlas/',
  province: '/province/',
  matchmaker: '/matchmaker/',
  briefs: '/briefs/',
  tides: '/tides/',
  champions: '/champions/',
  story: '/story/',
  history: '/history/',
  critic: '/critic/',
  crossrefs: '/crossrefs/',
  bank: '/bank/',
  method: '/method/',
  softpower: '/softpower/',
};

/** The path a province dossier answers on. */
export const PROVINCE_PATH = (code) => `/province/${code}/`;

/**
 * The path a given view lives at, including the province code.
 * The province dossier is the only view whose path carries a parameter.
 */
export function pathFor(view, code) {
  if (view === 'province') return code != null ? PROVINCE_PATH(code) : PATHS.atlas;
  return PATHS[view] || PATHS.find;
}

/**
 * The path a given view lives at, for a CANONICAL url: no filters, no lens.
 * Two urls that show the same document must say so, or the search engine is
 * asked to choose between them.
 */
export function canonicalFor(view, code) {
  if (view === 'province') return code != null ? SITE + PROVINCE_PATH(code) : SITE + '/atlas/';
  return SITE + (PATHS[view] || PATHS.find);
}

/**
 * WHAT EACH VIEW IS, IN ONE TITLE AND ONE SENTENCE.
 *
 * Every title names OTOP, because OTOP is what the site is about and what
 * somebody typing "OTOP" into a search engine is looking for. The brand
 * comes second, because the brand is what makes this site identifiable, not
 * what makes it worth reading.
 */
export const VIEW_META = {
  find: {
    title: 'OTOP Thailand — the One Tambon One Product registry, complete | one³',
    description:
      'The whole OTOP registry in one place: producers with names, products, provinces, OPC star grades and contact channels, plus the history, the criticism, the numbers and the raw data behind all of it.',
  },
  match: {
    title: 'Match OTOP supply to demand — ranked by what a buyer can act on | one³',
    description:
      'State what you need and get a ranked shortlist of Thai OTOP producers with the reason for each rank: grade, corroboration, filing age and whether a contact channel exists at all.',
  },
  atlas: {
    title: 'The OTOP registry as one package — findings, geography, money, gaps | one³',
    description:
      'Seven chapters, one question each. What 154,050 OTOP records say when they are read as data: who carries a grade, who can be reached, where the money is, and which provinces the registry leaves blank.',
  },
  province: {
    title: 'OTOP in {province} — supply, grades, reach | one³',
    description:
      'One province, every layer: the OTOP products filed there, their grades and filing years, how many carry a contact channel, and the gaps the national registry leaves in {province}.',
  },
  matchmaker: {
    title: 'Where OTOP supply is, where the money already is | one³',
    description:
      'Thai provinces ranked by supply × demand × routability. Pick a category and read the triangle: which provinces hold the product, which hold the money, and which hold neither.',
  },
  briefs: {
    title: 'Six forwardable OTOP briefs — one number, one chart, what it means | one³',
    description:
      'Six short reads of the OTOP registry. Each carries one number, one chart, what it means, and what to do about it. Copy the link or export the image.',
  },
  tides: {
    title: 'Where OTOP demand is moving — 385 category × province trajectories | one³',
    description:
      'Three years of revenue trajectory for every product category in every province. Green up, red down, grey flat — a province beating the national row is doing real work.',
  },
  champions: {
    title: 'Reachable OTOP producers — the buyer\'s starting list | one³',
    description:
      'The OTOP producers the registry says can be reached: 4–5★ grades that also carry a phone, an email or a website. Out of 154,050 records, only the few carrying both.',
  },
  story: {
    title: 'The OTOP story — the map, the money, and the names no one can route to | one³',
    description:
      'Five chapters plus what the public says. The OTOP registry read as a national story: where the programme grew, where the money went, and who was left without a way to be found.',
  },
  history: {
    title: 'OTOP: 25 years — from Oita to the platform | one³',
    description:
      'The full history of Thailand\'s One Tambon One Product programme: the Oita seed, the 2001 declaration, the 5★ grade, the suspensions, and the port into a searchable registry. Every date cited.',
  },
  critic: {
    title: 'OTOP, examined — the history, the criticism, and what the record shows | one³',
    description:
      'What the public record says about OTOP: the programme\'s own rules, the academic and press criticism of it, the arguments for and against the 5★ grade, and what the registry itself can and cannot settle.',
  },
  crossrefs: {
    title: 'OTOP against the country it sits in — per-capita supply, tourist money, broadband | one³',
    description:
      'OTOP supply per head beside tourist money, broadband reach and reachable records. Phuket\'s 14.1M tourists against near-zero reachable producers — the gaps the national registry hides.',
  },
  bank: {
    title: 'The OTOP data bank — every dataset the portal returned | one³',
    description:
      'Every list the data.go.th portal returned, shelved by kind, with the pulled rows so you can see what the build actually read. The raw material under every number on this site.',
  },
  method: {
    title: 'What the OTOP numbers are, and are not | one³',
    description:
      'How 154,050 filing records became one registry — the merge, the dedup, the quality gate, and the limits that travel with every count. What this site measures, and what it refuses to claim.',
  },
  softpower: {
    title: 'Thailand\'s soft power, measured on the supply side — OTOP and six registers | one³',
    description:
      'Seven instruments, six registers, one portal. OTOP is the deepest of them; the rest measure the craft, the food, the film, the trade and the people who carry them.',
  },
};

/**
 * The title and description for a view, with the province's own name put in
 * where the province is the subject.
 */
export function metaFor(view, code, provinceName) {
  const m = VIEW_META[view] || VIEW_META.find;
  const name = provinceName ? provinceName.replace(/\s*\/\s*.*$/, '') : '';
  return {
    title: m.title.replace('{province}', name || 'this province'),
    description: m.description.replace('{province}', name || 'this province'),
  };
}

/**
 * READ THE ADDRESS.
 *
 * The path first, then the query string. The query string is the old
 * address and it still works — every link that already exists in the world
 * keeps working — but the path is the address now, and it is the one that
 * goes in a link.
 */
export function viewFromLocation() {
  const p = window.location.pathname;
  const m = /^\/province\/(\d+)\/?$/.exec(p);
  if (m) return { view: 'province', code: Number(m[1]) };
  for (const v of VIEWS) {
    if (v === 'province') continue;
    if (PATHS[v] === '/') continue;
    if (p === PATHS[v] || p === PATHS[v].replace(/\/$/, '')) return { view: v, code: null };
  }
  // The old address.
  const q = new URLSearchParams(window.location.search);
  const qv = q.get('view');
  if (VIEWS.includes(qv)) {
    const c = Number(q.get('code'));
    return { view: qv, code: Number.isInteger(c) && c > 0 ? c : null };
  }
  return { view: 'find', code: null };
}
