import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
  buildCanonicalKey,
  canonicalizePublicListings,
  hasStoredCoordinates,
  isBadPublicName,
  isVerifiedLocation,
  mergeCanonicalGroup,
  normalizePublicListing,
  validatePublicListing,
} from '../src/lib/listing_contract.js';
import { resolveGoogleMapsDataCached as resolveGoogleMapsData } from './geocoder_cache.js';

dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://fehdtfncbutesgadjsxp.supabase.co';
const supabaseUrl = process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');
const geocode = process.argv.includes('--geocode');
const deleteInvalid = process.argv.includes('--delete-invalid');
const deleteMissingCoordinates = process.argv.includes('--delete-missing-coords');

if (!serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY. Cleanup requires service-role access.');
  process.exit(1);
}

if (apply && !geocode) {
  console.error('Refusing to apply cleanup without --geocode. Run dry-run first, then use: npm run cleanup:companions -- --geocode --apply');
  process.exit(1);
}

if (deleteMissingCoordinates && !deleteInvalid) {
  console.error('Use --delete-invalid with --delete-missing-coords. Missing coordinates are hidden by default, not deleted.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(Boolean);
}

function getTimestampValue(row) {
  const value = row.updated_at || row.updatedAt || row.created_at || row.createdAt;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMapsUrl(row) {
  return row?.maps_url || row?.mapsUrl || null;
}

function isDefaultLocation(location) {
  return /^bangkok,?\s*thailand$/i.test(String(location || '').trim());
}

function shouldPreferMapsAddress(currentLocation, mapsAddress) {
  const current = String(currentLocation || '').trim();
  const candidate = String(mapsAddress || '').trim();

  if (!isVerifiedLocation(candidate)) {
    return false;
  }

  if (!isVerifiedLocation(current) || isDefaultLocation(current)) {
    return true;
  }

  const hasAreaSignal = /(?:bangkok|กรุงเทพ|นนทบุรี|ปทุมธานี|ชลบุรี|ภูเก็ต|เชียงใหม่|เชียงราย|\d{5})/i.test(candidate);
  return hasAreaSignal && candidate.length >= current.length + 12;
}

function deriveNameFromMapsAddress(mapsAddress) {
  const address = String(mapsAddress || '').trim();
  if (!address || /^\d/.test(address)) {
    return '';
  }

  const candidates = [
    address.match(/^(.+?)\s+\d{1,5}(?:\/\d+)?\s+(?:ถ\.|ถนน|ซอย|Soi|Alley|แขวง|เขต|ตำบล|อำเภอ|Road|Rd\.|Moo)\b/i)?.[1],
    address.split(',')[0],
    address,
  ]
    .map((candidate) => String(candidate || '').trim())
    .filter(Boolean);

  return candidates.find((candidate) => candidate.length >= 3 && candidate.length <= 80 && !isBadPublicName(candidate)) || '';
}

function shouldPreferMapsName(currentName, mapsAddress) {
  const candidate = deriveNameFromMapsAddress(mapsAddress);
  if (!candidate) {
    return null;
  }

  const current = String(currentName || '').trim();
  if (!current || isBadPublicName(current) || /^@[\w.-]{3,}$/i.test(current)) {
    return candidate;
  }

  return null;
}

function countReasons(entries) {
  return entries.reduce((acc, entry) => {
    const reasons = entry.reasons ? [...entry.reasons] : [entry.reason];
    reasons.filter(Boolean).forEach((reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
    });
    return acc;
  }, {});
}

function canDeleteInvalidEntry(entry) {
  if (!deleteInvalid) {
    return false;
  }

  const reasons = [...entry.reasons];
  if (!deleteMissingCoordinates && reasons.includes('missing coordinates')) {
    return false;
  }

  return true;
}

function createGroups(rows) {
  const groups = new Map();
  const invalidRows = [];

  rows.forEach((row) => {
    const normalized = normalizePublicListing(row, {
      source: 'supabase',
      allowUnverified: true,
    });
    const canonicalKey = buildCanonicalKey(normalized || row);
    const validation = normalized ? validatePublicListing(normalized) : { ok: false, reason: 'invalid shape' };

    if (!normalized || !canonicalKey) {
      invalidRows.push({ row, reason: validation.reason || 'missing canonical key' });
      return;
    }

    if (!groups.has(canonicalKey)) {
      groups.set(canonicalKey, []);
    }
    groups.get(canonicalKey).push({ row, normalized, validation });

    if (!validation.ok) {
      invalidRows.push({ row, reason: validation.reason });
    }
  });

  return { groups, invalidRows };
}

function buildUpdatePayload(merged) {
  const payload = {
    name: merged.name,
    location: merged.location,
    price: merged.priceLabel,
    description: merged.description,
    image_url: merged.imageUrl,
    rating: merged.rating ?? 0,
    reviews: merged.reviews ?? 0,
    tags: merged.tags || [],
    metrics: merged.metrics || {},
    phone: merged.phone,
    hours: merged.hours,
    line_url: merged.lineUrl,
    telegram_url: merged.telegramUrl,
    maps_url: merged.mapsUrl,
    source_channel: merged.sourceChannel,
    city: merged.city,
    mention_count: Math.max(1, merged.mentionCount || 1),
    photo_urls: merged.allPhotoUrls || [],
    drive_photo_urls: merged.drivePhotoUrls || [],
    source_message_ids: merged.sourceMessageIds || [],
    user_rating: merged.userRating,
    service_tags: merged.serviceTags || [],
    discussion_notes: merged.userFeedbackSummary,
    is_safe_image: merged.isSafeImage !== false,
    latitude: merged.latitude,
    longitude: merged.longitude,
    canonical_key: merged.canonicalKey,
    updated_at: new Date().toISOString(),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
      delete payload[key];
    }
  });

  return payload;
}

