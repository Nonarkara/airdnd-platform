/**
 * Did every path actually render its own view, and call itself the right
 * thing? A path that serves 200 but shows the landing page is worse than a
 * 404: it is a document that lies about itself.
 *
 *   node scripts/otop-routes-check.mjs [base]
 */
import { chromium } from 'playwright';
import { ROUTES, urlFor, assertRegisterCoversApp } from './otop/routes.mjs';

const BASE = (process.argv[2] || 'http://localhost:8124').replace(/\/+$/, '');
// An optional third argument checks ONE route, which is what a falsifier
// needs: the point is to prove the check bites, and proving that against
// fifteen routes costs two minutes of waiting for nothing.
const ONLY = process.argv[3] || null;

// Before anything is measured: is the register still the whole site? A route
// list that has fallen behind the app measures a subset and reports it as
// the whole, which is the one thing a route sweep must never do.
assertRegisterCoversApp();

const browser = await chromium.launch();
let bad = 0;

// The paths a link is allowed to point at: the register's own, so the check
// is against the routes the app really has rather than a hand-kept list.
const knownPathSet = new Set(ROUTES.map((r) => r.path));

for (const route of ROUTES) {
  if (ONLY && route.name !== ONLY && route.path !== ONLY) continue;
  const path = urlFor(route);
  const h1Needle = route.h1;
  const titleNeedle = route.title;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const r = await page
    .goto(BASE + path, { waitUntil: 'domcontentloaded' })
    .then(async () => {
      await page.waitForTimeout(3500);
      return page.evaluate((knownPaths) => {
        // A Set does not survive the boundary into the page — it arrives as a
        // plain object, and `knownPaths.has` is then not a function. So the
        // list crosses as an array and becomes a Set HERE.
        const known = new Set(knownPaths);
        const h1 = document.querySelector('main h1');
        // THE TEXT AS THE READER GETS IT.
        //
        // A view can render perfectly — a heading, a table, the right
        // columns — and still be quoting a field that does not exist. The
        // Critic view did exactly that: it read `finding.count` where the
        // build writes `finding.value`, so the sentence about 7,089
        // unreachable champions rendered with no number in it at all, and
        // the next sentence said "a few dozen" where the register says
        // 117. Nothing about the page LOOKED wrong.
        //
        // So the rendered text is read, and the fingerprints of a missing
        // value are looked for: the literal word undefined, a NaN, an
        // [object Object], a stray "null" standing in for a number.
        const main = document.querySelector('main');
        const text = main ? main.innerText.replace(/\s+/g, ' ') : '';
        const holes = [];
        for (const [needle, why] of [
          ['undefined', 'a value that is not there'],
          ['NaN', 'a number that did not compute'],
          ['[object Object]', 'an object printed as text'],
          ['$null', 'a null standing in for a number'],
        ]) {
          const i = text.indexOf(needle);
          if (i !== -1) {
            holes.push(`${needle} — ${why} — "${text.slice(Math.max(0, i - 50), i + 50)}"`);
          }
        }

        // THE LINKS. Every anchor the reader can follow, read out of the
        // rendered page.
        //
        // Six links on this site were broken by a careless find-and-replace
        // that turned "/atlas/" into "//atlas/" — a PROTOCOL-RELATIVE URL,
        // which a browser resolves as a HOST named "atlas", not a path on
        // this site. They rendered fine, they looked right in the source,
        // and they would have sent a reader off to a domain that does not
        // exist. A view can be perfect and still ship a dead end.
        //
        // So: no href may begin with "//", and every internal href must
        // resolve to a route this site actually has.
        const broken = [];
        for (const a of document.querySelectorAll('a[href]')) {
          const href = a.getAttribute('href') || '';
          if (href.startsWith('//')) {
            broken.push(`protocol-relative href "${href}" — this navigates to a host, not to this site`);
            continue;
          }
          if (!href.startsWith('/') || href.startsWith('/#')) continue;
          const path = href.split('?')[0].split('#')[0];
          const isKnown =
            known.has(path) ||
            /^\/province\/\d+\/$/.test(path) ||
            path.startsWith('/legal/') ||
            path === '/legal/' ||
            path === '/og/otop.png' ||
            path === '/favicon.svg' ||
            /^\/p\/\d+\.json$/.test(path) ||
            path === '/';
          if (!isKnown) broken.push(`href "${href}" points at a route this site does not have`);
        }

        return {
          h1: h1 ? h1.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '(no h1)',
          title: document.title,
          canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '(none)',
          desc: (document.querySelector('meta[name="description"]') || {}).content || '(none)',
          navCount: document.querySelectorAll('.hdr-nav a').length,
          holes,
          broken,
          length: text.length,
        };
      }, [...knownPathSet]);
    })
    .catch((e) => ({ error: e.message }));
  await ctx.close();

  // A page that did not load is a failure, and it must be REPORTED as one.
  // The reporter used to read `r.title` of an error object and throw, which
  // turned "this view could not be loaded" into "the instrument crashed" —
  // the one failure an operator cannot read.
  if (r && r.error) {
    bad++;
    console.log(`FAIL ${path.padEnd(16)} could not be loaded: ${r.error}`);
    continue;
  }

  const h1Ok = !h1Needle || (r.h1 || '').includes(h1Needle);
  const titleOk = (r.title || '').includes(titleNeedle);
  const canonOk = (r.canonical || '').startsWith('https://otop.nonarkara.org');
  const holesOk = !r.holes || r.holes.length === 0;
  const linksOk = !r.broken || r.broken.length === 0;
  const ok = h1Ok && titleOk && canonOk && r.navCount >= 6 && holesOk && linksOk;
  if (!ok) bad++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${path.padEnd(16)} h1=${JSON.stringify(r.h1).slice(0, 44).padEnd(46)} title=${JSON.stringify(r.title).slice(0, 56)}`,
  );
  if (!ok) console.log(`       canonical=${r.canonical} navLinks=${r.navCount}`);
  if (!holesOk) for (const h of r.holes) console.log(`       HOLE: ${h}`);
  if (!linksOk) for (const b of r.broken) console.log(`       DEAD END: ${b}`);
}

await browser.close();
console.log(bad ? `\n${bad} route(s) wrong.` : '\nEvery route rendered its own view and named itself.');
process.exit(bad ? 1 : 0);
