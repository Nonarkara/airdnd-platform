#!/usr/bin/env node
/**
 * PRERENDER THE SITE.
 *
 * The problem
 * -----------
 * The site is a single-page application: the server sends one HTML file and
 * the browser builds the rest. That is the right shape for an application
 * and the wrong shape for a document. A crawler that does not run
 * JavaScript — and most of them do not, including several that read
 * encyclopaedias and archives — receives an empty `<div id="root">`. For
 * those readers the site is not thin. It is EMPTY. Every word of the
 * history, every criticism, every number and every one of the province
 * dossiers is invisible, and the only thing a search engine can index is
 * a wordmark.
 *
 * The fix
 * -------
 * The same machinery the spatial-law gate already uses: a real browser
 * renders each view, waits for the content to arrive, and the RESULT is
 * written out as a static HTML file at the path the view lives on. So
 * `/history/` is a document on the server, not a route the client router
 * invents. A crawler gets the history. A browser gets the application,
 * because the scripts are left in and the app takes over.
 *
 * It also writes the two files that tell a crawler what exists:
 * `sitemap.xml` and `robots.txt`.
 *
 *   node scripts/otop-prerender.mjs [--dir dist-otop] [--port 4173]
 *                                   [--no-provinces]
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { ROUTES, assertRegisterCoversApp } from './otop/routes.mjs';
import { PROVINCE_PATH } from '../otop/src/lib/routes.js';

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const DIST = path.resolve(arg('dir', 'dist-otop'));
const PORT_WANTED = Number(arg('port', 4173));
const WITH_PROVINCES = !argv.includes('--no-provinces');
const ORIGIN = `https://otop.nonarkara.org`;

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`\nFAIL — no built site at ${DIST}. Build it first:\n  npx vite build --config vite.otop.config.js\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- the routes
// The paths come from the shared register, which reads the application's own
// route table. A prerender that hard-codes its own list can fall behind the
// app, and then it ships a site whose index.html, sitemap and redirects
// describe a set of pages that no longer exists.
//
// The province dossier is the one view with a parameter, so it is NOT taken
// from the register: it is generated once per province below, from the
// index the build produced.
assertRegisterCoversApp();
const VIEW_ROUTES = ROUTES.filter((r) => r.name !== 'province').map((r) => ({
  path: r.path,
  view: r.name,
  label: r.name,
  title: r.title,
}));

// The legal pages are already static documents on disk; they are listed in
// the sitemap, not rendered.
const STATIC_PAGES = [
  { path: '/legal/', label: 'Fine print' },
  { path: '/legal/privacy/', label: 'Privacy' },
  { path: '/legal/terms/', label: 'Terms' },
  { path: '/legal/provenance/', label: 'Data provenance' },
  { path: '/legal/disclaimer/', label: 'Disclaimer' },
  { path: '/legal/takedown/', label: 'Takedown' },
];

// ---------------------------------------------------------------- the server
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// THE SHELL IS SERVED FOR THE ROUTES BEING RENDERED.
//
// The prerender writes dist-otop/<route>/index.html for every route. On a
// SECOND run, the server's static lookup found those files and served the
// PREVIOUS prerender's output back at the prerender — so it rendered the
// last run's page, checked the last run's title, and wrote the last run's
// page again. A run that measures its own output is a run that cannot
// fail: two files in the shipped site carried another project's title
// because of it.
//
// So: a request for a route that is about to be rendered is served the
// SHELL, whatever is on disk for that route. The prerender measures the
// application, which is what the reader gets.
const SHELL = path.join(DIST, 'index.html');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let file = path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('no');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  // A path with no file extension is a ROUTE, not an asset — and a route is
  // rendered by the application, so the route is served the SHELL. What is on
  // disk for that route is the LAST prerender's output, and rendering that
  // would be measuring the instrument's own memory.
  if (!path.extname(url.pathname)) file = SHELL;
  if (!fs.existsSync(file)) {
    // The SPA fallback: any unknown path is the application, which then
    // reads the path and decides what it is. That is exactly how the live
    // host behaves, so the prerender measures the same thing the reader
    // gets.
    file = SHELL;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
// THE PORT IS NOT PROOF OF ANYTHING.
//
// This machine is shared, and another project's preview server was already
// holding 127.0.0.1:4173 — with --strictPort, so it would not give it up.
// This server binds the IPv6 wildcard, which on macOS does NOT collide with
// an IPv4-only bind, so the listen() SUCCEEDED — and every request to
// 127.0.0.1:4173 went to the OTHER project. The prerender then measured
// seventy-two pages of somebody else's website and reported them as this
// project's documents, because their title did not name this project's
// subject.
//
// So the port is chosen freely, and — this is the part that matters — the
// prerender PROVES IT IS TALKING TO ITSELF before it measures anything. If
// the page it fetches does not carry this project's publisher marker, the
// run stops. A gate that can measure the wrong site is not a gate.
let PORT = PORT_WANTED;
const listen = (port) =>
  new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });

try {
  await listen(PORT);
} catch (err) {
  if (err.code !== 'EADDRINUSE') throw err;
  // The port is taken. Take a free one rather than fail: the port was never
  // the point.
  for (let p = PORT + 1; p < PORT + 40; p++) {
    try {
      await listen(p);
      PORT = p;
      break;
    } catch (e2) {
      if (e2.code !== 'EADDRINUSE') throw e2;
    }
  }
}
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`serving ${DIST} on ${BASE}`);

// THE PROOF. The served HTML must carry this project's publisher marker.
// If it does not, this server is not the thing answering, and every
// measurement below would be about somebody else's site.
{
  const probe = await fetch(`${BASE}/`);
  const html = await probe.text();
  if (!html.includes('otop.nonarkara.org/#publisher')) {
    console.error(
      `\nFAIL — ${BASE} is not serving this project. The served page carries no publisher marker,\n` +
        '       so the prerender would be measuring another site. Refusing to continue.\n',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------- the routes
const index = JSON.parse(fs.readFileSync(path.join(DIST, 'otop_index.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(DIST, 'otop_meta.json'), 'utf8'));
const provinces = WITH_PROVINCES ? (index.provinces || []) : [];

const routes = [
  ...VIEW_ROUTES,
  ...provinces.map((p) => ({
    path: PROVINCE_PATH(p.code),
    view: 'province',
    code: p.code,
    label: `OTOP in ${p.en || p.code}`,
    title: 'OTOP',
  })),
];

const EXPECTED = meta?.counts?.recordsAfterMerge ?? null;

const written = [];
const failed = [];

/**
 * A wall-clock guard that fires even when the page cannot.
 *
 * `page.waitForFunction` has its own timeout, but that timeout is enforced by
 * the PAGE — and the landing view spends minutes parsing 261MB of province
 * shards on the main thread. While the main thread is blocked, the page
 * cannot run the polling function, and so it cannot notice that its own
 * timeout has passed. The wait therefore does not time out; it hangs, and
 * the prerender sits there until the whole run is killed.
 *
 * So the deadline is kept on THIS side of the boundary, where it does not
 * need the page to be alive to notice it.
 */
