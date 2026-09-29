// Build public/data.json from the local SQLite station.
//
// This mirrors the slim-listing shape that scripts/refresh_public_snapshot.js
// produces from Firestore/Supabase, so the frontend snapshot is byte-compatible
// regardless of where the data is stored. The only difference is the source:
// here it reads the local `companions` table instead of a paid cloud database.

import fs from 'fs';
import path from 'path';
import { canonicalizePublicListings, validatePublicListing } from '../../src/lib/listing_contract.js';
import { getGeoIndex } from './geo.js';
import { readTable } from './local_store.js';

/**
 * Build a lookup of {basename -> /images/... url} for every file physically
 * present under the deploy public/images directory, so we only reference photos
 * that will actually ship.
 */
export function createImageIndex(publicDir) {
  const imageRoot = path.join(publicDir, 'images');
  const byBasename = new Map();

  function visit(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else {
        byBasename.set(entry.name, `/${path.relative(publicDir, entryPath)}`);
      }
    }
  }

  visit(imageRoot);
  return byBasename;
}

export function createDeployablePhotoResolver(publicDir, imageIndex = createImageIndex(publicDir)) {
  function deployablePhotoUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }
    if (url.startsWith('/images/')) {
      return fs.existsSync(path.join(publicDir, url.replace(/^\/+/, ''))) ? url : imageIndex.get(path.basename(url)) || null;
    }
    if (url.startsWith('/photos/')) {
      return imageIndex.get(path.basename(url)) || null;
    }
    return url;
  }

  function deployablePhotoUrls(urls) {
    if (!Array.isArray(urls)) {
      return [];
    }
    return [...new Set(urls.map(deployablePhotoUrl).filter(Boolean))];
  }

  return { deployablePhotoUrl, deployablePhotoUrls };
}

// Per-listing credibility score — identical formula to refresh_public_snapshot.js
// so the local station and the cloud path rank listings the same way.
export function computeCredibility(listing) {
  const mc = Number(listing.mentionCount) || 0;
  const photos = Array.isArray(listing.allPhotoUrls) ? listing.allPhotoUrls.length
    : Array.isArray(listing.photo_urls) ? listing.photo_urls.length : 0;
  const descLen = (listing.description || '').length;
  const ageDays = (Date.now() - new Date(listing.updatedAt || listing.createdAt || Date.now()).getTime()) / 86_400_000;
  const score =
    Math.min(25, Math.log2(1 + mc) * 5)
    + Math.min(12, Math.log2(1 + photos) * 3)
    + (listing.phone ? 10 : 0)
    + (listing.lineUrl ? 8 : 0)
    + (listing.mapsUrl ? 6 : 0)
    + (Number.isFinite(listing.latitude) && listing.latitude != null ? 8 : 0)
    + Math.min(12, descLen / 30)
    + Math.max(0, 12 - ageDays * 0.2);
  return Math.max(0, Math.min(100, +score.toFixed(1)));
}

function snapshotFreshnessValue(listing) {
  const value = listing?.postedAt || listing?.updatedAt || listing?.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Turn raw companions rows into the slim, canonical, deploy-safe listing array
 * written to public/data.json.
 *
 * @param {object[]} rows raw companions rows (JSON columns already parsed)
 * @param {{ deployablePhotoUrl: Function, deployablePhotoUrls: Function }} photos
 */
export function buildSnapshotListings(rows, photos) {
  const publicListings = canonicalizePublicListings(rows, { source: 'snapshot', allowUnverified: true, geoIndex: getGeoIndex() })
    .filter((listing) => validatePublicListing(listing).ok);

  return publicListings.map((listing) => ({
    id: listing.id,
    canonicalKey: listing.canonicalKey,
    name: listing.name,
    age: listing.age,
    location: listing.location,
    city: listing.city,
    priceLabel: listing.priceLabel,
    priceValue: listing.priceValue,
    description: listing.description,
    tags: listing.tags,
    metrics: listing.metrics,
    imageUrl: photos.deployablePhotoUrl(listing.imageUrl),
    allPhotoUrls: photos.deployablePhotoUrls(listing.allPhotoUrls),
    drivePhotoUrls: listing.drivePhotoUrls,
    rating: listing.rating,
    reviews: listing.reviews,
    updatedAt: listing.updatedAt,
    postedAt: listing.postedAt,
    createdAt: listing.createdAt,
    userFeedbackSummary: listing.userFeedbackSummary,
    serviceTags: listing.serviceTags,
    sourceChannel: listing.sourceChannel,
    sourceTarget: listing.sourceTarget,
    phone: listing.phone,
    hours: listing.hours,
    lineUrl: listing.lineUrl,
    telegramUrl: listing.telegramUrl,
    mapsUrl: listing.mapsUrl,
    latitude: listing.latitude,
    longitude: listing.longitude,
    geoPrecision: listing.geoPrecision,
    geoRadiusKm: listing.geoRadiusKm,
    geoSource: listing.geoSource,
    geoUnit: listing.geoUnit,
    geoNote: listing.geoNote,
    isSafeImage: listing.isSafeImage,
    mentionCount: listing.mentionCount,
    aliasNames: Array.isArray(listing.aliasNames) ? listing.aliasNames : [],
    aliasCount: listing.aliasCount || ((listing.aliasNames?.length || 0) + 1),
    credibility: computeCredibility(listing),
  })).sort((left, right) => {
    const timestampDelta = snapshotFreshnessValue(right) - snapshotFreshnessValue(left);
    if (timestampDelta !== 0) {
      return timestampDelta;
    }
    return Number(right.id || 0) - Number(left.id || 0);
  });
}

/**
 * Read the local companions table and write public/data.json.
 *
 * @param {import('node:sqlite').DatabaseSync} db open local database handle
 * @param {{ publicDir?: string, outPath?: string }} [options]
 * @returns {{ count: number, outPath: string }}
 */
export function exportSnapshotFromDb(db, options = {}) {
  const publicDir = options.publicDir || path.join(process.cwd(), 'public');
  const outPath = options.outPath || path.join(publicDir, 'data.json');
  const photos = createDeployablePhotoResolver(publicDir);

  const rows = readTable(db, 'companions');
  const slimListings = buildSnapshotListings(rows, photos);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(slimListings, null, 2));
  return { count: slimListings.length, outPath };
}
