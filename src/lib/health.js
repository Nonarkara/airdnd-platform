/**
 * Health intelligence — join public HIV/STI + formalization context to inventory density.
 * Sources: data.go.th (s_tuc2, sasuk01, 03_1201, hss_11_49, ttamc_op_12_02), Bangkok msd018.
 */

export async function loadProvinceHiv() {
  const res = await fetch('/data/health/province-hiv.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Health dataset unavailable');
  return res.json();
}

export async function loadFormalization() {
  const res = await fetch('/data/health/formalization.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Formalization dataset unavailable');
  return res.json();
}

export async function loadStiScreeningRoiet() {
  const res = await fetch('/data/health/sti-screening-roiet.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('STI screening dataset unavailable');
  return res.json();
}

export async function loadTherapeuticMassage() {
  const res = await fetch('/data/health/therapeutic-massage.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Therapeutic massage dataset unavailable');
  return res.json();
}

export async function loadHealthResearchBundle() {
  const [hiv, formalization, sti, therapeutic] = await Promise.all([
    loadProvinceHiv(),
    loadFormalization().catch(() => null),
    loadStiScreeningRoiet().catch(() => null),
    loadTherapeuticMassage().catch(() => null),
  ]);
  return { hiv, formalization, sti, therapeutic };
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
    ร้อยเอ็ด: 'Roi Et',
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

function lookupVenueCount(venues, name) {
  return venues.get(name)
    || venues.get(normalizeProvinceName(name))
    || 0;
}

function formalizationGap(venueCount, certified) {
  if (venueCount <= 0) return 0;
  const denom = Math.log10(1 + Math.max(0, certified));
  if (denom <= 0) return Math.round(Math.log10(1 + venueCount) * 100) / 100;
  return Math.round((Math.log10(1 + venueCount) / denom) * 100) / 100;
}

/**
 * Join HIV province rows with venue density for map + lens copy.
 */
export function buildHealthMatrix(hivPayload, listings, formalizationPayload = null, therapeuticPayload = null) {
  const venues = venueDensityByProvince(listings);
  const certifiedByName = new Map(
    (formalizationPayload?.provinces || []).map((p) => [p.name, p]),
  );
  const therapeuticByName = new Map(
    (therapeuticPayload?.provinces || []).map((p) => [p.name, p]),
  );

  const provinces = (hivPayload?.provinces || []).map((row) => {
    const name = row.name;
    const venueCount = lookupVenueCount(venues, name);
    const cases = Number(row.newCases2566) || 0;
    const certified = certifiedByName.get(name)?.certifiedProviders
      || certifiedByName.get(normalizeProvinceName(name))?.certifiedProviders
      || 0;
    const therapeuticVisits = therapeuticByName.get(name)?.visits
      || therapeuticByName.get(normalizeProvinceName(name))?.visits
      || 0;
    const colocation = venueCount > 0 && cases > 0
      ? Math.round(Math.log10(1 + venueCount) * Math.log10(1 + cases) * 100) / 100
      : 0;
    const gap = formalizationGap(venueCount, certified);
    return {
      ...row,
      venueCount,
      certifiedProviders: certified,
      therapeuticVisits,
      colocation,
      formalizationGap: gap,
    };
  });

  // Include HSS-only provinces that lack HIV coords? stick to HIV list for map.
  const rankedCorridors = [...provinces]
    .filter((p) => p.venueCount > 0)
    .sort((a, b) => b.colocation - a.colocation || b.newCases2566 - a.newCases2566)
    .slice(0, 12);

  const greyHeavy = [...provinces]
    .filter((p) => p.venueCount > 0)
    .sort((a, b) => b.formalizationGap - a.formalizationGap || b.venueCount - a.venueCount)
    .slice(0, 12);

  const registeredCorridors = [...provinces]
    .filter((p) => p.venueCount > 0 && p.certifiedProviders > 0)
    .sort((a, b) => (b.venueCount * b.certifiedProviders) - (a.venueCount * a.certifiedProviders))
    .slice(0, 12);

  const harmReductionPriority = [...provinces]
    .filter((p) => p.venueCount > 0 && p.newCases2566 > 0)
    .sort((a, b) => {
      const scoreA = a.colocation * (1 + a.formalizationGap);
      const scoreB = b.colocation * (1 + b.formalizationGap);
      return scoreB - scoreA;
    })
    .slice(0, 12);

  const topVenues = [...provinces]
    .sort((a, b) => b.venueCount - a.venueCount)
    .slice(0, 10);

  const topCases = [...provinces]
    .sort((a, b) => b.newCases2566 - a.newCases2566)
    .slice(0, 10);

  const lenses = {
    ...(hivPayload?.lenses || {}),
    legitimacy: 'Excise tax marks the tax-paying licensed bath & massage sector. HSS counts are certified นวด สปา providers by province. Overlay inventory venues to see formalization gap — high broadcast density with thin registry is a research signal, not a shop verdict. MoPH therapeutic massage visits are a separate public-clinic channel.',
    worker: 'Two competing readings, neither proven by open incidence data: (1) workers in informal tiers lack VD certificates and district registration; (2) workers have workplace incentive to stay healthy, and historical 100% Condom Programs worked through licensed establishments. Roi Et screening shows sex workers appear in STI screening programs — uptake, not prevalence. Client-side incidence is largely missing from open data; male demand often sits outside workplace health systems.',
  };

  return {
    meta: hivPayload?.source || {},
    year: hivPayload?.yearGregorian || 2023,
    nationalTotal: hivPayload?.nationalTotal || 0,
    bangkokFacility2024: hivPayload?.bangkokFacility2024 || null,
    lenses,
    formalizationMeta: formalizationPayload?.source || null,
    hssNational: formalizationPayload?.hss?.nationalTotal || 0,
    hssGender: formalizationPayload?.hss?.byGender || null,
    excise: formalizationPayload?.excise || null,
    therapeuticMeta: therapeuticPayload
      ? {
        year: therapeuticPayload.yearGregorian,
        nationalTotal: therapeuticPayload.nationalTotal,
        note: therapeuticPayload.source?.note,
      }
      : null,
    provinces,
    rankedCorridors,
    greyHeavy,
    registeredCorridors,
    harmReductionPriority,
    topVenues,
    topCases,
  };
}
