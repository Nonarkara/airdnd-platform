#!/usr/bin/env node
/**
 * THE CARD.
 *
 * When the site is shared in a message, or listed by a search engine, what
 * appears is not the site — it is one 1200×630 image. So it has to be worth
 * looking at, and it has to say what the site is.
 *
 * It is drawn from the same ingredients as the site: the paper, the ink, the
 * accent, and a data row. No stock photography, no gradient, no card with a
 * drop shadow. A card that has to sell the site should look like the site.
 *
 *   node scripts/otop-og.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = path.resolve('otop/public/og');
fs.mkdirSync(OUT, { recursive: true });

const meta = JSON.parse(fs.readFileSync('otop/public/otop_meta.json', 'utf8'));
const records = meta?.counts?.recordsAfterMerge ?? 154050;

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Sao Chingcha'; src: url('file://${path.resolve('otop/public/fonts/SaoChingcha-Bold.otf')}') format('opentype'); font-weight: 700; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #fdf3df; color: #1f0e0a;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 56px 64px;
  }
  .top { display: flex; justify-content: space-between; align-items: baseline; }
  .mark { font-size: 40px; font-weight: 700; letter-spacing: -.02em; white-space: nowrap; }
  .mark .mid { color: #c99518; }
  .src { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 15px; letter-spacing: .12em; text-transform: uppercase; color: #8a6645; }
  /* The stack of content under the header.
     It is NOT called .mid: the wordmark's superscript is .mid, and one class
     cannot mean two things in one stylesheet — when it did, the rule below
     made the superscript a flex column and broke "one³" onto two lines. */
  .stack { display: flex; flex-direction: column; gap: 22px; }
  h1 { font-size: 60px; line-height: 1.08; letter-spacing: -.025em; font-weight: 700; max-width: 28ch; }
  h1 em { font-style: normal; color: #8b1a1a; }
  .row {
    display: flex; align-items: baseline; justify-content: space-between;
    border-top: 1px solid #1f0e0a; padding-top: 12px; margin-top: 6px;
  }
  .row .k { font-size: 20px; color: #5a3625; letter-spacing: .04em; }
  .row .v { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 30px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .row .v .th { font-family: 'Sao Chingcha', sans-serif; font-size: 19px; color: #5a3625; margin-left: 10px; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; font-size: 19px; color: #5a3625; }
  .foot .url { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 17px; letter-spacing: .04em; }
  .rule { height: 5px; background: #c99518; width: 84px; }
</style></head>
<body>
  <div class="top">
    <div class="mark">one<span class="mid">³</span></div>
    <div class="src">data.go.th · Department of Community Development</div>
  </div>
  <div class="stack">
    <h1>Thailand's <em>OTOP</em> registry, read as one dataset.</h1>
    <div class="row">
      <span class="k">Registered producers</span>
      <span class="v">${records.toLocaleString()}<span class="th">ผู้ผลิตที่ลงทะเบียน</span></span>
    </div>
    <div class="row">
      <span class="k">History · criticism · numbers · the raw data</span>
      <span class="v">77<span class="th">จังหวัด</span></span>
    </div>
  </div>
  <div class="foot">
    <span>One Tambon, One Product, One Platform</span>
    <span class="url">otop.nonarkara.org</span>
  </div>
  <div class="rule"></div>
</body></html>`;

const tmp = path.join('/tmp', 'otop-og.html');
fs.writeFileSync(tmp, HTML, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + tmp, { waitUntil: 'load' });
await page.waitForTimeout(400);
const file = path.join(OUT, 'otop.png');
await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
