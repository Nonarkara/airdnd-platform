/**
 * Section screenshot.
 *
 *   node scripts/otop-shot-section.mjs <route> <width> <name> <selector>
 *
 * Captures one element of a live view so a hole can be judged by eye
 * rather than by a number. Writes to /tmp/shot-<name>.png.
 */
import { assertOtop, launchBrowser } from './otop-identity.mjs';

const [route, w, name, sel] = process.argv.slice(2);
const BASE = process.env.OTOP_BASE || 'http://localhost:8124';

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: Number(w), height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
await assertOtop(page, name);
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);

const el = await page.$(sel);
if (!el) {
  console.log('NOT FOUND', sel);
} else {
  await el.screenshot({ path: `/tmp/shot-${name}.png` });
  console.log('wrote', `/tmp/shot-${name}.png`);
}
await browser.close();
