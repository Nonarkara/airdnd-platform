/**
 * License-safe photography for OTOP — manifests from Wikimedia Commons.
 *
 * Honesty rules (enforced in code + UI):
 * 1. Prefer exact imageUrl on a registry/intake record when present.
 * 2. Else load province (or category) media manifests written by
 *    `scripts/otop/fetch-province-media.mjs` — CC BY / CC BY-SA / PD / CC0 only,
 *    with author + license URL stored alongside the image.
 * 3. Illustrative craft photos are NEVER claimed as a named producer's product
 *    shot (`isExactProducer: false`, `representation: 'illustrative'`).
 * 4. No safe hit → null / empty. The UI shows a placeholder — never a wrong
 *    product photo and never an unlabeled AI stand-in.
 *
 * The old hard-coded Unsplash map with invented heritage captions is gone.
 * Attribution is always visible: "Photo: … / License: …".
 */

/** In-memory cache of fetched manifests (browser) or sync stubs (tests). */
const provinceCache = new Map();
const categoryCache = new Map();

/** Optional sync fixtures for unit tests — never used in production UI. */
export let TEST_PROVINCE_MEDIA = null;
export let TEST_CATEGORY_MEDIA = null;

export function __setTestMedia({ provinces = null, categories = null } = {}) {
  TEST_PROVINCE_MEDIA = provinces;
  TEST_CATEGORY_MEDIA = categories;
  provinceCache.clear();
  categoryCache.clear();
}

/**
 * A Commons "description" is the file page's ARTICLE BODY. For the Chiang
 * Saen lion statue it is 4,819 characters of Thai Wikipedia text, and the
 * province dossier was setting it as a HEADING — a 2,976px wall of text
 * inside a 240px photo panel. Twenty of the 128 Commons photographs carry
 * more than 200 characters of it; seven carry more than a thousand.
 *
 * A caption is a line or two that names what the picture shows. So the
 * description is used when it reads like a caption, and the file's own name
 * is used when it does not. The full article stays where it belongs: at the
 * Commons page, which the panel already links.
 */
const CAPTION_MIN = 12;
const CAPTION_MAX = 200;

/** "File:ด้านหลัง พระเชียงแสน สิงห์๑ กรุเชียงแสน.jpg" → "ด้านหลัง พระเชียงแสน สิงห์๑ กรุเชียงแสน" */
export function cleanFileTitle(title) {
  return String(title || '')
    .replace(/^File:/i, '')
    .replace(/\.(jpe?g|png|gif|webp|tiff?|svg)$/i, '')
    .replace(/\s*[-–—]\s*panoramio$/i, '')
    .trim();
}

/** The caption of a photograph: what the reader is looking at. Never a page. */
export function photoCaption(photo) {
  if (!photo) return '';
  const desc = (photo.description || '').trim();
  if (desc.length >= CAPTION_MIN && desc.length <= CAPTION_MAX) return desc;
  const named = cleanFileTitle(photo.title);
  if (named && named.length <= CAPTION_MAX) return named;
  return 'Open-license craft photograph';
}

function normalizePhoto(raw, extras = {}) {
  if (!raw) return null;
  const url = raw.url || raw.thumbUrl || raw.localPath;
  if (!url) return null;
  return {
    url: raw.localPath ? `/${raw.localPath.replace(/^\//, '')}` : url,
    thumbUrl: raw.thumbUrl || url,
    title: raw.title || 'Open-license craft photograph',
    titleTh: raw.titleTh || null,
    caption: photoCaption(raw),
    description: raw.description || null,
    author: raw.author || 'Unknown',
    source: raw.source || 'Wikimedia Commons',
    license: raw.license || 'Unknown',
    licenseUrl: raw.licenseUrl || null,
    filePage: raw.filePage || null,
    craft: raw.craft || extras.craft || null,
    isExactProducer: Boolean(raw.isExactProducer),
    representation: raw.representation || (raw.isExactProducer ? 'exact' : 'illustrative'),
    representationNote:
      raw.representationNote
      || (raw.isExactProducer
        ? null
        : 'Illustrative open-license photograph — not a photo of a specific listed producer.'),
    query: raw.query || null,
    ...extras,
  };
}

/**
 * Resolve an honest, attributed photograph for an OTOP record.
 * Sync path uses TEST_* fixtures or already-warmed caches; production UI
 * should prefer `loadPhotosForProvince` / async warm-up.
 */
