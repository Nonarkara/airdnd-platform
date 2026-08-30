import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listingMatchesFilters,
  mergeDirectory,
  poiToListing,
} from '../src/lib/longdoListings.js';

test('poiToListing marks Longdo source and keeps coordinates', () => {
  const listing = poiToListing({
    longdoId: 'A10048342',
    name: 'Johny Massage & Spa',
    nameTh: 'จอห์นนี่ มาสซาจ แอนด์ สปา',
    addressEn: 'Hua Hin, Prachuap Khiri Khan',
    city: 'Prachuap Khiri Khan',
    latitude: 12.53,
    longitude: 99.96,
    phone: '032-123-456',
    poiType: 'spa',
  });

  assert.equal(listing.source, 'longdo');
  assert.equal(listing.id, 'longdo-A10048342');
  assert.equal(listing.latitude, 12.53);
  assert.equal(listing.mapsUrl, 'https://map.longdo.com/p/A10048342');
  assert.deepEqual(listing.tags, ['Longdo POI']);
});

test('mergeDirectory keeps overlapping Longdo POIs off the card list but never drops Telegram', () => {
  const telegram = [
    { id: 'tg-1', name: 'Johny Massage & Spa', city: 'Prachuap Khiri Khan', phone: '032123456' },
    { id: 'tg-2', name: 'LOUISSPA', city: 'Bangkok', phone: '0838506969' },
  ];
  const longdo = [
    poiToListing({
      longdoId: 'A1',
      name: 'Johny Massage & Spa',
      city: 'Prachuap Khiri Khan',
      phone: '032-123-456',
      latitude: 12.53,
      longitude: 99.96,
    }),
    poiToListing({
      longdoId: 'A2',
      name: 'Baan Sabai Spa',
      city: 'Chiang Mai',
      latitude: 18.79,
      longitude: 98.98,
    }),
  ];

  const merged = mergeDirectory(telegram, longdo);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'tg-1');
  assert.equal(merged[1].id, 'tg-2');
  assert.equal(merged[2].longdoId, 'A2');
});

test('listingMatchesFilters searches Thai and English names', () => {
  const listing = poiToListing({
    longdoId: 'A9',
    name: 'Johny Massage & Spa',
    nameTh: 'จอห์นนี่ มาสซาจ',
    city: 'Hua Hin',
    latitude: 12.5,
    longitude: 99.9,
  });

  assert.equal(listingMatchesFilters(listing, { search: 'จอห์นนี่' }), true);
  assert.equal(listingMatchesFilters(listing, { search: 'johny' }), true);
  assert.equal(listingMatchesFilters(listing, { location: 'Phuket' }), false);
  assert.equal(listingMatchesFilters(listing, { priceTier: 'economy' }), false);
});
