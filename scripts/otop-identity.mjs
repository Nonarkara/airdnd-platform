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
 * The identity of the site is its BRAND, not its strapline, and not the
 * POSITION of the brand in a title.
 *
 * This constant used to be "OTOP registry intelligence" — a marketing phrase
 * that changed when the platform became Thailand's soft-power monitor, and
 * every instrument refused to measure the live site until it was updated.
 * Then it became the wordmark, checked at the START of the title — and the
 * titles changed again, because a document about a subject should name the
 * subject first ("OTOP Thailand — the One Tambon One Product registry,
 * complete | one³"), with the brand second.
 *
 * So the brand moved, and the guard broke again. That is the third time this
 * check has been right about WHAT to look for and wrong about WHERE. The
 * lesson is not "update the constant": it is that the brand's POSITION in a
 * title is a copy decision that will change again.
 *
 * WHAT THE IDENTITY IS CHECKED AGAINST
 *
 * Two witnesses, and both must agree:
 *
 *   · THE SHELL. Every page of this app carries the publisher's structured
 *     data in its head — `https://otop.nonarkara.org/#publisher`. It is in
 *     the HTML the server sends, before a single line of JavaScript runs,
 *     so it is present whether the app has painted or is still loading.
 *     A stranger's page on the same port has no such marker.
 *
 *   · THE TITLE, which carries the wordmark somewhere.
 *
 * The header's wordmark is deliberately NOT the witness. It looked like the
 * strongest signal — it is the app's own markup — but it only exists after
 * React has loaded the index, so an audit that asserted on it refused to
 * measure the very views it was sent to measure, at the moment they were
 * still loading. An identity check that depends on the page having
 * finished is an identity check that fails for the wrong reason, and a
 * failure for the wrong reason is a failure an agent "fixes" by removing
 * the check.
 */
export const OTOP_TITLE = 'one³';

/**
 * A marker that only this application's own shell carries.
 */
export const OTOP_SHELL_MARK = 'otop.nonarkara.org/#publisher';

/**
 * Assert the page is the one³ app, and return its title.
 */
export async function assertOtop(page, label = '') {
  const title = await page.title();
  const shell = await page.evaluate((mark) => document.documentElement.innerHTML.includes(mark), OTOP_SHELL_MARK);

  if (!shell) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the page carries no one³ publisher ` +
        `marker, so it is not the one³ app.\n` +
        `Either another process is holding the port, or the build in front of it is not ` +
        `this one. Start the one³ preview on a free port and point the instrument at that.`,
    );
  }
  if (!title.includes(OTOP_TITLE)) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the server answered ` +
        `with "${title}", which does not carry the one³ wordmark and so is ` +
        `not the one³ app.\n` +
        `Another process is holding the port. Start the one³ preview on a free ` +
        `port and point the instrument at that.`,
    );
  }
  return title;
}

/**
 * Google Chrome if it is installed, Playwright's bundled Chromium otherwise.
 * CI installs only the bundled one, and a gate that cannot start a browser
 * is a gate that never runs.
 */
export async function launchBrowser() {
  try {
    return await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
  } catch {
    return await chromium.launch();
  }
}
