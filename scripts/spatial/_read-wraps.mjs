/**
 * EVERY instance of a selector, and whether its last band is filled.
 * node scripts/spatial/_read-wraps.mjs [base]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8124').replace(/\/+$/, '');

const CASES = [
  ['briefs', '/briefs/', 479, '.bf-gauges'],
  ['champions', '/champions/', 360, '.ch-ctrl-grp'],
  ['champions', '/champions/', 638, '.ch-controls'],
  ['history', '/history/', 360, '.hs-scores'],
  ['history', '/history/', 558, '.hs-photo-nav'],
  ['matchmaker', '/matchmaker/', 360, '.mm-row-h'],
  ['matchmaker', '/matchmaker/', 558, '.mm-ctrl-grp'],
  ['matchmaker', '/matchmaker/', 859, '.mm-row-meters'],
  ['matchmaker', '/matchmaker/', 1440, '.mm-controls'],
  ['softpower', '/softpower/', 360, '.sp-src'],
  ['story', '/story/', 360, '.ns-stats'],
];

const browser = await chromium.launch();

for (const [view, route, w, sel] of CASES) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const info = await p.evaluate((sel) => {
    const hosts = [...document.querySelectorAll('main ' + sel)];
    return hosts.map((host, hi) => {
      const hr = host.getBoundingClientRect();
      const kids = [...host.children].filter((k) => {
        const cs = getComputedStyle(k);
        const r = k.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width && r.height;
      });
      const items = kids.map((k) => {
        const r = k.getBoundingClientRect();
        return {
          cls: String(k.getAttribute('class') || '').split(/\s+/).slice(0, 2).join('.'),
          top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          grow: getComputedStyle(k).flexGrow,
        };
      });
      const sorted = items.slice().sort((a, b) => a.top - b.top);
      const bands = [];
      for (const it of sorted) {
        const last = bands[bands.length - 1];
        if (last && it.top < last.bottom - 4) {
          last.items.push(it);
          last.bottom = Math.max(last.bottom, it.top + it.h);
        } else bands.push({ items: [it], top: it.top, bottom: it.top + it.h });
      }
      const last = bands[bands.length - 1];
      const lastWidth = last ? last.items.reduce((s, i) => s + i.w, 0) : 0;
      return {
        hi,
        container: Math.round(hr.width),
        n: items.length,
        bands: bands.length,
        lastN: last ? last.items.length : 0,
        lastWidth,
        lastFill: hr.width ? Math.round((lastWidth / hr.width) * 100) : 0,
        lastItems: last ? last.items.map((i) => `${i.cls}[${i.w},g${i.grow}]`) : [],
        all: items.map((i) => `${i.cls}[${i.w},g${i.grow}]`),
      };
    });
  }, sel);
  console.log(`\n${view} @${w} ${sel}  — ${info.length} instance(s)`);
  for (const h of info) {
    const stranded = h.lastN === 1 && h.lastFill < 50;
    console.log(
      `   #${h.hi} container=${h.container} items=${h.n} bands=${h.bands} lastBand=${h.lastN} fill=${h.lastFill}% ${stranded ? ' <-- STRANDED' : ''}`,
    );
    console.log(`        all: ${h.all.join(' ')}`);
    if (stranded) console.log(`        last: ${h.lastItems.join(' ')}`);
  }
  await c.close();
}
await browser.close();
