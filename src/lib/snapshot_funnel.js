// The intake funnel, computed from what is actually in the repository.
//
// The site quotes archive-scale numbers (tens of thousands of messages and
// photos) next to a directory of about a hundred cards. Both are true, but the
// path between them was never shown, and several steps on it fail silently:
// photos referenced by the snapshot that were never committed, channels that
// stopped producing, a snapshot that quietly aged. This module turns that path
// into one JSON document the verifier prints and the hero discloses.
//
// Pure: takes data in, returns an object. `verify_snapshot.js` does the I/O.

const DAY_MS = 86_400_000;

function newestTimestamp(listings) {
  let newest = 0;
  for (const listing of listings) {
    const raw = listing?.postedAt || listing?.updatedAt || listing?.createdAt;
    const ts = raw ? new Date(raw).getTime() : 0;
    if (Number.isFinite(ts) && ts > newest) newest = ts;
  }
  return newest;
}

/**
 * @param {object} input
 * @param {Array<object>} input.listings           public/data.json
 * @param {Iterable<string>} input.trackedImagePaths  git-tracked paths as "/images/…"
 * @param {string[]} input.configuredChannels    scraper target tokens
 * @param {object|null} [input.corpus]           insights.json `corpus` block
 * @param {object|null} [input.feedMeta]         feed_meta.json
 * @param {number} [input.now]
 */
export function computeSnapshotFunnel({
  listings,
  trackedImagePaths,
  configuredChannels = [],
  corpus = null,
  feedMeta = null,
  now = Date.now(),
}) {
  const rows = Array.isArray(listings) ? listings : [];
  const tracked = new Set(trackedImagePaths || []);

  let withPhoto = 0;
  let localPhotoRefs = 0;
  let photoFilesTracked = 0;
  const missingPhotoPaths = [];
  const channels = new Set();
  let unverifiedLocation = 0;

  for (const listing of rows) {
    const url = listing?.imageUrl;
    if (typeof url === 'string' && url) {
      withPhoto += 1;
      if (url.startsWith('/images/')) {
        localPhotoRefs += 1;
        if (tracked.has(url)) photoFilesTracked += 1;
        else missingPhotoPaths.push(url);
      }
    }
    const channel = listing?.sourceTarget || listing?.sourceChannel;
    if (channel) channels.add(String(channel));
    if (!(Number.isFinite(listing?.latitude) && Number.isFinite(listing?.longitude)) && !listing?.mapsUrl) {
      unverifiedLocation += 1;
    }
  }

  const newest = newestTimestamp(rows);
  const ageDays = newest ? Math.floor((now - newest) / DAY_MS) : null;
  const photoFilesMissing = missingPhotoPaths.length;
  const deployablePhotoCards = withPhoto - photoFilesMissing;

  const warnings = [];
  if (rows.length === 0) warnings.push('snapshot is empty');
  if (photoFilesMissing > 0) {
    warnings.push(`${photoFilesMissing} of ${localPhotoRefs} local photo paths are not committed and will 404 in production`);
  }
  if (ageDays !== null && ageDays > 7) warnings.push(`newest post in snapshot is ${ageDays} days old`);
  if (configuredChannels.length > 0 && channels.size < configuredChannels.length) {
    warnings.push(`${channels.size} of ${configuredChannels.length} configured channels are represented`);
  }
  if (feedMeta?.degraded) warnings.push(`LIVE feed is degraded: ${feedMeta.reason || feedMeta.source}`);

  return {
    generatedAt: new Date(now).toISOString(),
    shown: {
      cards: rows.length,
      withPhoto,
      deployablePhotoCards: Math.max(0, deployablePhotoCards),
      photoFilesTracked,
      photoFilesMissing,
      unverifiedLocation,
      channelsRepresented: channels.size,
      channels: [...channels].sort(),
    },
    snapshot: {
      newestPostAt: newest ? new Date(newest).toISOString() : null,
      ageDays,
    },
    intake: {
      channelsConfigured: configuredChannels.length,
    },
    archive: corpus
      ? {
          messages: corpus.messagesTotal ?? null,
          photos: corpus.photosArchived ?? null,
          personaPosts: corpus.personaPosts ?? null,
          businesses: corpus.uniqueBusinesses ?? null,
          duplicationFactor: corpus.duplicationFactor ?? null,
        }
      : null,
    feed: feedMeta ? { degraded: Boolean(feedMeta.degraded), builtAt: feedMeta.builtAt || null } : null,
    warnings,
    missingPhotoPaths,
  };
}