async function safeUpdate(id, payload) {
  if (!payload || Object.keys(payload).length === 0) {
    return;
  }

  let { error } = await supabase.from('companions').update(payload).eq('id', id);

  if (error && error.message?.includes('column')) {
    const retryPayload = { ...payload };
    delete retryPayload.canonical_key;
    if (Object.keys(retryPayload).length === 0) {
      return;
    }
    ({ error } = await supabase.from('companions').update(retryPayload).eq('id', id));
  }

  if (error) {
    throw error;
  }
}

function buildCanonicalKeyUpdatePlans(rows) {
  return rows
    .map((row) => {
      const normalized = normalizePublicListing(row, {
        source: 'supabase',
        allowUnverified: true,
      });
      const canonicalKey = buildCanonicalKey(normalized || row);
      if (!row?.id || !canonicalKey || String(row.canonical_key || row.canonicalKey || '') === canonicalKey) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        payload: { canonical_key: canonicalKey },
      };
    })
    .filter(Boolean);
}

function mergeUpdatePlans(...planGroups) {
  const merged = new Map();

  planGroups.flat().filter(Boolean).forEach((plan) => {
    if (!merged.has(plan.id)) {
      merged.set(plan.id, {
        id: plan.id,
        name: plan.name,
        payload: {},
      });
    }

    const existing = merged.get(plan.id);
    existing.payload = {
      ...existing.payload,
      ...plan.payload,
    };
  });

  return [...merged.values()];
}

