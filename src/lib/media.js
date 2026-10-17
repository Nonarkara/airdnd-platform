// Listing photos used to be served from Supabase Storage. They now live on a
// free Cloudflare Pages project (airdnd-media) with the same object keys, so
// any old Supabase public URL maps 1:1 onto the media host.
export const MEDIA_BASE_URL = 'https://airdnd-media.pages.dev/';

const LEGACY_STORAGE_PREFIX = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//i;

export function rewriteMediaUrl(url) {
  if (typeof url !== 'string') return url;
  return url.replace(LEGACY_STORAGE_PREFIX, MEDIA_BASE_URL);
}

export function rewriteMediaUrls(urls) {
  return Array.isArray(urls) ? urls.map(rewriteMediaUrl) : urls;
}
