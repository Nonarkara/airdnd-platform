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
import { chromium } from 'playwright';
import { assertOtop } from './otop-identity.mjs';

const BASE = (process.argv[2] || 'https://otop.pages.dev').replace(/\/+$/, '');
const ROUTES = [
  '/?view=find',
  '/?view=method',
  '/?view=atlas',
  '/?view=bank',
  '/?view=match&lens=b2c',
  '/?view=province&code=50',
  '/?view=champions',
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

const browser = await chromium.launch({ channel: 'chrome' });
let found = 0;
let gridsSeen = 0;

for (const route of ROUTES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    await assertOtop(page, `${route} @${w}px`);
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    await settle(page);

    const holes = await page.evaluate(() => {
      const STEP = 6;
      const MIN_AREA = 4000; // px² — a hole smaller than this is a gutter
      const MIN_H = 34;     // px — a band shorter than two lines is the end
                             // of a text line or a gutter, not an empty track
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
        // Both axes: a row gap separates two rows the same way a column gap
        // separates two columns, and an empty cell above an empty cell
        // across a declared gap is two ragged line ends, not one void.
        const trackStr = cs2.gridTemplateColumns;
        if (trackStr && trackStr !== 'none') {
          const tracks = trackStr.split(' ').map((v) => parseFloat(v)).filter((v) => !Number.isNaN(v));
          if (tracks.length > 1) {
            const gap = (boxW - tracks.reduce((a, b) => a + b, 0)) / (tracks.length - 1);
            if (gap > 0.5) {
              let x = 0;
              for (let i = 0; i < tracks.length - 1; i++) {
                x += tracks[i];
                const g0 = Math.max(0, Math.floor(x / STEP));
                const g1 = Math.min(cols - 1, Math.floor((x + gap) / STEP));
                for (let rr = 0; rr < rows; rr++) for (let cc = g0; cc <= g1; cc++) covered[rr * cols + cc] = 1;
                x += gap;
              }
            }
          }
        }
        const rowStr = cs2.gridTemplateRows;
        if (rowStr && rowStr !== 'none') {
          const rowTracks = rowStr.split(' ').map((v) => parseFloat(v)).filter((v) => !Number.isNaN(v));
          const rowGap = parseFloat(cs2.rowGap) || 0;
          if (rowTracks.length > 1 && rowGap > 0.5) {
            let y = 0;
            for (let i = 0; i < rowTracks.length - 1; i++) {
              y += rowTracks[i];
              const g0 = Math.max(0, Math.floor(y / STEP));
              const g1 = Math.min(rows - 1, Math.floor((y + rowGap) / STEP));
              for (let rr = g0; rr <= g1; rr++) for (let cc = 0; cc < cols; cc++) covered[rr * cols + cc] = 1;
              y += rowGap;
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

        if (best.area * STEP * STEP >= MIN_AREA && best.h * STEP >= MIN_H) {
          out.push({
            sel: cont.tagName.toLowerCase() + '.' + String(cont.className || '').split(/\s+/).slice(0, 2).join('.'),
            box: { w: Math.round(cr.width), h: Math.round(cr.height) },
            hole: { w: Math.round(best.w * STEP), h: Math.round(best.h * STEP), at: { x: Math.round(best.x * STEP), y: Math.round(best.y * STEP) } },
            area: best.area * STEP * STEP,
            kids: kids.length,
          });
        }
      }
      return { gridsSeen, holes: out.sort((a, b) => b.area - a.area).slice(0, 6) };
    });

    gridsSeen += holes.gridsSeen;
    if (holes.gridsSeen < 5) {
      console.log(`  !! ${route} @${w}px — only ${holes.gridsSeen} grid container(s) seen; the page may not have rendered`);
    }
    for (const h of holes.holes) {
      found++;
      console.log(
        `${route} @${w}px  ${h.sel}  box ${h.box.w}x${h.box.h} with ${h.kids} items` +
        ` → EMPTY ${h.hole.w}x${h.hole.h} at (${h.hole.at.x},${h.hole.at.y}) = ${(h.area / 1000).toFixed(0)}k px²`
      );
    }
    await ctx.close();
  }
}

console.log(
  found
    ? `\n${found} empty track(s) found across ${gridsSeen} grid containers.`
    : `\nno empty tracks found across ${gridsSeen} grid containers.`
);
await browser.close();
