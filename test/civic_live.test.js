import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAdsbLol,
  parseUsgsGeojson,
  parseEonetEvents,
  toGeoJSON,
  formatCivicStatus,
  fetchCivicFlights,
  fetchCivicQuakes,
  fetchCivicFires,
  haversineKm,
  BANGKOK,
} from '../src/lib/civicLive.js';
import {
  encodePulseLayers,
  decodePulseLayers,
  readPulseFromHref,
  writePulseToHref,
  pulseIsEmpty,
} from '../src/lib/civicLayerShare.js';

const ADSB_FIXTURE = {
  now: 1_788_171_303_500,
  total: 2,
  ac: [
    {
      hex: '4246a3',
      flight: 'AZG1581 ',
      r: 'VP-BMU',
      lat: 14.346268,
      lon: 99.909194,
      alt_baro: 19300,
      gs: 287.2,
      track: 293.17,
      seen: 0.1,
      seen_pos: 0.111,
      squawk: '6117',
    },
    { hex: 'abc123', flight: 'GND1', lat: 13.69, lon: 100.75, alt_baro: 'ground', gs: 12, track: 90, seen: 1 },
    { hex: 'dead', flight: 'NOFIX' },
  ],
};

const USGS_FIXTURE = {
  metadata: { generated: 1_788_171_000_000 },
  features: [
    {
      id: 'us7000ph',
      geometry: { type: 'Point', coordinates: [121.0, 14.6, 35] },
      properties: {
        mag: 4.9,
        place: '13 km SSE of Union, Philippines',
        time: 1_788_170_000_000,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000ph',
      },
    },
    {
      id: 'ak1',
      geometry: { type: 'Point', coordinates: [-165, 54, 10] },
      properties: { mag: 2.8, place: 'Alaska', time: 1_788_169_000_000 },
    },
  ],
};

const EONET_FIXTURE = {
  events: [
    {
      id: 'EONET_NEW',
      title: 'Wildfire in Laos',
      link: 'https://eonet.gsfc.nasa.gov/api/v3/events/EONET_NEW',
      sources: [{ id: 'FIRMS' }],
      geometry: [{ date: '2026-08-26T17:29:00Z', type: 'Point', coordinates: [101.59, 20.70] }],
    },
    {
      id: 'EONET_STALE',
      title: 'Wildfire in Thailand 2025',
      geometry: [{ date: '2025-03-28T19:00:00Z', type: 'Point', coordinates: [97.70, 18.18] }],
    },
    {
      id: 'EONET_CA',
      title: 'Wildfire in California',
      geometry: [{ date: '2026-08-26T17:29:00Z', type: 'Point', coordinates: [-117.35, 41.86] }],
    },
  ],
};

test('parseAdsbLol keeps positioned aircraft and drops fix-less rows', () => {
  const bundle = parseAdsbLol(ADSB_FIXTURE);
  assert.equal(bundle.state, 'live');
  assert.equal(bundle.source, 'adsb.lol');
  assert.equal(bundle.items.length, 2);
  assert.equal(bundle.items[0].callsign, 'AZG1581');
  assert.equal(bundle.items[0].id, '4246a3');
  assert.equal(bundle.items[1].onGround, true);
  assert.equal(bundle.fetchedAt, 1_788_171_303_500);
  assert.ok(bundle.items[0].distanceKm < 100);
});

test('parseUsgsGeojson keeps regional quakes and records the global nearest', () => {
  const bundle = parseUsgsGeojson(USGS_FIXTURE);
  assert.equal(bundle.items.length, 1);
  assert.equal(bundle.items[0].mag, 4.9);
  assert.equal(bundle.nearest.id, 'us7000ph');
  assert.equal(bundle.worldwide, 2);
  assert.ok(bundle.items[0].distanceKm < 3500);
  const alaskaKm = haversineKm(BANGKOK, { lat: 54, lon: -165 });
  assert.ok(alaskaKm > 3500);
});

test('parseEonetEvents withholds stale and out-of-corridor events', () => {
  const nowMs = Date.parse('2026-08-31T10:00:00Z');
  const bundle = parseEonetEvents(EONET_FIXTURE, { nowMs });
  assert.equal(bundle.state, 'delayed');
  assert.equal(bundle.items.length, 1);
  assert.equal(bundle.items[0].id, 'EONET_NEW');
  assert.equal(bundle.staleWithheld, 1);
});

test('toGeoJSON is a MapLibre-ready FeatureCollection', () => {
  const geojson = toGeoJSON(parseAdsbLol(ADSB_FIXTURE));
  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 2);
  assert.deepEqual(geojson.features[0].geometry.coordinates.slice(0, 2), [99.909194, 14.346268]);
});

test('formatCivicStatus names live / delayed / unavailable', () => {
  assert.equal(formatCivicStatus(null), 'off');
  assert.match(formatCivicStatus({
    state: 'live', fetchedAt: Date.now(), count: 12, items: [],
  }), /live · 12/);
  assert.match(formatCivicStatus({
    state: 'unavailable', error: 'HTTP 502', items: [],
  }), /unavailable · HTTP 502/);
});

test('pulse codec round-trips compact tokens and ignores junk', () => {
  assert.equal(encodePulseLayers({ flights: true, quakes: true, fires: false }), 'f,q');
  assert.deepEqual(decodePulseLayers('f,q'), { flights: true, quakes: true, fires: false });
  assert.deepEqual(decodePulseLayers('flights,e'), { flights: true, quakes: false, fires: true });
  assert.deepEqual(decodePulseLayers('zzz,nope'), { flights: false, quakes: false, fires: false });
  assert.equal(pulseIsEmpty(decodePulseLayers('')), true);
});

test('share href writes pulse without clobbering other query params', () => {
  const href = writePulseToHref('https://example.org/map?view=map#about', { flights: true });
  assert.equal(href, '/map?view=map&pulse=f#about');
  assert.deepEqual(readPulseFromHref('https://example.org/map?pulse=f,e'), {
    flights: true, quakes: false, fires: true,
  });
  assert.equal(writePulseToHref('/map?pulse=f', {}), '/map');
});

test('fetch wrappers mark unavailable on HTTP failure without throwing', async () => {
  const boom = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const flights = await fetchCivicFlights({ fetchImpl: boom });
  const quakes = await fetchCivicQuakes({ fetchImpl: boom });
  const fires = await fetchCivicFires({ fetchImpl: boom });
  assert.equal(flights.state, 'unavailable');
  assert.equal(quakes.state, 'unavailable');
  assert.equal(fires.state, 'unavailable');
  assert.match(flights.error, /503/);
});

test('fetch wrappers parse a successful mock payload', async () => {
  const ok = (body) => async () => ({ ok: true, json: async () => body });
  const flights = await fetchCivicFlights({ fetchImpl: ok(ADSB_FIXTURE) });
  const quakes = await fetchCivicQuakes({ fetchImpl: ok(USGS_FIXTURE) });
  const fires = await fetchCivicFires({
    fetchImpl: ok(EONET_FIXTURE),
    nowMs: Date.parse('2026-08-31T10:00:00Z'),
  });
  assert.equal(flights.count, 2);
  assert.equal(quakes.count, 1);
  assert.equal(fires.count, 1);
});