function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`the page did not arrive within ${Math.round(ms / 1000)}s — ${label}`)),
      ms,
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * A browser per route.
 *
 * One browser for ninety-two routes was a bad bargain: the landing view
 * loads the whole registry, and the memory it took outlived the page. The
 * browser died on route one, and every route after it failed with "the page
 * never painted its content" — which reads like ninety-two broken pages and
 * is in fact one dead browser. The failure was reported as ninety-two
 * findings because the instrument could not tell the difference.
 *
 * A fresh browser per route costs about a second each and cannot poison the
 * next one.
 */
async function launchBrowser() {
  try {
    return await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  } catch {
    return await chromium.launch();
  }
}

// The landing view is the heavy one: it streams the entire registry, so it
// gets a longer deadline than the others.
const ARRIVE_MS = Number(process.env.PRERENDER_TIMEOUT_MS || 120000);
const LANDING_MS = Number(process.env.PRERENDER_LANDING_TIMEOUT_MS || 900000);

for (const route of routes) {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const url = BASE + route.path;
  const started = Date.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // WAIT FOR THE PAGE TO ARRIVE.
    //
    // A prerender taken before the content lands is a prerender of a
    // loading state — and it is worse than no prerender, because it looks
    // like a page. The landing view streams the whole registry, so it waits
    // for the registry count; the other views wait for their own h1.
    const arrived = await withDeadline(
      page
        .waitForFunction(
          (expected, isLanding) => {
            const h1 = document.querySelector('main h1, .state h1');
            if (!h1 || !h1.textContent.trim().length) return false;
            if (!isLanding) return true;
            const dd = document.querySelector('.find-panel-stats dd');
            if (!dd) return false;
            return Number(dd.textContent.replace(/[^\d]/g, '')) === expected;
          },
          EXPECTED,
          route.path === '/',
          { timeout: ARRIVE_MS },
        )
        .then(() => true)
        .catch(() => false),
      route.path === '/' ? LANDING_MS : ARRIVE_MS,
      `${route.path} never painted its content`,
    );
    if (!arrived) throw new Error('the page never painted its content');

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);

    const { html, title, description, canonical } = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true);
      // The scripts STAY. The prerender is a document for a crawler that
      // cannot run them; a browser that can run them must still get the
      // application, or the site stops being an application.
      const link = document.querySelector('link[rel="canonical"]');
      const desc = document.querySelector('meta[name="description"]');
      return {
        html: '<!doctype html>\n' + clone.outerHTML,
        title: document.title,
        description: desc ? desc.getAttribute('content') : '',
        canonical: link ? link.getAttribute('href') : '',
      };
    });

    if (!title) throw new Error('the page has no title — a document without a title is not findable');
    // The title must name THIS DOCUMENT'S SUBJECT, from the route register.
    //
    // The check used to be "the title contains OTOP, unless the view is the
    // soft-power monitor or the matchmaker" — and those two exemptions were
    // a hole exactly the size of the failure: the prerender served a stale
    // file from another project for /match/ and /softpower/, the title came
    // back as "EACH — Every piece of your startup, unified.", the two
    // exempt views passed the check, and two documents in the shipped site
    // carried somebody else's title.
    //
    // So the check is now the register's own words for the route, and no
    // view is exempt. The soft-power monitor's title carries "soft power";
    // every other view's carries "OTOP".
    const want = route.title || 'OTOP';
    if (!title.toLowerCase().includes(String(want).toLowerCase())) {
      throw new Error(`the title does not name the subject: "${title}" (expected "${want}")`);
    }
    // AND THE PAGE MUST BE THIS PROJECT'S. The publisher marker is in the
    // shell and in every rendered document; a page without it came from
    // somewhere else.
    if (!html.includes('otop.nonarkara.org/#publisher')) {
      throw new Error('the rendered page carries no publisher marker — this is not this project\'s document');
    }

    // Per-page structured data. The site-level graph stays in index.html.
    const ld = pageLd(route, title, description, canonical, meta);
    const withLd = ld
      ? html.replace('</head>', `  <script type="application/ld+json" id="__otop_page_ld__">\n${JSON.stringify(ld, null, 2)}\n  </script>\n</head>`)
      : html;

    const dir = route.path === '/' ? DIST : path.join(DIST, route.path);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.html');
    fs.writeFileSync(file, withLd, 'utf8');
    written.push({ path: route.path, file, title, ms: Math.round(Date.now() - started) });
    console.log(
      `  · ${route.path.padEnd(24)} ${String(Math.round((Date.now() - started) / 1000)).padStart(4)}s  ${title.slice(0, 58)}`,
    );
  } catch (e) {
    failed.push({ path: route.path, why: e.message });
    console.error(`  ✗ ${route.path.padEnd(24)} ${e.message}`);
  }
  // The browser goes with the route. It loaded 261MB of registry on the
  // landing page; keeping it alive means keeping that memory alive, and a
  // browser that dies takes every route after it with it.
  await browser.close().catch(() => {});
}

