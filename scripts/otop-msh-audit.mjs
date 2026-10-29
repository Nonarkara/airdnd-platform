/**
 * The MSH evidence pass.
 *
 * The instrument measures geometry (holes, orphans, wraps, clips). The law
 * also asks for five things the instrument does not measure: the chrome
 * cost, whether the task and its action share a screen, the reading
 * hierarchy, and what the repair preserved. This measures the first three
 * and renders the screenshots the fourth and fifth are judged from.
 *
 * Two things this gets right that a naive measurement does not:
 *
 *   1. An element parked off-canvas (the skip link sits at left:-9999px) is
 *      not an action a person can take. Counting it made "first action"
 *      report the skip link on every page.
 *   2. Chrome cost is measured AFTER a scroll as well as before. A sticky
 *      band that is harmless at rest can eat half a phone screen once the
 *      reader starts reading — and a sticky band whose top is under another
 *      sticky band is invisible while still charging rent.
 *
 * node scripts/otop-msh-audit.mjs [base] [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertOtop, launchBrowser } from './otop-identity.mjs';
import { ROUTES, urlFor, assertRegisterCoversApp } from './otop/routes.mjs';

const BASE = (process.argv[2] || 'https://otop.nonarkara.org').replace(/\/+$/, '');
const OUT = process.argv[3] || 'design/msh-evidence/after';

// The register must still be the whole site before the audit goes out.
assertRegisterCoversApp();

const VIEWS = ROUTES.map((r) => [r.name, urlFor(r), r.task]);

// The viewports the law names: 390x844 and 1440x900 for the first-screen
// checks, and 1024 for the intermediate width.
const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1024, h: 900 },
  { w: 1440, h: 900 },
];

fs.mkdirSync(OUT, { recursive: true });

let browser = await launchBrowser();
const report = [];

/**
 * Run one measurement, and survive the browser dying.
 *
 * The audit is twenty minutes of work. Another agent on this machine can take
 * the browser out from under it with a `pkill`, and the run then reported a
 * crash as if it were a result. That is the machine's condition, not the
 * site's. So a dead browser is relaunched and the measurement is retaken —
 * and only a measurement that cannot be taken after three tries is reported
 * as a failure to measure.
 */
async function measureOne(route, vp, tag) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let ctx = null;
    try {
      ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: vp.w < 700,
        hasTouch: vp.w < 700,
      });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await assertOtop(page, `${tag} @${vp.w}px`);
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      // The Find view streams the whole registry; a half-loaded page is not
      // the page, so wait for the count the build claims. The selector was
      // `.find-stats strong` until that class was renamed to
      // `.find-panel-stats dd` — and because the old wait returned TRUE when
      // it found nothing, it passed instantly and the audit measured a find
      // view that had not finished arriving. The wait now names the class
      // that exists, and a view with no count at all is a FAIL, not a pass.
      const counted = await page
        .waitForFunction(
          () => {
            const el = document.querySelector('.find-panel-stats dd');
            if (!el) return false;
            return Number(el.textContent.replace(/[^\d]/g, '')) > 100000;
          },
          { timeout: 90000 },
        )
        .then(() => true)
        .catch(() => false);
      if (tag === 'find' && !counted) {
        throw new Error(
          'the find view never showed its producer count — the chrome cost and the ' +
            'first action would be recorded for a page that had not arrived',
        );
      }
      await page.waitForTimeout(800);

      // The registry streams 77 shards. Measure a page that has finished
      // arriving, or the reading priorities recorded here are the ones of a
      // half-built page.
      let last = -1;
      let stable = 0;
      for (let i = 0; i < 60; i++) {
        const n = await page.evaluate(() => document.querySelectorAll('body *').length);
        if (n === last) {
          if (++stable >= 3) break;
        } else {
          stable = 0;
          last = n;
        }
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(400);

      const top = await page.evaluate(measure);
      await page.screenshot({ path: path.join(OUT, `${tag}-${vp.w}.png`), fullPage: false });

      // Now scroll, and measure again. Chrome that is harmless at rest can
      // take the phone once the reader starts reading.
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(500);
      const scrolled = await page.evaluate(measure);
      await page.screenshot({ path: path.join(OUT, `${tag}-${vp.w}-scrolled.png`), fullPage: false });
      await ctx.close();
      return { top, scrolled };
    } catch (e) {
      last = e;
      try {
        await ctx?.close();
      } catch {
        /* the context was never opened, or the browser is already gone */
      }
      // Is the browser still alive? If not, start a new one.
      let alive = false;
      try {
        alive = browser.isConnected();
      } catch {
        alive = false;
      }
      if (!alive) {
        console.error(`  · the browser died measuring ${tag} @${vp.w}px — relaunching (attempt ${attempt})`);
        try {
          await browser.close();
        } catch {
          /* already gone */
        }
        browser = await launchBrowser();
      } else {
        console.error(`  · ${tag} @${vp.w}px failed (attempt ${attempt}): ${e.message}`);
      }
    }
  }
  throw last;
}

