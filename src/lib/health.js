/**
 * Health intelligence — join public HIV/STI context to inventory density.
 * Sources: data.go.th s_tuc2 (2566), Bangkok Open Data msd018, HIVhub DDC.
 */

export async function loadProvinceHiv() {
  const res = await fetch('/data/health/province-hiv.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Health dataset unavailable');
  return res.json();
}

function normalizeProvinceName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const aliases = {
    'Phra Nakhon Si Ayutthaya': 'Ayutthaya',
    Ayutthaya: 'Phra Nakhon Si Ayutthaya',
    BKK: 'Bangkok',
    กรุงเทพ: 'Bangkok',
    กรุงเทพมหานคร: 'Bangkok',
    ชลบุรี: 'Chonburi',
    เชียงใหม่: 'Chiang Mai',
    ภูเก็ต: 'Phuket',
    พัทยา: 'Chonburi',
    Pattaya: 'Chonburi',
  };
  return aliases[raw] || raw;
}

/** Count inventory venues per province (city field). */
export function venueDensityByProvince(listings) {
  const counts = new Map();
  for (const listing of listings || []) {
    const key = normalizeProvinceName(listing.city || listing.location);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/**
 * Join HIV province rows with venue density for map + three-lens copy.
 */
export function buildHealthMatrix(hivPayload, listings) {
  const venues = venueDensityByProvince(listings);
  const provinces = (hivPayload?.provinces || []).map((row) => {
    const name = row.name;
    const venueCount =
      venues.get(name) ||
      venues.get(normalizeProvinceName(name)) ||
      0;
    const cases = Number(row.newCases2566) || 0;
    // Co-location index: both signals present → priority corridor (not risk score of a venue)
    const colocation = venueCount > 0 && cases > 0
      ? Math.round(Math.log10(1 + venueCount) * Math.log10(1 + cases) * 100) / 100
      : 0;
    return {
      ...row,
      venueCount,
      colocation,
    };
  });

  const rankedCorridors = [...provinces]
    .filter((p) => p.venueCount > 0)
    .sort((a, b) => b.colocation - a.colocation || b.newCases2566 - a.newCases2566)
    .slice(0, 12);

  const topVenues = [...provinces]
    .sort((a, b) => b.venueCount - a.venueCount)
    .slice(0, 10);

  const topCases = [...provinces]
    .sort((a, b) => b.newCases2566 - a.newCases2566)
    .slice(0, 10);

  return {
    meta: hivPayload?.source || {},
    year: hivPayload?.yearGregorian || 2023,
    nationalTotal: hivPayload?.nationalTotal || 0,
    bangkokFacility2024: hivPayload?.bangkokFacility2024 || null,
    lenses: hivPayload?.lenses || {},
    provinces,
    rankedCorridors,
    topVenues,
    topCases,
  };
}
