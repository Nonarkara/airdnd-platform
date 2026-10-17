/* global HTMLRewriter */
/*
 * Per-deeplink OG meta rewrite — Cloudflare Pages Function.
 *
 * When a visitor hits the site with `?listing=<id>`, we rewrite the
 * <meta property="og:*"> and <meta name="twitter:*"> tags in the HTML
 * response to point at the listing-specific OG card and copy. So when the
 * URL is shared in WhatsApp / LINE / Telegram / X, the chat preview shows
 * the cyberpunk card for *that* listing instead of the generic site card.
 *
 * Build pipeline writes per-listing PNGs to public/og/listing-<id>.png and
 * the default to public/og/default.png. Those are static assets served by
 * Pages — this function just retags the HTML pointing to them.
 *
 * Listing names + cities are read from /data.json which Pages serves
 * unconditionally (no DB call from the function — keeps it fast and free).
 */

const SITE_ORIGIN = 'https://sabai-sabai-4uh.pages.dev';

class MetaRewriter {
  constructor(meta) { this.meta = meta; }
  element(el) {
    const property = el.getAttribute('property');
    const name = el.getAttribute('name');
    const key = property || name;
    if (!key) return;
    const next = this.meta[key];
    if (typeof next === 'string') {
      el.setAttribute('content', next);
    }
  }
}

class TitleRewriter {
  constructor(title) { this.title = title; }
  element(el) {
    if (typeof this.title === 'string') {
      el.setInnerContent(this.title);
    }
  }
}

async function loadListing(env, host, id) {
  // Fetch the snapshot from the same origin (served as a static asset).
  // env.ASSETS is bound by Pages so we can resolve internal URLs without
  // a hop back to the public internet.
  try {
    const url = `${host}/data.json`;
    const res = env?.ASSETS
      ? await env.ASSETS.fetch(new Request(url))
      : await fetch(url);
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.find((r) => String(r.id) === String(id)) || null;
  } catch {
    return null;
  }
}

function buildListingMeta(listing, host) {
  const id = listing.id;
  const ogUrl = `${host}/og/listing-${id}.png`;
  const name = (listing.name || '').trim();
  const city = (listing.city || 'Bangkok').trim();
  const desc = (listing.description || '').trim().slice(0, 200);
  const title = name ? `${name} · ${city} — Sabai Sabai` : `Listing ${id} — Sabai Sabai`;
  const description = desc || `Live community-sourced massage & spa intelligence for ${city}, Thailand.`;
  const pageUrl = `${host}/?listing=${encodeURIComponent(id)}`;
  return {
    title,
    description,
    pageUrl,
    ogUrl,
  };
}

export const onRequest = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const listingId = url.searchParams.get('listing');

  // Pass through all non-deeplink requests untouched.
  const response = await next();
  if (!listingId) return response;

  // Only rewrite HTML responses.
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  const host = `${url.protocol}//${url.host}`;
  const listing = await loadListing(env, host, listingId);
  if (!listing) return response;

  const meta = buildListingMeta(listing, host);

  const replacements = {
    'og:title': meta.title,
    'og:description': meta.description,
    'og:image': meta.ogUrl,
    'og:url': meta.pageUrl,
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.ogUrl,
  };

  return new HTMLRewriter()
    .on('title', new TitleRewriter(meta.title))
    .on('meta', new MetaRewriter(replacements))
    .transform(response);
};
