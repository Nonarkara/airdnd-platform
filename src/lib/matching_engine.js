import { haversineKm, listingCoords } from './geo';

/**
 * Universal Two-Sided Active Demand-Supply Matching Engine
 *
 * Computes an affinity score [0..100] between a Demand Request (RFQ / Inquiry)
 * and a Supply Candidate (Listing).
 *
 * Formula:
 * MatchScore(D, S) = w_cat * CatScore + w_geo * GeoScore + w_price * PriceScore + w_fresh * FreshnessScore
 */

export const DEFAULT_WEIGHTS = {
  category: 0.35,
  geo: 0.35,
  price: 0.20,
  freshness: 0.10,
};

export function scoreDemandSupplyMatch(demand, supplier, customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  // 1. Category & Tag Affinity Score [0..1]
  let categoryScore = 0.5; // Neutral baseline
  const supplierTags = [
    ...(Array.isArray(supplier.tags) ? supplier.tags : []),
    ...(Array.isArray(supplier.serviceTags) ? supplier.serviceTags : []),
  ].map((t) => String(t).toLowerCase());

  const demandTags = Array.isArray(demand.tags) ? demand.tags.map((t) => String(t).toLowerCase()) : [];
  const textBlob = `${supplier.name || ''} ${supplier.description || ''} ${supplierTags.join(' ')}`.toLowerCase();

  if (demand.category) {
    const catQuery = String(demand.category).toLowerCase();
    if (textBlob.includes(catQuery) || supplierTags.some((t) => t.includes(catQuery))) {
      categoryScore = 1.0;
    } else {
      categoryScore = 0.3;
    }
  }

  if (demandTags.length > 0) {
    const hits = demandTags.filter((t) => textBlob.includes(t) || supplierTags.includes(t)).length;
    const tagAffinity = hits / demandTags.length;
    categoryScore = Math.max(categoryScore, tagAffinity);
  }

  // 2. Geographic Proximity Score [0..1]
  let geoScore = 0.5;
  let distanceKm = null;
  const supplierCoordsInfo = listingCoords(supplier);

  if (demand.coords && supplierCoordsInfo?.coords) {
    distanceKm = haversineKm(demand.coords, supplierCoordsInfo.coords);
    const maxRadius = demand.maxRadiusKm || 20.0;
    geoScore = Math.max(0, 1 - distanceKm / maxRadius);
  } else if (demand.areaName && supplier.location) {
    if (String(supplier.location).toLowerCase().includes(String(demand.areaName).toLowerCase())) {
      geoScore = 0.9;
    }
  }

  // 3. Price / Financial Fit Score [0..1]
  let priceScore = 0.7; // Neutral if unstated
  const supplierPrice = Number.isFinite(supplier.priceValue) && supplier.priceValue > 0 ? supplier.priceValue : null;

  if (demand.maxBudget && supplierPrice !== null) {
    if (supplierPrice <= demand.maxBudget) {
      priceScore = 1.0;
    } else {
      const overageRatio = (supplierPrice - demand.maxBudget) / demand.maxBudget;
      priceScore = Math.max(0, 1 - overageRatio);
    }
  }

  // 4. Freshness & Availability Score [0..1]
  let freshnessScore = 0.5;
  const lastActiveTime = new Date(supplier.postedAt || supplier.updatedAt || supplier.createdAt || 0).getTime();
  if (lastActiveTime > 0) {
    const hoursElapsed = (Date.now() - lastActiveTime) / 3_600_000;
    // Clamp to [0.1, 1] — exp() is unbounded above for negative `hoursElapsed`
    // (future-dated posts from clock-skewed Telegram messages would otherwise
    // score >1 and systematically outrank genuinely fresh listings).
    freshnessScore = Math.max(0.1, Math.min(1, Math.exp(-hoursElapsed / 48.0))); // 48h half-life
  }

  const isExplicitlyAvailable = /ว่าง|พร้อม|available|walk[ -]?in/i.test(textBlob);
  if (isExplicitlyAvailable) {
    freshnessScore = Math.min(1.0, freshnessScore + 0.3);
  }

  // Weighted Composite
  const composite =
    categoryScore * weights.category +
    geoScore * weights.geo +
    priceScore * weights.price +
    freshnessScore * weights.freshness;

  const finalScore = Math.min(100, Math.max(0, Math.round(composite * 100)));

  return {
    supplier,
    score: finalScore,
    distanceKm,
    price: supplierPrice,
    breakdown: {
      category: Math.round(categoryScore * 100),
      geo: Math.round(geoScore * 100),
      price: Math.round(priceScore * 100),
      freshness: Math.round(freshnessScore * 100),
    },
  };
}

export function rankMatches(demand, suppliers, limit = 10, weights) {
  if (!Array.isArray(suppliers)) return [];
  const scored = suppliers
    .map((s) => scoreDemandSupplyMatch(demand, s, weights))
    .filter((res) => res.score > 15)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