/** Runs in the page. Returns everything the law asks to be recorded. */
function measure() {
  const d = document.documentElement;
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const rect = (el) => el.getBoundingClientRect();

  // --- chrome: every fixed or sticky band, stacked -----------------------
  const chrome = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
    const r = rect(el);
    if (!r.height) continue;
    // A band parked outside the viewport horizontally is not chrome anyone
    // pays for.
    if (r.right <= 0 || r.left >= vw) continue;
    chrome.push({
      sel: el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/)[0],
      pos: cs.position,
      z: cs.zIndex,
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
    });
  }
  chrome.sort((a, b) => a.top - b.top);

  // A sticky band that starts under another sticky band is hidden behind it
  // and still occupies the screen. That is chrome charged but not seen.
  const occluded = [];
  for (let i = 0; i < chrome.length; i++) {
    for (let j = 0; j < i; j++) {
      if (chrome[j].bottom > chrome[i].top + 1 && chrome[i].h > 4) {
        const above = chrome[j];
        const hidden = Math.min(above.bottom, chrome[i].bottom) - chrome[i].top;
        if (hidden > 4) {
          occluded.push({
            band: chrome[i].sel,
            under: above.sel,
            hiddenPx: Math.round(hidden),
            bandH: chrome[i].h,
          });
        }
      }
    }
  }

  // --- the first thing a person can DO ----------------------------------
  const sel = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  let firstAction = null;
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (Number(cs.opacity) === 0) continue;
    const r = rect(el);
    if (!r.width || !r.height) continue;
    if (r.top < 0 || r.top > vh) continue;
    if (r.right <= 0 || r.left >= vw) continue; // off-canvas
    if (!firstAction || r.top < firstAction.y) {
      firstAction = {
        y: Math.round(r.top),
        sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : ''),
        text: (el.textContent || el.placeholder || '').trim().slice(0, 26),
      };
    }
  }

  // --- the heading, and what competes with it ---------------------------
  //
  // The title is the h1 AND everything inside it. A bilingual title is one
  // h1 holding two spans — the English line at the title's own size and the
  // Thai line at 0.78em — and those spans are not the page's competitor,
  // they ARE the title. Measured as competitors, the title was always
  // competing with itself and the audit could not tell a page with one
  // focal point from a page with two.
  const h1 = document.querySelector('main h1, .state h1, h1');
  const inTitle = (el) => Boolean(h1 && (el === h1 || h1.contains(el)));
  const titleSize = h1
    ? Math.max(
        parseFloat(getComputedStyle(h1).fontSize),
        ...Array.from(h1.querySelectorAll('*')).map((e) => parseFloat(getComputedStyle(e).fontSize)),
      )
    : 0;
  const sizes = [];
  for (const el of document.querySelectorAll('main *')) {
    if (!el.firstChild) continue;
    const t = (el.textContent || '').trim();
    if (!t || el.children.length) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 15) continue;
    if (inTitle(el)) continue;
    sizes.push({ fs, text: t.slice(0, 30) });
  }
  sizes.sort((a, b) => b.fs - a.fs);

  // --- the first, second and third reading priorities --------------------
  //
  // §6 asks for the INTENDED reading order and whether the screenshot makes
  // it apparent. The order is a fact about the page and can be measured: the
  // title first, then the loudest things in the body, by size, then weight,
  // then where they sit. Whether they LOOK like the priorities is a judgment
  // made by looking at the screenshot — this records the order so that
  // judgment has something to be judged against.
  const priorities = [];
  if (h1) {
    priorities.push({
      rank: 1,
      what: 'title',
      sel: 'h1',
      text: (h1.textContent || '').trim().slice(0, 40),
      fs: titleSize,
      y: Math.round(rect(h1).top + window.scrollY),
    });
  }
  const body = Array.from(document.querySelectorAll('main *'))
    .filter((el) => !el.children.length && !inTitle(el) && (el.textContent || '').trim())
    .map((el) => {
      const cs = getComputedStyle(el);
      return {
        fs: parseFloat(cs.fontSize),
        weight: Number(cs.fontWeight) || 400,
        text: (el.textContent || '').trim().slice(0, 40),
        sel: el.tagName.toLowerCase() + (el.getAttribute('class') ? '.' + String(el.getAttribute('class')).split(/\s+/)[0] : ''),
        y: Math.round(rect(el).top + window.scrollY),
      };
    })
    .filter((e) => e.fs >= 15 && e.weight >= 600)
    .sort((a, b) => b.fs - a.fs || b.weight - a.weight || a.y - b.y);
  for (const e of body) {
    if (priorities.length >= 3) break;
    if (priorities.some((p) => p.text === e.text && p.fs === e.fs)) continue;
    priorities.push({ rank: priorities.length + 1, what: 'body', ...e });
  }

  // The chrome cost: the vertical band the chrome occupies from the top of
  // the viewport, taken as the lowest bottom edge of any band that starts
  // at (or above) the top of the screen.
  const pinned = chrome.filter((c) => c.top <= 1);
  const chromeH = pinned.length ? Math.max(...pinned.map((c) => c.bottom)) : 0;

  return {
    vh,
    vw,
    scrollW: d.scrollWidth,
    clientW: d.clientWidth,
    chrome,
    chromeH,
    occluded,
    firstAction,
    h1: h1 ? { text: h1.textContent.trim().slice(0, 46), fs: parseFloat(getComputedStyle(h1).fontSize) } : null,
    titleSize,
    largest: sizes[0] || null,
    peers: sizes.filter((s) => s.fs === (sizes[0] || {}).fs).length,
    ratio: titleSize && sizes[0] ? Math.round((titleSize / sizes[0].fs) * 100) / 100 : null,
    priorities,
    docH: d.scrollHeight,
    scrollY: Math.round(window.scrollY),
  };
}

