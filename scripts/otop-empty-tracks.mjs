/**
 * Empty-track probe.
 *
 * The spatial instrument measures the geometry of OCCUPIED cells: a hole
 * between two rows, a short cell stranded beside a tall one, a row that
 * breaks. It cannot see a grid track that holds nothing — the space is
 * real, the reader sees it, and no element is there to be measured. A
 * 3-column grid holding 7 items leaves a two-cell hole in its last row
 * and the instrument reports nothing.
 *
 * This rasterises each grid container, marks the cells its items cover,
 * and reports the largest uncovered rectangle inside it.
 *
 * node scripts/otop-empty-tracks.mjs [base]
 */

import { assertOtop, launchBrowser } from './otop-identity.mjs';

const BASE = (process.argv[2] || 'https://otop.nonarkara.org').replace(/\/+$/, '');
// Every view. The probe used to cover seven of fourteen, so a view the
// gate measured and the probe did not was a view nobody had a hole receipt
// for — and the soft-power monitor, the newest surface on the site, was
// never probed at all. The probe and the gate now cover the same set.
const ROUTES = [
  '/?view=find',
  '/?view=match&lens=b2c',
  '/?view=atlas',
  '/?view=province&code=50',
  '/?view=matchmaker',
  '/?view=briefs',
  '/?view=tides',
  '/?view=champions',
  '/?view=story',
  '/?view=history',
  '/?view=crossrefs',
  '/?view=bank',
  '/?view=method',
  '/?view=softpower',
];
const WIDTHS = [390, 1024, 1440];

/** Wait until the page stops changing. The registry streams 77 shards; a
 *  probe that measures a half-loaded page reports the holes of a page that
 *  does not exist yet. */
async function settle(page) {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('body *').length);
    if (n === last) {
      if (++stable >= 3) return;
    } else {
      stable = 0;
      last = n;
    }
    await page.waitForTimeout(250);
  }
}

let browser = await launchBrowser();
let found = 0;
let gridsSeen = 0;

/**
 * The hole measurement itself, run inside the page.
 */
function PROBE_HOLES() {

    const STEP = 6;
    const MIN_AREA = 4000; // px² — a hole smaller than this is a gutter
    const MIN_H = 34;     // px — a band shorter than two lines is the end
                           // of a text line or a gutter, not an empty track
    const MIN_W = 24;     // px — a slot NARROWER than this is not a hole
                           // either. It is the gap between two tracks, and a
                           // gap is declared spacing, not a void. The rule
                           // has to say what it is about: an empty region
                           // of a CELL. A 12px slot running 600px down a
                           // column is the gutter between two columns of a
                           // grid, and the crossrefs view has one — it was
                           // reported as a hole until the probe learned
                           // the difference between a gutter and a void.
    const out = [];
    let gridsSeen = 0;

    const visible = (el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    for (const cont of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(cont);
      if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue;
      const kids = Array.from(cont.children).filter(visible);
      if (kids.length < 2) continue;

      const cr = cont.getBoundingClientRect();
      if (cr.width < 80 || cr.height < 40) continue;
      gridsSeen++;

      // The container's own padding is a declared inset, not a hole. Only
      // the content box is measured.
      const cs2 = getComputedStyle(cont);
      const padL = parseFloat(cs2.paddingLeft) || 0;
      const padR = parseFloat(cs2.paddingRight) || 0;
      const padT = parseFloat(cs2.paddingTop) || 0;
      const padB = parseFloat(cs2.paddingBottom) || 0;
      const boxL = cr.left + padL;
      const boxT = cr.top + padT;
      const boxW = Math.max(1, cr.width - padL - padR);
      const boxH = Math.max(1, cr.height - padT - padB);

      const cols = Math.ceil(boxW / STEP);
      const rows = Math.ceil(boxH / STEP);
      if (cols * rows > 400000) continue;
      const covered = new Uint8Array(cols * rows);
      for (const k of kids) {
        const r = k.getBoundingClientRect();
        const c0 = Math.max(0, Math.floor((r.left - boxL) / STEP));
        const c1 = Math.min(cols - 1, Math.floor((r.right - boxL) / STEP));
        const r0 = Math.max(0, Math.floor((r.top - boxT) / STEP));
        const r1 = Math.min(rows - 1, Math.floor((r.bottom - boxT) / STEP));
        for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) covered[rr * cols + cc] = 1;
      }

      // A declared gap is the container's own spacing, like padding — not an
      // empty track. Mark the gap bands so they are not read as holes.
      //
      // The band is measured BETWEEN THE ITEMS, not derived from the track
      // list. Three reasons: justify-content: space-between spreads the
      // free space far wider than the declared gap; auto-fit collapses its
      // empty tracks to zero width and takes their gaps with them; and a
      // grid whose items are shorter than their tracks leaves real space
      // that is spacing, not a hole. Two items that sit side by side with
      // nothing between them are separated by spacing.
      //
      // Only the horizontal axis is treated this way. A short item beside
      // a tall one leaves its void BELOW it, in its own column — that is
      // the failure this instrument exists to find, and it must stay
      // visible.
      const placed = kids
        .map((k) => k.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .sort((a, b) => a.left - b.left);
      for (let i = 0; i < placed.length - 1; i++) {
        const a = placed[i];
        const b = placed[i + 1];
        const left = a.right;
        const right = b.left;
        if (right - left < 1) continue;
        const top = Math.max(a.top, b.top, boxT);
        const bottom = Math.min(a.bottom, b.bottom, boxT + boxH);
        if (bottom - top < 1) continue;
        const g0 = Math.max(0, Math.floor((left - boxL) / STEP));
        const g1 = Math.min(cols - 1, Math.floor((right - boxL) / STEP));
        const r0 = Math.max(0, Math.floor((top - boxT) / STEP));
        const r1 = Math.min(rows - 1, Math.floor((bottom - boxT) / STEP));
        for (let rr = r0; rr <= r1; rr++) for (let cc = g0; cc <= g1; cc++) covered[rr * cols + cc] = 1;
      }
      const rowStr = cs2.gridTemplateRows;
      if (rowStr && rowStr !== 'none') {
        const rowTracks = rowStr.split(' ').map((v) => parseFloat(v)).filter((v) => !Number.isNaN(v));
        const rowGap = parseFloat(cs2.rowGap) || 0;
        if (rowTracks.length > 1 && rowGap > 0.5) {
          let y = 0;
          for (let i = 0; i < rowTracks.length - 1; i++) {
            y += rowTracks[i];
            if (rowTracks[i] > 0.5 && rowTracks[i + 1] > 0.5) {
              const g0 = Math.max(0, Math.floor(y / STEP));
              const g1 = Math.min(rows - 1, Math.floor((y + rowGap) / STEP));
              for (let rr = g0; rr <= g1; rr++) for (let cc = 0; cc < cols; cc++) covered[rr * cols + cc] = 1;
              y += rowGap;
            }
          }
        }
      }

      // The largest all-empty rectangle, by the classic histogram method.
      const heights = new Int32Array(cols);
      let best = { area: 0, w: 0, h: 0, x: 0, y: 0 };
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) heights[cc] = covered[rr * cols + cc] ? 0 : heights[cc] + 1;
        const stack = [];
        for (let cc = 0; cc <= cols; cc++) {
          const h = cc === cols ? 0 : heights[cc];
          while (stack.length && heights[stack[stack.length - 1]] >= h) {
            const top = stack.pop();
            const height = heights[top];
            const left = stack.length ? stack[stack.length - 1] + 1 : 0;
            const area = height * (cc - left);
            if (area > best.area) best = { area, w: cc - left, h: height, x: left, y: rr - height + 1 };
          }
          stack.push(cc);
        }
      }

      if (best.area * STEP * STEP >= MIN_AREA && best.h * STEP >= MIN_H && best.w * STEP >= MIN_W) {
        out.push({
          sel: cont.tagName.toLowerCase() + '.' + String(cont.className || '').split(/\s+/).slice(0, 2).join('.'),
          box: { w: Math.round(cr.width), h: Math.round(cr.height) },
          hole: { w: Math.round(best.w * STEP), h: Math.round(best.h * STEP), at: { x: Math.round(best.x * STEP), y: Math.round(best.y * STEP) } },
          area: best.area * STEP * STEP,
          kids: kids.length,
        });
      }
    }
    return { gridsSeen, elements: document.querySelectorAll('body *').length, holes: out.sort((a, b) => b.area - a.area).slice(0, 6) };
}

