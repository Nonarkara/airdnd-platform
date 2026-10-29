#!/usr/bin/env node
/**
 * Render each view of the live site and write the RESULT as a static page.
 *
 * Why this exists
 * ---------------
 * The spatial-law gate loads a page in an iframe and measures it once the
 * layout stops changing. On a server-rendered site that is the page. On a
 * single-page app it is the loading state: the iframe fires `load` before
 * React has painted, the gate settles on an empty document, and it reports
 * zero findings. A gate that measures nothing and says "clean" is worse
 * than no gate — it manufactures the evidence that the work is done.
 *
 * So the page is rendered FIRST, by a browser that waits for the real
 * content, and the resulting DOM is written out as a static HTML file with
 * the stylesheet inlined and the fonts and photographs alongside it. The
 * gate then measures a document that is already the thing a reader sees,
 * with the same type and the same images.
 *
 * Usage:
 *   node scripts/otop-snapshot.mjs [baseUrl] [outDir]
 *
 * Output: <outDir>/index.html          the landing view
 *         <outDir>/<view>/index.html   every other view
 *         <outDir>/fonts, <outDir>/heroes   the assets they need
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROUTES, urlFor, assertRegisterCoversApp } from './otop/routes.mjs';

const BASE = (process.argv[2] || 'https://otop.pages.dev/').replace(/\/+$/, '');
const OUT = process.argv[3] || 'design/spatial-snapshots';

// The gate walks the snapshot tree, so a view that is not snapshotted is a
// view nobody has a receipt for. The register is what keeps that from
// happening by accident: it is checked against the app's own route table
// before a single page is rendered.
assertRegisterCoversApp();

const VIEWS = ROUTES.map((r) => ({
  // The landing view is written to the tree's root; every other view to its
  // own directory.
  name: r.landing ? '' : r.name,
  url: urlFor(r),
}));

// The record count the build claims. The Find view streams 77 province
// shards; a snapshot taken before they land is a snapshot of a fraction of
// the registry.
const meta = await (await fetch(`${BASE}/otop_meta.json`)).json();
const EXPECTED = meta?.counts?.recordsAfterMerge ?? null;

fs.mkdirSync(OUT, { recursive: true });

/* ── the assets the snapshots need, copied from the live site ─────────── */
// The asset list comes from the stylesheet itself, not from a directory
// listing: the host serves no index for /fonts/ and /heroes/, so there is
// nothing to list.
async function copyAssets(cssText) {
  const paths = [...new Set(
    [...cssText.matchAll(/url\(['"]?(\/[^)'"]+)/g)].map((m) => m[1])
      .filter((p) => p.startsWith('/fonts/') || p.startsWith('/heroes/')),
  )];
  let n = 0;
  for (const p of paths) {
    const res = await fetch(`${BASE}${p}`);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(OUT, p.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    n++;
  }
  return n;
}

// The stylesheet, fetched once and rewritten so the fonts resolve against
// the snapshot directory rather than against a host that will not be there.
const cssHref = (await (await fetch(`${BASE}/`)).text())
  .match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
if (!cssHref) {
  console.error('FAIL — no stylesheet found on the live site; the snapshots would be unstyled.');
  process.exit(1);
}
const rawCss = await (await fetch(new URL(cssHref, `${BASE}/`))).text();
// The font URLs are rewritten to point at the snapshot's own copy, so the
// gate's server can serve them — the live host is not there to ask.
// The rewrite has to take the WHOLE url() token, quote included. Replacing
// only the opening half leaves `url('fonts/x.otf)` — an unterminated
// string — and the browser then drops every rule from that point to the
// next `}`. The snapshot still looks like a page; it is simply missing a
// third of its stylesheet, and a gate measuring that is measuring a lie.
const css = rawCss
  .replace(/url\(\s*(['"]?)(\/fonts\/[^)'"]+)\1\s*\)/g, (m, q, p) => `url('FONTPREFIX${p}')`)
  .replace(/url\(\s*(['"]?)(\/heroes\/[^)'"]+)\1\s*\)/g, (m, q, p) => `url('FONTPREFIX${p}')`);

// The system Chrome is what the site was reviewed in, so it is what the
// snapshot must be taken in. CI may not have it — the bundled Chromium is
// the fallback, because a gate that cannot start a browser is a gate that
// never runs.
let browser;
try {
  browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
} catch {
  browser = await chromium.launch();
}
const written = [];

for (const view of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + view.url, { waitUntil: 'domcontentloaded' });

  if (view.name === '' && EXPECTED) {
    // Only the landing view streams the whole registry; the other views
    // load their own artefact and say so on the page.
    //
    // This wait is HARD. It used to be `.catch(() => {})` — a silent
    // timeout — and the selector it waited on, `.find-stats strong`, had
    // been renamed to `.find-panel-stats dd` in an earlier commit. So for
    // months the wait found nothing, timed out quietly, and the snapshot
    // was written of a registry that had not finished arriving: "a snapshot
    // taken before they land is a snapshot of a fraction of the registry",
    // written by the script itself, and the receipt did not say so.
    // A snapshot that is not the whole page must not be published as one.
    const landed = await page
      .waitForFunction(
        (expected) => {
          const el = document.querySelector('.find-panel-stats dd');
          if (!el) return false;
          return Number(el.textContent.replace(/[^\d]/g, '')) === expected;
        },
        EXPECTED,
        { timeout: 120000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!landed) {
      console.error(
        `\nFAIL — the landing view never reached ${EXPECTED.toLocaleString()} records.\n` +
          `The snapshot would be a fraction of the registry, and a gate that measures\n` +
          `a fraction reports the fraction as if it were the whole. Fix the wait, or\n` +
          `fix the page, and take the snapshot again.\n`,
      );
      process.exit(1);
    }
  } else {
    const titled = await page
      .waitForFunction(
        () => {
          const h1 = document.querySelector('main h1, .state h1');
          return Boolean(h1 && h1.textContent.trim().length);
        },
        { timeout: 60000 }
      )
      .then(() => true)
      .catch(() => false);
    if (!titled) {
      console.error(
        `\nFAIL — ${view.url} never painted an h1. The snapshot would be of a page\n` +
          `that had not arrived, and a gate that measures that measures nothing.\n`,
      );
      process.exit(1);
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const { html, cssHref: pageCssHref } = await page.evaluate(() => {
    // The scripts must go: the snapshot is the page as rendered, and
    // re-running the bundle would replace it with the loading state.
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script').forEach((s) => s.remove());
    clone.querySelectorAll('link[rel="stylesheet"]').forEach((l) => l.remove());
    // Every disclosure is opened. A collapsed <details> is not on the page,
    // but a reader can open it, so its layout is a layout the site has. And
    // Chrome lays skipped content out at nonsense sizes — a closed
    // <details> reported a 197,000px-tall table in a 44px box — so measuring
    // it closed measures the browser's bookkeeping, not the design.
    clone.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    const link = document.querySelector('link[rel="stylesheet"]');
    return {
      html: '<!doctype html>\n' + clone.outerHTML,
      cssHref: link ? link.getAttribute('href') : null,
    };
  });

  const dir = view.name ? path.join(OUT, view.name) : OUT;
  fs.mkdirSync(dir, { recursive: true });
  const prefix = view.name ? '../' : '';
  const file = path.join(dir, 'index.html');
  const style = `<style>\n${css.replace(/FONTPREFIX\//g, prefix)}\n</style>`;
  fs.writeFileSync(file, html.replace('</head>', `${style}\n</head>`), 'utf8');
  written.push({ view: view.name || '/', url: view.url, file, cssHref: pageCssHref });
  console.log(`  · ${(view.name || '/').padEnd(10)} ${view.url.padEnd(30)} → ${file}`);

  await ctx.close();
}

await browser.close();

const n = await copyAssets(rawCss);

// The gate reads the built stylesheet to find the widths the layout actually
// changes at, and it looks for it at <snapshot>/_next/static/css — a Next.js
// convention, which this project (Vite) does not have. Without the file the
// sweep falls back to a list of widths somebody chose, and the instrument
// says so out loud: a layout checked only at the widths somebody listed is
// checked at the widths where nothing changes. The project's breakpoints are
// where the layout BREAKS, so the stylesheet is put where the instrument
// looks for it. The instrument itself is not touched.
const cssDir = path.join(OUT, '_next', 'static', 'css');
fs.mkdirSync(cssDir, { recursive: true });
fs.writeFileSync(path.join(cssDir, 'otop.css'), rawCss, 'utf8');

console.log(`\n${written.length} snapshots, ${n} fonts and images in ${OUT}`);
console.log(`The built stylesheet is at ${path.relative(process.cwd(), cssDir)} — the gate reads the breakpoints from it.`);
fs.writeFileSync(path.join(OUT, 'snapshot.json'), JSON.stringify({ base: BASE, expected: EXPECTED, written }, null, 2));
console.log(`Now run: node scripts/spatial/spatial-check.mjs --dir ${OUT} --baseline design/spatial-baseline.json`);
process.exit(0);
