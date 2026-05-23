import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanonicalKey,
  canonicalizePublicListings,
  extractCoordinatesFromText,
  extractMapsAddress,
  isGoogleMapsUrl,
  isBadPublicName,
  isVerifiedLocation,
  mergeCanonicalGroup,
  normalizePublicListing,
  resolveGoogleMapsData,
  validatePublicListing,
} from '../src/lib/listing_contract.js';

test('canonical key prefers Google Maps over phone and LINE', () => {
  const listing = {
    name: 'CHANEL MASSAGE',
    location: 'Lat Phrao 71, Bangkok',
    phone: '098-798-9888',
    lineUrl: 'https://line.me/R/ti/p/@chanelmassage',
    mapsUrl: 'https://maps.app.goo.gl/azDSABsC81aukerH9?g_st=ic',
  };

  assert.equal(
    buildCanonicalKey(listing),
    'maps:maps.app.goo.gl/azdsabsc81aukerh9',
  );
});

test('bad public names reject staff lineups, CTAs, and ad copy', () => {
  assert.equal(isBadPublicName('น้องๆวันที่ 14/4'), true);
  assert.equal(isBadPublicName('เปิดรับรอบจองด่วน 🚫 น้องสายธาร'), true);
  assert.equal(isBadPublicName('โทร 0952598969'), true);
  assert.equal(isBadPublicName('จองคิวนวดที่น'), true);
  assert.equal(isBadPublicName('แอดไลน'), true);
  assert.equal(isBadPublicName('หมายเหต'), true);
  assert.equal(isBadPublicName('เปิด ทุกวัน 11.00น.-22.00น'), true);
  assert.equal(isBadPublicName('เปิดบริการ 10.00-00.00 น'), true);
  assert.equal(isBadPublicName('ติดต่อไลน์ @Issayaspa'), true);
  assert.equal(isBadPublicName('@noah_spa'), true);
  assert.equal(isBadPublicName('หุ่นนางแบบ หุ่นดีหน้าท้องแบนราบ'), true);
  assert.equal(isBadPublicName('คำหอม นวดเพื่อสุขภาพ'), false);
  assert.equal(isBadPublicName('CHANEL MASSAGE'), false);
});

test('default Bangkok fallback is not a verified public location', () => {
  assert.equal(isVerifiedLocation('Bangkok, Thailand'), false);
  assert.equal(isVerifiedLocation('งานนวดจัดจ้านย่านหนองจอก ได้ทุกฟิว'), false);
  assert.equal(isVerifiedLocation('Lat Phrao 71, Bangkok'), true);
});

test('public validation requires identity and identifiable location or contact', () => {
  const invalid = normalizePublicListing(
    {
      name: 'LOUISSPA',
      location: 'Bangkok, Thailand',
      imageUrl: '/mockups/109748.jpg',
    },
    { source: 'snapshot', allowUnverified: true },
  );

  assert.equal(validatePublicListing(invalid).ok, false);
  assert.equal(validatePublicListing(invalid).reason, 'no identifiable location or contact');

  const valid = normalizePublicListing(
    {
      name: 'LOUISSPA',
      location: 'Sampeng 2, Kalapaphruek, Bangkok',
      phone: '083-850-6969',
      latitude: 13.672,
      longitude: 100.42,
    },
    { source: 'snapshot' },
  );

  assert.equal(validatePublicListing(valid).ok, true);
});

test('public validation rejects explicit service copy before visual display', () => {
  const unsafe = normalizePublicListing(
    {
      name: 'The nicha spa',
      location: 'Bangkok, Thailand',
      phone: '0836944562',
      description: 'จบ1999 70นาทีเสร้จไม่อั้น อมไมอั่น',
    },
    { source: 'snapshot', allowUnverified: true },
  );

  assert.equal(validatePublicListing(unsafe).ok, false);
  assert.equal(validatePublicListing(unsafe).reason, 'adult or spam signal');
});

test('merge scoring keeps the business row over staff update rows', () => {
  const merged = mergeCanonicalGroup([
    {
      id: 1,
      name: 'น้องบราวน',
      location: 'Bangkok, Thailand',
      phone: '083-850-6969',
      mapsUrl: 'https://goo.gl/maps/tCno9bahdxnM7koQ8',
      mentionCount: 1,
    },
    {
      id: 2,
      name: 'LOUISSPA สาขา สำเพ็ง2 กัลปพฤกษ',
      location: 'สำเพ็ง2 กัลปพฤกษ์, Bangkok',
      phone: '083-850-6969',
      mapsUrl: 'https://goo.gl/maps/tCno9bahdxnM7koQ8',
      latitude: 13.67,
      longitude: 100.42,
      mentionCount: 3,
    },
  ]);

  assert.equal(merged.name, 'LOUISSPA สาขา สำเพ็ง2 กัลปพฤกษ');
  assert.equal(merged.location, 'สำเพ็ง2 กัลปพฤกษ์, Bangkok');
  assert.equal(merged.mentionCount, 4);
});

