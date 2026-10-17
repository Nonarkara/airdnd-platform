// Canonical Telegram channel → slug/label derivation.
//
// One rule, shared by the gallery builder (build_place_photos.js), the map
// deep-link (ListingMap.jsx), and the listing modal archive link
// (ListingModal.jsx). Every consumer must use this — never re-derive inline.
//
// The byte-wise contract matters: gallery shard filenames ARE the slug, so a
// slug must round-trip from a photo_archive channel_name to the same file.
// Keep the transformation order and character handling stable (no trimming of
// spaces inside names, no Unicode normalization, lowercase only).

export function channelSlug(sourceChannel) {
  const raw = String(sourceChannel == null ? '' : sourceChannel).trim();
  if (!raw) return raw;
  return raw.replace(/^@/, '').toLowerCase();
}

export function channelLabel(sourceChannel) {
  const raw = String(sourceChannel == null ? '' : sourceChannel).trim();
  if (!raw) return raw;
  return raw.replace(/^@/, '');
}