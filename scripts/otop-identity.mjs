/**
 * Identity assertion for the MSH instruments.
 *
 * A probe that measures the wrong page and reports "clean" is worse than no
 * probe. It happened: port 8080 was held by an unrelated local server, the
 * empty-track probe found zero grids in that stranger's splash page, and the
 * result read as a pass.
 *
 * Every instrument asserts the page identifies itself before it measures.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { activeSite } from './msh/sites.mjs';

/**
 * The identity of the site is its BRAND, not its strapline.
 *
 * This constant used to be "OTOP registry intelligence" — a marketing phrase
 * that changed when the platform became Thailand's soft-power monitor, and
 * every instrument refused to measure the live site until it was updated.
 * A gate that breaks whenever the copy changes is a gate that will be
 * "fixed" by weakening it, so the check now names the thing that does not
 * change: the wordmark.
 */
export const OTOP_TITLE = 'one³';

/**
 * Google Chrome if it is installed, Playwright's bundled Chromium otherwise.
 * CI installs only the bundled one, and a gate that cannot start a browser
 * is a gate that never runs.
 */
export async function launchBrowser() {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    // CHROMIUM_PATH, or a preinstalled Chromium when Playwright's own build
    // is a different revision (as on the cloud sandboxes).
    const path = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
    browser = await chromium.launch(path ? { executablePath: path } : {});
  }
  // MSH_OFFLINE=1: refuse every request that leaves the machine, so a page
  // measured on a sandbox settles instead of waiting on hosts it cannot
  // reach. The geometry measured is the page's own; tiles and analytics
  // beacons are not part of it.
  if (process.env.MSH_OFFLINE === '1') {
    const open = browser.newContext.bind(browser);
    browser.newContext = async (options) => {
      const context = await open(options);
      await context.route((url) => !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url.href), (route) => route.abort());
      return context;
    };
  }
  return browser;
}

export async function assertOtop(page, label = '') {
  const site = activeSite();
  const identity = site.key === 'otop' ? OTOP_TITLE : site.identity;
  const title = await page.title();
  if (!title.startsWith(identity)) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the server answered ` +
        `with "${title}", which does not begin with "${identity}" and so is ` +
        `not the ${site.key} site.\n` +
        `Another process is holding the port. Start the right preview on a free ` +
        `port and point the instrument at that.`
    );
  }
  return title;
}