export function photoForRecord(record) {
  if (!record) return null;

  if (record.imageUrl) {
    return {
      url: record.imageUrl,
      caption: record.productName || record.producerName || 'OTOP Product',
      titleEn: record.productName || record.producerName || 'OTOP Product',
      craft: record.category || 'OTOP Product',
      author: null,
      source: 'Registry / intake',
      license: 'As published with the source record',
      licenseUrl: null,
      isExactProducer: true,
      representation: 'exact',
      representationNote: null,
    };
  }

  const prov = photosForProvinceSync(record.provinceCode);
  if (prov[0]) {
    return {
      ...prov[0],
      caption: prov[0].caption,
      titleEn: prov[0].title,
      craft: prov[0].craft || record.category || null,
    };
  }

  const cat = photosForCategorySync(record.category);
  if (cat[0]) {
    return {
      ...cat[0],
      caption: cat[0].caption,
      titleEn: cat[0].title,
      craft: record.category || null,
    };
  }

  return null; // honest empty — UI placeholder
}

function photosForProvinceSync(provinceCode) {
  if (provinceCode == null) return [];
  const code = Number(provinceCode);
  if (TEST_PROVINCE_MEDIA?.[code]) {
    return (TEST_PROVINCE_MEDIA[code].photos || []).map((p) => normalizePhoto(p)).filter(Boolean);
  }
  if (provinceCache.has(code)) {
    const m = provinceCache.get(code);
    return (m?.photos || []).map((p) => normalizePhoto(p, {
      craft: m.dominantCategory?.en || null,
    })).filter(Boolean);
  }
  return [];
}

function photosForCategorySync(categoryId) {
  if (!categoryId) return [];
  if (TEST_CATEGORY_MEDIA?.[categoryId]) {
    return (TEST_CATEGORY_MEDIA[categoryId].photos || []).map((p) => normalizePhoto(p)).filter(Boolean);
  }
  if (categoryCache.has(categoryId)) {
    const m = categoryCache.get(categoryId);
    return (m?.photos || []).map((p) => normalizePhoto(p)).filter(Boolean);
  }
  return [];
}

/** Sync helper used by dossier when manifest already loaded / tests. */
export function photosForProvince(provinceCode) {
  return photosForProvinceSync(provinceCode);
}

/**
 * Fetch a province media manifest. Returns [] on miss / no_safe_hit.
 * Caches in memory for the session.
 */
export async function loadPhotosForProvince(provinceCode) {
  const code = Number(provinceCode);
  if (!Number.isFinite(code)) return [];
  if (TEST_PROVINCE_MEDIA?.[code]) return photosForProvinceSync(code);
  if (provinceCache.has(code)) return photosForProvinceSync(code);

  try {
    const res = await fetch(`/media/provinces/${code}.json`, { cache: 'force-cache' });
    if (!res.ok) {
      provinceCache.set(code, { status: 'missing', photos: [] });
      return [];
    }
    const manifest = await res.json();
    provinceCache.set(code, manifest);
    return photosForProvinceSync(code);
  } catch {
    provinceCache.set(code, { status: 'error', photos: [] });
    return [];
  }
}

export async function loadPhotosForCategory(categoryId) {
  if (!categoryId) return [];
  if (TEST_CATEGORY_MEDIA?.[categoryId]) return photosForCategorySync(categoryId);
  if (categoryCache.has(categoryId)) return photosForCategorySync(categoryId);
  try {
    const res = await fetch(`/media/categories/${categoryId}.json`, { cache: 'force-cache' });
    if (!res.ok) {
      categoryCache.set(categoryId, { status: 'missing', photos: [] });
      return [];
    }
    const manifest = await res.json();
    categoryCache.set(categoryId, manifest);
    return photosForCategorySync(categoryId);
  } catch {
    categoryCache.set(categoryId, { status: 'error', photos: [] });
    return [];
  }
}

export async function loadProvinceMediaIndex() {
  try {
    const res = await fetch('/media/provinces/index.json', { cache: 'force-cache' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** Attribution line for captions — always visible next to the image. */
export function attributionLine(photo) {
  if (!photo) return '';
  if (photo.isExactProducer) {
    return `Source: ${photo.source}`;
  }
  const who = photo.author ? `Photo: ${photo.author}` : 'Photo: unknown author';
  const lic = photo.license ? `License: ${photo.license}` : '';
  return [who, photo.source, lic].filter(Boolean).join(' · ');
}

// Re-export empty maps so older imports of CATEGORY_PHOTOS / PROVINCIAL_CRAFT_PHOTOS
// do not crash; they are intentionally empty — use manifests instead.
export const CATEGORY_PHOTOS = {};
export const PROVINCIAL_CRAFT_PHOTOS = {};
