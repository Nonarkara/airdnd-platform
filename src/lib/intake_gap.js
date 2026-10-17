// Catch-up planning for the Telegram intake.
//
// The live scraper reads only the newest `fetchLimit` messages per channel and
// keeps everything newer than the last id it saw. If the daemon is down long
// enough for a channel to post more than `fetchLimit` messages, the ones that
// scrolled out of that window are never fetched again: the next run records the
// new high-water mark and the gap is silently lost. This module makes that gap
// visible and tells the scraper how far back to page to close it.
//
// Pure functions, no I/O, so they can be unit-tested without a Telegram session.

/**
 * Decide whether the newest page of messages actually reaches back to the last
 * message we processed.
 *
 * @param {Array<{id:number}>|number[]} fetched  newest page (messages or ids)
 * @param {number} lastSeenId  high-water mark from the previous run (0 = first run)
 * @returns {{ hasGap:boolean, oldestFetchedId:number, missingBelow:number }}
 *   `missingBelow` is the id the next page must reach (exclusive lower bound).
 */
export function detectIntakeGap(fetched, lastSeenId = 0) {
  const ids = (Array.isArray(fetched) ? fetched : [])
    .map((m) => (typeof m === 'number' ? m : Number(m?.id)))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0 || !(lastSeenId > 0)) {
    // First run, or nothing fetched: there is no window to have scrolled past.
    return { hasGap: false, oldestFetchedId: ids.length ? Math.min(...ids) : 0, missingBelow: 0 };
  }

  const oldestFetchedId = Math.min(...ids);
  // Telegram ids are per-channel and monotonic. If the oldest message on the
  // newest page is still newer than the last one we processed, everything
  // between them was posted while we were not looking.
  const hasGap = oldestFetchedId > lastSeenId + 1;
  return { hasGap, oldestFetchedId, missingBelow: hasGap ? oldestFetchedId : 0 };
}

/**
 * Merge the newest page with catch-up pages, keeping only messages newer than
 * the high-water mark, de-duplicated by id, oldest first.
 */
export function mergeCatchUpPages(pages, lastSeenId = 0) {
  const byId = new Map();
  for (const page of Array.isArray(pages) ? pages : []) {
    for (const message of Array.isArray(page) ? page : []) {
      const id = Number(message?.id);
      if (Number.isFinite(id) && id > lastSeenId && !byId.has(id)) {
        byId.set(id, message);
      }
    }
  }
  return [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

/**
 * How many extra pages a catch-up may fetch. A hard ceiling keeps a channel
 * that posted tens of thousands of messages during a long outage from turning
 * one poll into a full history crawl; that is `backfill_history.js`'s job.
 */
export const CATCH_UP_MAX_PAGES = 20;
