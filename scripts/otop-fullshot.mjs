/**
 * Full-page screenshot, for judging a composition by eye.
 *
 *   node scripts/otop-fullshot.mjs <route> <width> <name> [scrollY]
 *
 * Writes /tmp/full-<name>.png
 */
import { assertOtop, launchBrowser } from './otop-identity.mjs';

const [route, w, name, y] = process.argv.slice(2);
const BASE = process.env.OTOP_BASE || 'http://localhost:8124';

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: Number(w), height: 1000 } });
const page = await ctx.newPage();
await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
await assertOtop(page, name);
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3500);
if (y) {
  await page.evaluate((yy) => window.scrollTo(0, Number(yy)), y);
  await page.waitForTimeout(800);
}
await page.screenshot({ path: `/tmp/full-${name}.png`, fullPage: !y });
console.log('wrote', `/tmp/full-${name}.png`);
await browser.close();
