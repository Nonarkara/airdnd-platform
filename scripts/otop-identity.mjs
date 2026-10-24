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

import { chromium } from 'playwright';

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
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return await chromium.launch();
  }
}

export async function assertOtop(page, label = '') {
  const title = await page.title();
  if (!title.startsWith(OTOP_TITLE)) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the server answered ` +
        `with "${title}", which does not begin with the one³ wordmark and so is ` +
        `not the one³ app.\n` +
        `Another process is holding the port. Start the one³ preview on a free ` +
        `port and point the instrument at that.`
    );
  }
  return title;
}
