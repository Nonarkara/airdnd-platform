import { classifyArea, haversineKm, TRANSIT_STATIONS } from './geo.js';

export function sourceTime(listing) {
  const value = listing.postedAt || listing.posted_at;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function storedCoordinates(listing) {
  const lat = listing.latitude;
  const lng = listing.longitude;
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const coords = [Number(lat), Number(lng)];
  return coords.every(Number.isFinite) && Math.abs(coords[0]) <= 90 && Math.abs(coords[1]) <= 180
    && !(coords[0] === 0 && coords[1] === 0) ? coords : null;
}

// Inputs are the same canonical records rendered by the directory. Do not
// turn area centroids into venue coordinates or equate post counts with demand.
export function buildPublicWorks(listings, now = Date.now()) {
  const rows = listings.map((listing) => {
    const area = classifyArea({ location: listing.location }) || 'Area not resolved';
    const coords = storedCoordinates(listing);
    const posted = sourceTime(listing);
    const recent = posted !== null && posted <= now && now - posted <= 7 * 86400000;
    let transit = null;
    if (coords) {
      for (const station of TRANSIT_STATIONS) {
        const km = haversineKm(coords, station.coords);
        if (!transit || km < transit.km) transit = { name: station.name, km };
      }
    }
    return { listing, area, coords, posted, recent, transit };
  });
  const grouped = new Map();
  for (const row of rows) {
    const group = grouped.get(row.area) || { area: row.area, count: 0, recent: 0, coordinates: 0 };
    group.count += 1;
    group.recent += Number(row.recent);
    group.coordinates += Number(Boolean(row.coords));
    grouped.set(row.area, group);
  }
  const areas = [...grouped.values()].sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
  return {
    rows, areas,
    located: rows.filter((r) => r.coords).length,
    resolved: rows.filter((r) => r.area !== 'Area not resolved').length,
    recent: rows.filter((r) => r.recent).length,
    latest: rows.reduce((latest, r) => r.posted !== null && r.posted <= now ? Math.max(latest || 0, r.posted) : latest, null),
  };
}
