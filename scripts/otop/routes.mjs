/**
 * THE ROUTE REGISTER — one list of every view, for the site and for the
 * instruments that measure it.
 *
 * WHY THIS FILE EXISTS
 *
 * The site had fifteen views. The route sweep knew about six. The spatial
 * snapshot knew about six. The MSH audit knew about six. The preservation
 * probe knew about fourteen. Each one carried its own hand-written list,
 * and each list was correct ON THE DAY IT WAS WRITTEN — and wrong the next
 * time a view was added.
 *
 * That is how the Critic view could ship with no receipt, and how a route
 * could be measured by one instrument and invisible to another. A gate that
 * covers a subset of the site reports the subset as if it were the whole,
 * and a report that says "14 of 15 views measured" is a report about a
 * number, not about the site.
 *
 * So the paths themselves come from the application — `otop/src/lib/routes.js`
 * is where the app decides what a view's address is, and the instruments read
 * THAT file rather than keeping a copy. A copy is a promise; an import is
 * the thing itself.
 *
 * WHAT THIS FILE ADDS ON TOP OF THE APP
 *
 * The app knows the path of a view. The instruments also need:
 *
 *   · the QUERY a view needs to show the state that must be measured
 *     (Match is measured in its B2B lens; the landing view is measured
 *     with the whole registry loaded),
 *   · the TASK a reader is trying to do on it — the MSH law's "task
 *     visibility" asks whether the thing the reader came for is above
 *     the fold, and that is a different sentence on every view,
 *   · the WORDS a view's own heading must contain, so a path that serves
 *     200 but renders the landing page is caught rather than counted.
 */

import { PATHS, VIEWS as APP_VIEWS, SITE } from '../../otop/src/lib/routes.js';

export { SITE };

/**
 * Every view, in the order the nav reads them.
 *
 * `query` — the state the view must be measured in.
 * `task`  — what a reader comes here to do, in one clause.
 * `h1`    — words the view's own heading must contain.
 * `title` — words the view's <title> must contain.
 */
export const ROUTES = [
  {
    name: 'find',
    path: PATHS.find,
    query: '',
    task: 'search a producer and call them',
    h1: 'Who can you call today?',
    title: 'OTOP',
    landing: true,
  },
  {
    name: 'match',
    path: PATHS.match,
    query: '?lens=b2c',
    task: 'filter a shortlist of producers',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'atlas',
    path: PATHS.atlas,
    query: '',
    task: 'read what the data says',
    h1: 'The whole registry as one package',
    title: 'OTOP',
  },
  {
    name: 'province',
    path: `${PATHS.province}50/`,
    query: '',
    task: 'read one province whole',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'matchmaker',
    path: PATHS.matchmaker,
    query: '',
    task: 'see where the supply is and where the money already is',
    h1: 'Where the supply is',
    title: 'OTOP',
  },
  {
    name: 'briefs',
    path: PATHS.briefs,
    query: '',
    task: 'get a forwardable brief for one sector',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'tides',
    path: PATHS.tides,
    query: '',
    task: 'see where a category is moving and where it is stalling',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'champions',
    path: PATHS.champions,
    query: '',
    task: "start from the buyer's list",
    h1: "The buyer's starting list",
    title: 'OTOP',
  },
  {
    name: 'story',
    path: PATHS.story,
    query: '',
    task: 'read how the registry came to be',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'history',
    path: PATHS.history,
    query: '',
    task: 'read the arc of the seed, the boom and the silence',
    h1: 'The seed, the boom',
    title: 'OTOP',
  },
  {
    name: 'critic',
    path: PATHS.critic,
    query: '',
    task: 'read the criticism of the programme, and what the record settles',
    h1: 'What the record says about OTOP',
    title: 'OTOP',
  },
  {
    name: 'crossrefs',
    path: PATHS.crossrefs,
    query: '',
    task: 'see OTOP against the country it sits in',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'bank',
    path: PATHS.bank,
    query: '',
    task: 'look up a dataset',
    h1: 'Every dataset the portal returned',
    title: 'OTOP',
  },
  {
    name: 'method',
    path: PATHS.method,
    query: '',
    task: 'understand what the numbers mean',
    h1: null,
    title: 'OTOP',
  },
  {
    name: 'softpower',
    path: PATHS.softpower,
    query: '',
    task: "measure Thailand's soft power on the supply side",
    h1: null,
    title: 'soft power',
  },
];

/**
 * The address of a route, with its query.
 */
export function urlFor(route) {
  return route.path + (route.query || '');
}

/**
 * THE CHECK THAT CATCHES THE FAILURE THIS FILE EXISTS TO PREVENT.
 *
 * If the application's route table grows a view and this register does not,
 * the instruments would go on measuring the old set and reporting it as the
 * whole site. That is the exact failure the register was made to stop, so
 * it is checked on every run — loudly, and before anything is measured.
 *
 * The province route is the one exception: the app addresses it by a
 * pattern, `/province/<code>/`, and the register carries one instance of
 * it (Chiang Mai, code 50).
 */
export function assertRegisterCoversApp() {
  const covered = new Set(ROUTES.map((r) => r.name));
  const missing = APP_VIEWS.filter((v) => !covered.has(v));
  if (missing.length) {
    throw new Error(
      `ROUTE REGISTER IS STALE — the app has ${missing.length} view(s) the instruments do not measure: ` +
        `${missing.join(', ')}.\n` +
        'Add them to scripts/otop/routes.mjs, or the gates will report a subset of the site as the whole of it.',
    );
  }
  const known = new Set(APP_VIEWS);
  const extra = ROUTES.map((r) => r.name).filter((n) => !known.has(n));
  if (extra.length) {
    throw new Error(
      `ROUTE REGISTER NAMES VIEWS THE APP DOES NOT HAVE: ${extra.join(', ')}.\n` +
        'A route that does not exist cannot be measured, and its absence will be reported as a pass.',
    );
  }
  return true;
}

/**
 * The register as JSON, for the shell instruments.
 *
 *   node scripts/otop/routes.mjs --json
 *
 * The live verifier reads this instead of keeping its own list of paths, so
 * the thing it checks on the deployed host is the same set of documents the
 * app actually has.
 */
if (process.argv[1] && process.argv[1].endsWith('routes.mjs')) {
  assertRegisterCoversApp();
  console.log(
    JSON.stringify(
      ROUTES.map((r) => ({
        name: r.name,
        path: r.path,
        query: r.query || '',
        h1: r.h1,
        title: r.title,
        canonical: SITE + r.path,
      })),
      null,
      2,
    ),
  );
}
