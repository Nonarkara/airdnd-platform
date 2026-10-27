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

test('canonical key prefers phone over Google Maps and LINE', () => {
  const listing = {
    name: 'CHANEL MASSAGE',
    location: 'Lat Phrao 71, Bangkok',
    phone: '098-798-9888',
    lineUrl: 'https://line.me/R/ti/p/@chanelmassage',
    mapsUrl: 'https://maps.app.goo.gl/azDSABsC81aukerH9?g_st=ic',
  };

  assert.equal(
    buildCanonicalKey(listing),
    'phone:0987989888',
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
  assert.equal(rows[0].canonicalKey, 'phone:0948964563');
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
  // `center=` in the page body is the viewport Google happens to open on, not
  // the place: pairing it with a shop pinned 14 different shops on one point.
  // Only a place marker in the redirect chain is a coordinate.
  assert.equal(result.latitude, null);
  assert.equal(result.longitude, null);
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

test('maps resolver reads the place marker from the redirect URL, not the viewport', async () => {
  const responses = [
    {
      status: 302,
      headers: {
        get: (name) => (name.toLowerCase() === 'location'
          ? 'https://www.google.com/maps/place/Shop/@13.80,100.60,17z/data=!3m1!4b1!4m6!3m5!8m2!3d13.7952!4d100.6061'
          : null),
      },
      text: async () => '',
    },
    { status: 200, headers: { get: () => null }, text: async () => '<html>13.95218835, 100.564992</html>' },
  ];
  const result = await resolveGoogleMapsData('https://maps.app.goo.gl/example', { fetchImpl: async () => responses.shift() });
  assert.equal(result.latitude, 13.7952);
  assert.equal(result.longitude, 100.6061);
  assert.equal(result.coordinateSource, 'maps-url');
});

test('the Google page-chrome default is never accepted as a coordinate', () => {
  assert.equal(extractCoordinatesFromText('https://google.com/maps/@13.95218835,100.564992,15z'), null);
  assert.equal(extractCoordinatesFromText('<div>13.8805 100.6040 lorem 13.95 100.56</div>'), null);
});

test('display cleaning keeps a Thai name\'s final vowel or tone mark', async () => {
  const { cleanDisplayText } = await import('../src/lib/normalization.js');
  assert.equal(cleanDisplayText('ร้านเปิดใหม่ '), 'ร้านเปิดใหม่');
  assert.equal(cleanDisplayText('  เซ็นเตอร์!!'), 'เซ็นเตอร์');
  assert.equal(cleanDisplayText('นวดเพื่อสุขภาพ…'), 'นวดเพื่อสุขภาพ');
});

test('a heading is never shown as a business name; the listing stays', async () => {
  const { canonicalizePublicListings, isPlaceholderName, UNNAMED_VENUE } = await import('../src/lib/listing_contract.js');
  for (const heading of ['GRAND OPENING PROMOTION', 'Facebook page', 'เปิดใหม่28/09/69', '#หมอนวดแนะนำ', 'www.massagehotelbangkok.com',
    'นวดไทย • นวดไทยผสมออยล์ • นวดน้ำมันผ่อนคลาย • นวดเท้า', 'นวด กรุงเทพมหานคร', 'ร้านเปิดใหม่']) {
    assert.equal(isPlaceholderName(heading), true, heading);
  }
  for (const name of ['A5 Massage', 'กุหลาบ นวดเพื่อสุขภาพ', 'มูนเรสต์ นวด&สปา', 'SBM (sabaispa by michel)', 'Relax Society Massage']) {
    assert.equal(isPlaceholderName(name), false, name);
  }
  const base = { phone: '0811111111', location: 'แขวงบางชัน เขตคลองสามวา กรุงเทพมหานคร', description: 'Thai massage and oil massage, open daily' };
  // A real alias wins over the heading.
  const [withAlias] = canonicalizePublicListings([
    { ...base, id: 1, name: 'GRAND OPENING PROMOTION', postedAt: '2026-10-20T00:00:00Z' },
    { ...base, id: 2, name: 'Garden Spa' },
  ], { source: 'snapshot', allowUnverified: true });
  assert.equal(withAlias.name, 'Garden Spa');
  // No alias: the shop is kept, labelled plainly, heading still searchable.
  const [alone] = canonicalizePublicListings([{ ...base, id: 3, name: 'Facebook page' }], { source: 'snapshot', allowUnverified: true });
  assert.equal(alone.name, UNNAMED_VENUE);
  assert.equal(alone.postedTitle, 'Facebook page');
  assert.ok(alone.aliasNames.includes('Facebook page'));
  assert.equal(alone.phone, '0811111111');
});
