// Anti-slop gate (cheap, no browser): keeps the design pass from regressing.
// 1. No emoji-as-icon in the public map/finder/gallery/card components.
// 2. Every English string these components use has a Thai and Chinese version (EN/TH/ZH rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { translations } from '../src/translations.js';

const COMPONENTS = ['ListingCard', 'ListingMap', 'PlaceGallery', 'ProximityFinder'];
const NAMESPACES = ['card', 'map', 'places', 'proximity'];

test('public components carry no emoji icons', () => {
  for (const name of COMPONENTS) {
    const src = fs.readFileSync(new URL(`../src/components/${name}.jsx`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const hits = src.match(/\p{Emoji_Presentation}/gu) || [];
    assert.deepEqual(hits, [], `${name}.jsx has emoji icons: ${hits.join(' ')}`);
  }
});

const leaves = (obj, prefix = '') => Object.entries(obj || {}).flatMap(([k, v]) =>
  v && typeof v === 'object' && !Array.isArray(v) ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

for (const lang of ['th', 'zh']) {
  test(`${lang} covers every English key the public components use`, () => {
    for (const ns of NAMESPACES) {
      const missing = leaves(translations.en[ns]).filter((k) => get(translations[lang][ns], k) == null);
      assert.deepEqual(missing, [], `${lang}.${ns} is missing: ${missing.join(', ')}`);
    }
  });
}