for (const [name, route, task] of VIEWS) {
  for (const vp of VIEWPORTS) {
    let taken;
    try {
      taken = await measureOne(route, vp, name);
    } catch (e) {
      console.error(`\nFAIL — ${name} @${vp.w}px could not be measured after three tries: ${e.message}\n`);
      fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 2));
      await browser.close();
      process.exit(1);
    }
    const { top, scrolled } = taken;

    report.push({
      view: name,
      task,
      w: vp.w,
      h: vp.h,
      chromeH: top.chromeH,
      chromePct: Math.round((top.chromeH / vp.h) * 100),
      chromeBands: top.chrome.map((c) => `${c.sel} ${c.h}px @${c.top} z${c.z}`),
      scrolledChromeH: scrolled.chromeH,
      scrolledChromePct: Math.round((scrolled.chromeH / vp.h) * 100),
      scrolledBands: scrolled.chrome.map((c) => `${c.sel} ${c.h}px @${c.top} z${c.z}`),
      occluded: [...top.occluded, ...scrolled.occluded],
      firstAction: top.firstAction,
      firstActionVisible: top.firstAction ? top.firstAction.y < vp.h : false,
      h1: top.h1,
      titleSize: top.titleSize,
      largest: top.largest,
      peers: top.peers,
      ratio: top.ratio,
      priorities: top.priorities,
      sideways: top.scrollW > top.clientW + 1,
      docH: top.docH,
    });
  }
}

fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 2));

let flags = 0;
for (const r of report) {
  const bad = r.sideways || r.occluded.length > 0 || r.scrolledChromePct > 35 || !r.firstActionVisible;
  if (bad) flags++;
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${r.view.padEnd(8)} @${String(r.w).padEnd(5)}` +
    ` chrome ${String(r.chromeH).padStart(4)}px (${String(r.chromePct).padStart(2)}%)` +
    `  scrolled ${String(r.scrolledChromeH).padStart(4)}px (${String(r.scrolledChromePct).padStart(2)}%)` +
    `  firstAction ${r.firstAction ? r.firstAction.y + 'px ' + r.firstAction.sel : 'none'}` +
    `  ${r.firstActionVisible ? 'on-screen' : 'BELOW FOLD'}` +
    `  h1 ${r.h1 ? r.h1.fs + 'px' : 'none'}  title ${r.titleSize}px  next ${r.largest ? r.largest.fs + 'px x' + r.peers : '-'}` +
    `  ratio ${r.ratio ?? '-'}` +
    `  sideways=${r.sideways}  doc ${r.docH}px`
  );
  for (const o of r.occluded) console.log(`       OCCLUDED: ${o.band} — ${o.hiddenPx}px of ${o.bandH}px hidden under ${o.under}`);
  if (r.priorities && r.priorities.length) {
    console.log(
      `       PRIORITIES: ${r.priorities
        .map((p) => `${p.rank}. ${p.what} ${p.fs}px "${p.text}"`)
        .join(' · ')}`,
    );
  }
}
console.log(`\n${report.length} measurements, ${flags} flagged. Screenshots in ${OUT}`);
await browser.close();