/**
 * The browser can die mid-sweep — another agent on this machine takes
 * Chrome out with a pkill, and the probe then reports a crash as if it
 * were a result. That is the machine's condition, not the site's. So a
 * dead browser is relaunched and the measurement retaken; only a
 * measurement that cannot be taken after three tries is reported as a
 * failure to measure.
 */
async function probeRoute(route, w) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let ctx = null;
    try {
      ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await assertOtop(page, `${route} @${w}px`);
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      await settle(page);
      const holes = await page.evaluate(PROBE_HOLES);
      await ctx.close();
      return holes;
    } catch (e) {
      try {
        await ctx?.close();
      } catch {
        /* the context was never opened, or the browser is already gone */
      }
      let alive = false;
      try {
        alive = browser.isConnected();
      } catch {
        alive = false;
      }
      if (!alive) {
        console.error(`  · the browser died measuring ${route} @${w}px — relaunching (attempt ${attempt})`);
        try {
          await browser.close();
        } catch {
          /* already gone */
        }
        browser = await launchBrowser();
      } else {
        console.error(`  · ${route} @${w}px failed (attempt ${attempt}): ${e.message}`);
      }
    }
  }
  throw new Error(`${route} @${w}px could not be measured after three tries`);
}

for (const route of ROUTES) {
  for (const w of WIDTHS) {
    const holes = await probeRoute(route, w);

    gridsSeen += holes.gridsSeen;
    // A page that did not render has no holes, so a clean probe on an empty
    // page is a clean probe on nothing. The question is not "are there many
    // grids" — the atlas page has two, and that is what the atlas IS — but
    // "did the page arrive". So the warning is about the page, and the grid
    // count is reported as what there was to measure.
    if (holes.elements < 50) {
      console.log(`  !! ${route} @${w}px — only ${holes.elements} element(s) in the page; the page may not have rendered`);
    } else if (holes.gridsSeen < 5) {
      console.log(`  · ${route} @${w}px — ${holes.gridsSeen} grid container(s) to measure; the page rendered (${holes.elements} elements)`);
    }
    for (const h of holes.holes) {
      found++;
      console.log(
        `${route} @${w}px  ${h.sel}  box ${h.box.w}x${h.box.h} with ${h.kids} items` +
        ` → EMPTY ${h.hole.w}x${h.hole.h} at (${h.hole.at.x},${h.hole.at.y}) = ${(h.area / 1000).toFixed(0)}k px²`
      );
    }
  }
}

console.log(
  found
    ? `\n${found} empty track(s) found across ${gridsSeen} grid containers.`
    : `\nno empty tracks found across ${gridsSeen} grid containers.`
);
await browser.close();