server.close();

/**
 * The structured data for one page.
 *
 * An article about a programme is an Article. A register of records is a
 * Dataset. Saying which is which is not a formality: it is how a search
 * engine knows to show a dataset panel instead of a blue link.
 */
function pageLd(route, title, description, canonical, meta) {
  const base = {
    '@context': 'https://schema.org',
    '@type': route.view === 'bank' ? 'Dataset' : 'WebPage',
    '@id': `${canonical || ORIGIN + route.path}#page`,
    url: canonical || ORIGIN + route.path,
    name: title,
    description,
    isPartOf: { '@id': `${ORIGIN}/#website` },
    inLanguage: 'en',
  };
  if (route.view === 'bank') {
    base.creator = { '@id': `${ORIGIN}/#publisher` };
    base.isBasedOn = { '@id': `${ORIGIN}/#otop` };
    base.distribution = {
      '@type': 'DataDownload',
      contentUrl: `${ORIGIN}/bank/`,
      encodingFormat: 'application/json',
    };
  }
  if (route.view === 'history' || route.view === 'critic' || route.view === 'story' || route.view === 'method') {
    base['@type'] = 'Article';
    base.author = { '@id': `${ORIGIN}/#publisher` };
    base.publisher = { '@id': `${ORIGIN}/#publisher` };
    base.about = { '@id': `${ORIGIN}/#otop` };
    base.isPartOf = { '@id': `${ORIGIN}/#website` };
  }
  return base;
}

// ---------------------------------------------------------------- the sitemap
const urls = [
  ...written.map((w) => ({ path: w.path, title: w.title })),
  ...STATIC_PAGES.map((p) => ({ path: p.path, title: p.label })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${ORIGIN}${u.path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u.path === '/' ? '1.0' : '0.8'}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');

const robots = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;
fs.writeFileSync(path.join(DIST, 'robots.txt'), robots, 'utf8');

console.log(`\n${written.length} pages prerendered, ${urls.length} urls in sitemap.xml`);
console.log(`robots.txt written. ${failed.length} failure(s).`);
if (failed.length) {
  for (const f of failed) console.error(`  ✗ ${f.path} — ${f.why}`);
  process.exit(1);
}
