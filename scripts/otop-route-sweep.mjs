/**
 * Route sweep.
 *
 * Every view the nav can reach, loaded in a real browser, asserting:
 *   1. the page identifies itself as the one³ OTOP app;
 *   2. React threw nothing (a hooks-order violation tears the whole tree
 *      down and leaves an empty <div id="root">);
 *   3. the view actually rendered — a heading, real text, no empty body.
 *
 * A nav link that lands on a blank page is a shippability failure, and no
 * build or HTTP status will show it. The Champions view shipped broken for
 * exactly this reason: it 200'd, it built, and it rendered nothing.
 *
 * node scripts/otop-route-sweep.mjs [base]
 */
import { chromium } from 'playwright';
import { assertOtop } from './otop-identity.mjs';

const BASE = (process.argv[2] || 'http://localhost:8124').replace(/\/+$/, '');

const ROUTES = [
  ['find', '/?view=find'],
  ['match', '/?view=match&lens=b2c'],
  ['atlas', '/?view=atlas'],
  ['province', '/?view=province&code=50'],
  ['matchmaker', '/?view=matchmaker'],
  ['briefs', '/?view=briefs'],
  ['tides', '/?view=tides'],
  ['champions', '/?view=champions'],
  ['story', '/?view=story'],
  ['history', '/?view=history'],
  ['crossrefs', '/?view=crossrefs'],
  ['bank', '/?view=bank'],
  ['method', '/?view=method'],
];

const browser = await chromium.launch({ channel: 'chrome' });
let bad = 0;

for (const [name, route] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  let note = '';
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await assertOtop(page, name);
    await page.waitForTimeout(5000);
    const info = await page.evaluate(() => ({
      rootKids: document.getElementById('root')?.children.length ?? -1,
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? null,
      text: (document.getElementById('root')?.innerText || '').trim().length,
    }));
    const reactErrors = errors.filter((e) => /react|error #/i.test(e));
    if (reactErrors.length) note = `REACT: ${reactErrors[0].slice(0, 90)}`;
    else if (info.rootKids === 0) note = 'EMPTY — nothing rendered';
    else if (!info.h1) note = 'no h1';
    else if (info.text < 80) note = `thin: ${info.text} chars`;
    else note = `${info.text} chars, h1 "${info.h1}"`;
  } catch (e) {
    note = `THREW: ${e.message.split('\n')[0].slice(0, 90)}`;
  }

  const fail = note.startsWith('REACT') || note.startsWith('EMPTY') || note.startsWith('THREW') || note.startsWith('no h1') || note.startsWith('thin');
  if (fail) bad++;
  console.log(`${fail ? 'FAIL' : 'ok  '} ${name.padEnd(12)} ${note}`);
  await ctx.close();
}

console.log(bad ? `\n${bad} route(s) failed.` : `\nall ${ROUTES.length} routes rendered.`);
await browser.close();
process.exit(bad ? 1 : 0);