async function enrichMissingCoordinates(rows) {
  const stats = {
    enabled: geocode,
    rowsWithMapsUrl: 0,
    rowsMissingCoordinates: 0,
    rowsWithUnverifiedLocation: 0,
    attempted: 0,
    resolvedCoordinates: 0,
    recoveredAddresses: 0,
    recoveredNames: 0,
    unchanged: 0,
    unresolved: 0,
    cachedMapsUrls: 0,
    unresolvedSamples: [],
  };

  rows.forEach((row) => {
    if (getMapsUrl(row)) stats.rowsWithMapsUrl += 1;
    if (!hasStoredCoordinates(row)) stats.rowsMissingCoordinates += 1;
    if (!isVerifiedLocation(row?.location)) stats.rowsWithUnverifiedLocation += 1;
  });

  if (!geocode) {
    return { rows, stats };
  }

  const cache = new Map();
  const enriched = [];
  const updates = [];

  for (const row of rows) {
    const mapsUrl = getMapsUrl(row);
    const needsCoordinates = !hasStoredCoordinates(row);

    if (!mapsUrl) {
      enriched.push(row);
      continue;
    }

    stats.attempted += 1;

    if (!cache.has(mapsUrl)) {
      cache.set(mapsUrl, await resolveGoogleMapsData(mapsUrl));
    }

    const mapsData = cache.get(mapsUrl);
    const nextRow = { ...row };
    const updatePayload = {};
    let changed = false;

    if (needsCoordinates && hasStoredCoordinates({ latitude: mapsData?.latitude, longitude: mapsData?.longitude })) {
      nextRow.latitude = mapsData.latitude;
      nextRow.longitude = mapsData.longitude;
      updatePayload.latitude = mapsData.latitude;
      updatePayload.longitude = mapsData.longitude;
      stats.resolvedCoordinates += 1;
      changed = true;
    }

    if (shouldPreferMapsAddress(row.location, mapsData?.address)) {
      nextRow.location = mapsData.address;
      updatePayload.location = mapsData.address;
      stats.recoveredAddresses += 1;
      changed = true;
    }

    const mapsName = shouldPreferMapsName(row.name, mapsData?.address);
    if (mapsName) {
      nextRow.name = mapsName;
      updatePayload.name = mapsName;
      stats.recoveredNames += 1;
      changed = true;
    }

    if (!changed) {
      stats.unchanged += 1;
      if (needsCoordinates || !isVerifiedLocation(row?.location)) {
        stats.unresolved += 1;
      }
      if ((needsCoordinates || !isVerifiedLocation(row?.location)) && stats.unresolvedSamples.length < 12) {
        stats.unresolvedSamples.push({
          id: row.id,
          name: row.name,
          location: row.location,
          mapsUrl,
        });
      }
      enriched.push(row);
      continue;
    }

    if (row.id) {
      updates.push({
        id: row.id,
        name: row.name,
        payload: {
          ...updatePayload,
          updated_at: new Date().toISOString(),
        },
      });
    }
    enriched.push(nextRow);
  }

  stats.cachedMapsUrls = cache.size;
  stats.rowsStillMissingCoordinates = enriched.filter((row) => !hasStoredCoordinates(row)).length;
  stats.rowsStillUnverifiedLocation = enriched.filter((row) => !isVerifiedLocation(row?.location)).length;
  return { rows: enriched, stats, updates };
}

