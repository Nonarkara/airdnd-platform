/**
 * DOM dump for one route at one width.
 *
 * Prints the geometry of a selector's children so a hole can be read
 * rather than guessed at.
 *
 * node scripts/otop-dom-dump.mjs <route> <width> <selector> [n]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/+$/, '');
const W = Number(process.argv[3] || 1440);
const SEL = process.argv[4] || 'body';
const N = Number(process.argv[5] || 1);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: W, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2500);

const data = await page.evaluate(({ SEL, N }) => {
  const out = [];
  const els = Array.from(document.querySelectorAll(SEL)).slice(0, N);
  for (const el of els) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    out.push({
      sel: el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/).join('.'),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      display: cs.display,
      cols: cs.gridTemplateColumns,
      areas: cs.gridTemplateAreas,
      rowGap: cs.rowGap,
      colGap: cs.columnGap,
      pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
      text: (el.textContent || '').trim().slice(0, 60),
      kids: Array.from(el.children).map((k) => {
        const kr = k.getBoundingClientRect();
        const kcs = getComputedStyle(k);
        return {
          sel: k.tagName.toLowerCase() + '.' + String(k.className || '').split(/\s+/).join('.'),
          rect: { x: Math.round(kr.x), y: Math.round(kr.y), w: Math.round(kr.width), h: Math.round(kr.height) },
          area: kcs.gridArea,
          col: kcs.gridColumn,
          row: kcs.gridRow,
          text: (k.textContent || '').trim().slice(0, 40),
        };
      }),
    });
  }
  return out;
}, { SEL, N });

console.log(JSON.stringify(data, null, 1));
await browser.close();
