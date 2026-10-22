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

export const OTOP_TITLE = 'OTOP registry intelligence';

export async function assertOtop(page, label = '') {
  const title = await page.title();
  if (!title.includes(OTOP_TITLE)) {
    throw new Error(
      `REFUSING TO MEASURE${label ? ` (${label})` : ''}: the server answered ` +
        `with "${title}", which is not the one³ OTOP app.\n` +
        `Another process is holding the port. Start the OTOP preview on a free ` +
        `port and point the instrument at that.`
    );
  }
  return title;
}