async function main() {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error(`Could not load companions: ${error.message}`);
    process.exit(1);
  }

  const enrichment = await enrichMissingCoordinates(data || []);
  const rows = enrichment.rows;
  const { groups, invalidRows } = createGroups(rows);
  const duplicateGroups = [...groups.entries()].filter(([, group]) => group.length > 1);
  const validPublicRows = canonicalizePublicListings(rows, { source: 'supabase' });
  const invalidRowsById = new Map();
  invalidRows.forEach(({ row, reason }) => {
    if (!row?.id) {
      return;
    }

    if (!invalidRowsById.has(row.id)) {
      invalidRowsById.set(row.id, {
        row,
        reasons: new Set(),
      });
    }
    invalidRowsById.get(row.id).reasons.add(reason);
  });
  const duplicateLoserIds = new Set();
  const mergePlans = [];

  duplicateGroups.forEach(([canonicalKey, group]) => {
    const merged = mergeCanonicalGroup(group.map((item) => item.row));
    if (!merged) return;

    const sorted = [...group].sort((left, right) => {
      const mergedId = String(merged.id || '');
      if (String(left.row.id) === mergedId) return -1;
      if (String(right.row.id) === mergedId) return 1;
      return getTimestampValue(right.row) - getTimestampValue(left.row);
    });
    const survivor = sorted[0].row;
    const losers = sorted.slice(1).map((item) => item.row);
    losers.forEach((row) => duplicateLoserIds.add(row.id));

    mergePlans.push({
      canonicalKey,
      survivor,
      losers,
      merged: {
        ...merged,
        id: survivor.id,
        allPhotoUrls: [
          ...new Set(group.flatMap((item) => normalizeArray(item.row.photo_urls))),
          ...normalizeArray(merged.allPhotoUrls),
        ],
        drivePhotoUrls: [
          ...new Set(group.flatMap((item) => normalizeArray(item.row.drive_photo_urls))),
          ...normalizeArray(merged.drivePhotoUrls),
        ],
        sourceMessageIds: [
          ...new Set(group.flatMap((item) => normalizeArray(item.row.source_message_ids))),
          ...normalizeArray(merged.sourceMessageIds),
        ],
      },
    });
  });

  duplicateLoserIds.forEach((id) => invalidRowsById.delete(id));
  const invalidOnlyEntries = [...invalidRowsById.values()];
  const invalidDeleteEntries = invalidOnlyEntries.filter(canDeleteInvalidEntry);
  const invalidHiddenEntries = invalidOnlyEntries.filter((entry) => !canDeleteInvalidEntry(entry));
  const invalidOnlyIds = invalidDeleteEntries.map(({ row }) => row.id);
  const loserIds = [...duplicateLoserIds];
  const idsToDelete = new Set([...loserIds, ...invalidOnlyIds]);
  const canonicalKeyPlans = buildCanonicalKeyUpdatePlans(rows);
  const mapUpdatePlans = (enrichment.updates || []).filter((plan) => !idsToDelete.has(plan.id));
  const updatePlans = mergeUpdatePlans(
    mapUpdatePlans,
    canonicalKeyPlans.filter((plan) => !idsToDelete.has(plan.id)),
  );

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    geocode,
    deleteInvalid,
    deleteMissingCoordinates,
    loadedRows: rows.length,
    validPublicRows: validPublicRows.length,
    duplicateGroups: duplicateGroups.length,
    duplicateRowsToDelete: loserIds.length,
    invalidRowsToDelete: invalidOnlyIds.length,
    invalidRowsHiddenOnly: invalidHiddenEntries.length,
    invalidReasonCounts: countReasons(invalidOnlyEntries),
    geocodeStats: enrichment.stats,
    mapRowsToUpdate: mapUpdatePlans.length,
    canonicalKeysToUpdate: canonicalKeyPlans.filter((plan) => !idsToDelete.has(plan.id)).length,
    rowsToUpdate: updatePlans.length,
    survivorsToUpdate: mergePlans.length,
    topDuplicateGroups: mergePlans.slice(0, 10).map((plan) => ({
      canonicalKey: plan.canonicalKey,
      survivorId: plan.survivor.id,
      deleteIds: plan.losers.map((row) => row.id),
      mergedName: plan.merged.name,
      mergedLocation: plan.merged.location,
    })),
    invalidSamples: invalidOnlyEntries.slice(0, 12).map(({ row, reasons }) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      reasons: [...reasons],
      action: canDeleteInvalidEntry({ row, reasons }) ? 'delete' : 'hide-from-public',
    })),
    mapUpdateSamples: mapUpdatePlans.slice(0, 12).map((plan) => ({
      id: plan.id,
      name: plan.name,
      fields: Object.keys(plan.payload).filter((field) => field !== 'updated_at'),
      location: plan.payload.location,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('Dry run only. Re-run with --apply after reviewing the summary.');
    return;
  }

  for (const plan of updatePlans) {
    await safeUpdate(plan.id, plan.payload);
  }

  for (const plan of mergePlans) {
    await safeUpdate(plan.survivor.id, buildUpdatePayload(plan.merged));
  }

  const deleteIds = [...idsToDelete];
  for (let index = 0; index < deleteIds.length; index += 100) {
    const chunk = deleteIds.slice(index, index + 100);
    const { error: deleteError } = await supabase
      .from('companions')
      .delete()
      .in('id', chunk);

    if (deleteError) {
      throw deleteError;
    }
  }

  console.log(
    `Cleanup applied. Updated ${updatePlans.length} row(s), merged ${mergePlans.length} survivor(s), deleted ${loserIds.length} duplicate row(s), deleted ${invalidOnlyIds.length} invalid row(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
