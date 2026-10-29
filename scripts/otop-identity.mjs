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
 *
 * WHERE THE WORDMARK IS, DOES NOT MATTER — and that is the part this check
 * got wrong twice.
 *
 * First it keyed on the wordmark AT THE START of the title. Then the titles
 * changed, because a document about a subject should name the subject
 * first: "OTOP Thailand — the One Tambon One Product registry, complete |
 * one³". The brand moved to the end, and every instrument refused to
 * measure a site that was serving exactly the right bundle.
 *
 * Then it was changed to assert on the wordmark IN THE HEADER, which is
 * stronger and broke differently: the header does not exist until React has
 * loaded the index, so an audit refused to measure the very views it was
 * sent to measure, at the moment they were still loading.
 *
 * So the wordmark's POSITION is a copy decision that will change again, and
 * an identity check must not depend on it. What does not change is the
 * wordmark itself — and, more usefully, the PUBLISHER MARKER in the served
 * HTML, which is present from the first byte, whether or not the app has
 * painted, and which no stranger's page on the same port carries.
 */
export const OTOP_TITLE = 'one³';

/**
 * The marker each site's own shell carries.
 *
 * The one³ pages carry the publisher's structured data in their head, with
 * this id. It is in the HTML the server sends, before a single line of
 * JavaScript runs.
 */
export const SITE_MARKERS = {
  otop: 'otop.nonarkara.org/#publisher',
  sabai: 'sabaisabai',
};

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
  const marker = SITE_MARKERS[site.key];

  // WITNESS ONE — the shell. The publisher's own marker, in the HTML the
  // server sends. Present from the first byte, present whether or not the
  // app has painted, and absent from a stranger's page on the same port.
  //
  // WITNESS TWO — the title, carrying the wordmark SOMEWHERE. Not at the
  // start: where the brand sits in a title is a copy decision, and this
  // check has already broken twice on that.
  //
  // Both must agree. A page with the right title and the wrong shell is
  // not this site; a page with the right shell and no title is not a
  // document.
  const shell = marker
    ? await page.evaluate((m) => document.documentElement.innerHTML.includes(m), marker)
    : true;

  if (!shell) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the page carries no ${site.key} ` +
        `publisher marker, so it is not the ${site.key} site.\n` +
        `Either another process is holding the port, or the build in front of it is not ` +
        `this one. Start the right preview on a free port and point the instrument at that.`
    );
  }
  if (!title.includes(identity)) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the server answered ` +
        `with "${title}", which does not carry "${identity}" and so is ` +
        `not the ${site.key} site.\n` +
        `Another process is holding the port. Start the right preview on a free ` +
        `port and point the instrument at that.`
    );
  }
  return title;
}
