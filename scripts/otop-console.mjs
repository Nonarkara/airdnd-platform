import { chromium } from 'playwright';
import { assertOtop } from './otop-identity.mjs';
const route = process.argv[2] || '/?view=champions';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:8124' + route, { waitUntil: 'domcontentloaded' });
await assertOtop(page, route);
await page.waitForTimeout(6000);
const info = await page.evaluate(() => ({
  rootChildren: document.getElementById('root')?.children.length ?? -1,
  bodyText: (document.body.innerText || '').slice(0, 300),
  h1: document.querySelector('h1')?.textContent ?? null,
  html: document.getElementById('root')?.innerHTML.slice(0, 300) ?? null,
}));
console.log(JSON.stringify(info, null, 1));
console.log('--- console ---');
console.log(logs.slice(0, 20).join('\n'));
await browser.close();