test('canonicalize removes duplicate public business rows', () => {
  const rows = canonicalizePublicListings([
    {
      name: 'Phoenix Spa Khlong 4',
      location: 'Khlong 4, Pathum Thani',
      phone: '094-8964563',
      mapsUrl: 'https://maps.app.goo.gl/QANboE8GEMVd4Qq67',
      latitude: 13.9997,
      longitude: 100.693,
    },
    {
      name: 'Phoex Spa',
      location: 'Khlong 4',
      phone: '094-896-4563',
      mapsUrl: 'https://maps.app.goo.gl/QANboE8GEMVd4Qq67?g_st=il',
      latitude: 13.9997,
      longitude: 100.693,
    },
  ], { source: 'snapshot' });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].canonicalKey, 'maps:maps.app.goo.gl/qanboe8gemvd4qq67');
});

test('maps coordinate parser handles common Google redirect shapes', () => {
  assert.deepEqual(extractCoordinatesFromText('https://google.com/maps/@13.7563,100.5018,17z'), [13.7563, 100.5018]);
  assert.deepEqual(extractCoordinatesFromText('https://google.com/maps/place/x/!3d13.7563!4d100.5018'), [13.7563, 100.5018]);
  assert.deepEqual(extractCoordinatesFromText('https://www.google.com/maps/dir/13.9997988,100.6930128/place'), [13.9997988, 100.6930128]);
  assert.deepEqual(extractCoordinatesFromText('center=13.7527296%2C100.5453312'), [13.7527296, 100.5453312]);
  assert.deepEqual(extractCoordinatesFromText('!2d100.54533119999999!3d13.752729599999999'), [13.752729599999999, 100.54533119999999]);
});

test('maps address parser recovers address-bearing URLs and HTML snippets', () => {
  assert.equal(
    extractMapsAddress('https://www.google.com/maps/search/?api=1&query=Lat+Phrao+71%2C+Bangkok'),
    'Lat Phrao 71, Bangkok',
  );
  assert.equal(
    extractMapsAddress('<a href="/maps/preview/place?query=Relax+Society+Massage%2C+Bangkok&amp;center=13.7%2C100.5">Map</a>'),
    'Relax Society Massage, Bangkok',
  );
  assert.equal(extractMapsAddress('https://www.google.com/maps/search/?api=1&query=13.7%2C100.5'), '');
});

test('maps resolver follows shortlink redirects before reading final HTML', async () => {
  const calls = [];
  const responses = [
    {
      status: 302,
      headers: {
        get(name) {
          return name.toLowerCase() === 'location'
            ? 'https://maps.google.com?q=Lat+Phrao+71%2C+Bangkok'
            : null;
        },
      },
      text: async () => '',
    },
    {
      status: 200,
      headers: { get: () => null },
      text: async () => '<html>center=13.7527296%2C100.5453312</html>',
    },
  ];
  const fetchImpl = async (url) => {
    calls.push(url);
    return responses.shift();
  };

  const result = await resolveGoogleMapsData('https://maps.app.goo.gl/example', { fetchImpl });

  assert.equal(calls.length, 2);
  assert.equal(result.address, 'Lat Phrao 71, Bangkok');
  assert.equal(result.latitude, 13.7527296);
  assert.equal(result.longitude, 100.5453312);
});

test('maps resolver blocks non-Google URLs before fetching', async () => {
  let called = false;
  const result = await resolveGoogleMapsData('http://127.0.0.1/admin', {
    fetchImpl: async () => {
      called = true;
      return { status: 200, headers: { get: () => null }, text: async () => '' };
    },
  });

  assert.equal(result, null);
  assert.equal(called, false);
});

test('maps resolver blocks redirects away from Google Maps', async () => {
  const calls = [];
  const result = await resolveGoogleMapsData('https://maps.app.goo.gl/example', {
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        status: 302,
        headers: {
          get(name) {
            return name.toLowerCase() === 'location'
              ? 'http://169.254.169.254/latest/meta-data'
              : null;
          },
        },
        text: async () => '',
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(result.latitude, null);
  assert.equal(result.longitude, null);
});

test('maps URL allowlist accepts known Google Maps share shapes', () => {
  assert.equal(isGoogleMapsUrl('https://maps.app.goo.gl/example'), true);
  assert.equal(isGoogleMapsUrl('https://g.co/kgs/example'), true);
  assert.equal(isGoogleMapsUrl('https://www.google.co.th/maps/place/example'), true);
  assert.equal(isGoogleMapsUrl('https://example.com/maps/place/example'), false);
  assert.equal(isGoogleMapsUrl('https://maps.google.evil.com/maps/place/example'), false);
  assert.equal(isGoogleMapsUrl('file:///etc/passwd'), false);
});
