import assert from 'node:assert/strict';
import test from 'node:test';
import jpeg from 'jpeg-js';

import { clusterPhotos, dHashJpeg, hamming, sha256 } from '../scripts/lib/photo_hash.js';

// A synthetic "photo": smooth shapes, so it behaves like a picture under
// re-compression rather than like noise.
function picture(width, height, seed) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const i = (y * width + x) * 4;
      data[i] = Math.round(127 + 120 * Math.sin((u * 3 + seed) * Math.PI));
      data[i + 1] = Math.round(127 + 120 * Math.cos((v * 2 + seed * 0.7) * Math.PI));
      data[i + 2] = Math.round(255 * ((u + v + seed) % 1));
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}
const encode = (img, quality) => jpeg.encode(img, quality).data;

function resize({ width, height, data }, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const sx = Math.floor((x * width) / w);
    const sy = Math.floor((y * height) / h);
    data.copy(out, (y * w + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
  }
  return { width: w, height: h, data: out };
}

test('a re-compressed or resized re-post has the same picture fingerprint', () => {
  const original = picture(640, 480, 0.3);
  const hi = dHashJpeg(encode(original, 92));
  const lo = dHashJpeg(encode(original, 35));
  const small = dHashJpeg(encode(resize(original, 320, 240), 70));
  assert.equal(hi.width, 640);
  assert.ok(hamming(hi.hash, lo.hash) <= 3, `quality change moved ${hamming(hi.hash, lo.hash)} bits`);
  assert.ok(hamming(hi.hash, small.hash) <= 4, `resize moved ${hamming(hi.hash, small.hash)} bits`);
});

test('different pictures have distant fingerprints', () => {
  const a = dHashJpeg(encode(picture(640, 480, 0.3), 90)).hash;
  const b = dHashJpeg(encode(picture(640, 480, 1.9), 90)).hash;
  assert.ok(hamming(a, b) > 12, `only ${hamming(a, b)} bits apart`);
});

test('non-JPEG and corrupt input yield no fingerprint instead of throwing', () => {
  assert.equal(dHashJpeg(Buffer.from('PNG not really')), null);
  assert.equal(dHashJpeg(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01])), null);
});

test('clustering keeps one copy per picture — the largest file', () => {
  const pic = picture(640, 480, 0.3);
  const hiBuf = encode(pic, 92);
  const loBuf = encode(pic, 35);
  const other = encode(picture(640, 480, 1.9), 90);
  const photos = [
    { key: 'repost-lowq.jpg', buf: loBuf },
    { key: 'original.jpg', buf: hiBuf },
    { key: 'exact-copy.jpg', buf: Buffer.from(hiBuf) },
    { key: 'different.jpg', buf: other },
    { key: 'not-a-jpeg.png', buf: Buffer.from('png bytes') },
  ].map(({ key, buf }) => ({ key, sha: sha256(buf), dhash: dHashJpeg(buf)?.hash || null, bytes: buf.length }));

  const canonical = clusterPhotos(photos);
  // original.jpg and exact-copy.jpg are the same size; the tie goes to the
  // alphabetically first name, so the choice is stable across runs.
  assert.equal(canonical.get('repost-lowq.jpg'), 'exact-copy.jpg');
  assert.equal(canonical.get('original.jpg'), canonical.get('exact-copy.jpg'));
  assert.equal(canonical.get('different.jpg'), 'different.jpg');
  assert.equal(canonical.get('not-a-jpeg.png'), 'not-a-jpeg.png');
  assert.equal(new Set(canonical.values()).size, 3);
});

test('near-duplicate matching finds everything within the threshold without comparing all pairs', () => {
  // Hashes differing by exactly 6 bits spread across bands must still meet.
  const a = '0000000000000000';
  const b = '8080808080800000'; // 6 bits set, one in each of the first six bands
  const c = 'ffffffffffffffff';
  const canonical = clusterPhotos([
    { key: 'a', sha: 'x1', dhash: a, bytes: 10 },
    { key: 'b', sha: 'x2', dhash: b, bytes: 20 },
    { key: 'c', sha: 'x3', dhash: c, bytes: 30 },
  ]);
  assert.equal(hamming(a, b), 6);
  assert.equal(canonical.get('a'), 'b');
  assert.equal(canonical.get('c'), 'c');
  assert.throws(() => clusterPhotos([], { threshold: 8 }));
});

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

function fakeR2() {
  const objects = new Map();
  const puts = [];
  const server = http.createServer((req, res) => {
    if (!String(req.headers.authorization || '').startsWith('AWS4-HMAC-SHA256 Credential=test-key/')) {
      res.writeHead(403); res.end('unsigned'); return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'HEAD') { res.writeHead(objects.has(req.url) ? 200 : 404); res.end(); return; }
      if (req.method === 'PUT') {
        objects.set(req.url, { body: Buffer.concat(chunks), type: req.headers['content-type'], cache: req.headers['cache-control'] });
        puts.push(req.url);
        res.writeHead(200); res.end(); return;
      }
      if (req.method === 'DELETE') { objects.delete(req.url); res.writeHead(204); res.end(); return; }
      res.writeHead(405); res.end();
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, objects, puts, port: server.address().port })));
}

test('publish end to end: one copy per picture, screened, idempotent, and the gallery collapses', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-'));
  const archive = path.join(dir, 'archive', 'relaxsociety', '2026-09-01');
  fs.mkdirSync(archive, { recursive: true });
  const A = picture(640, 480, 0.3);
  const files = {
    'a1.jpg': encode(A, 92),
    'a2.jpg': encode(A, 35), // Telegram re-post of the same picture
    'b1.jpg': encode(picture(640, 480, 1.1), 90), // only on a screened-out listing
    'c1.jpg': encode(picture(640, 480, 1.5), 90), // on no listing
    'd1.jpg': encode(picture(640, 480, 1.9), 90),
  };
  files['a3.jpg'] = Buffer.from(files['a1.jpg']); // byte-identical copy
  for (const [name, buf] of Object.entries(files)) fs.writeFileSync(path.join(archive, name), buf);

  const dbPath = path.join(dir, 'sabai.db');
  const { openLocalDb } = await import('../scripts/lib/local_store.js');
  const db = openLocalDb(dbPath);
  const cloud = 'https://x.supabase.co/storage/v1/object/public/listing-photos/telegram/relaxsociety/2026-09-01';
  const insert = db.prepare('INSERT INTO companions (id, name, location, phone, image_url, photo_urls, is_safe_image) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insert.run(1, 'Garden Spa', 'แขวงบางชัน เขตคลองสามวา กรุงเทพมหานคร', '0811111111', `${cloud}/a3.jpg`,
    JSON.stringify([`${cloud}/a1.jpg`, `${cloud}/a2.jpg`, '/images/relaxsociety/2026-09-01/d1.jpg']), 1);
  insert.run(2, 'Other Place', 'Bangkok', '0822222222', null, JSON.stringify([`${cloud}/b1.jpg`]), 0);
  db.close();

  const r2 = await fakeR2();
  const env = {
    ...process.env,
    LOCAL_DB: '1', LOCAL_DB_PATH: dbPath,
    PHOTO_LEDGER_PATH: path.join(dir, 'ledger.json'), PHOTO_MAP_PATH: path.join(dir, 'map.json'), OPS_STATUS_PATH: path.join(dir, 'ops-status.json'),
    R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret', R2_BUCKET: 'sabai-photos',
    R2_ENDPOINT: `http://127.0.0.1:${r2.port}`, PHOTO_PUBLIC_BASE_URL: 'https://photos.example/',
  };
  const args = ['scripts/publish_photos.js', '--only-archive', '--archive', path.join(dir, 'archive'), '--upload'];
  try {
    const first = await run(process.execPath, args, { env, cwd: process.cwd() });
    assert.match(first.stdout, /files 6 → unique pictures 4 \(2 duplicates collapsed\)/);
    assert.match(first.stdout, /publish 2 · withheld by safety screen 1 · archive only \(on no listing\) 1/);
    assert.match(first.stdout, /COMPLETE/);
    assert.equal(r2.puts.length, 2, 'one upload per published picture');
    const status = JSON.parse(fs.readFileSync(env.OPS_STATUS_PATH, 'utf8')).photos;
    assert.equal(status.ok, true);
    assert.equal(status.published, 2, 'the watchdog can see the nightly run');
    for (const [, obj] of r2.objects) {
      assert.equal(obj.type, 'image/jpeg');
      assert.match(obj.cache, /immutable/);
    }

    const map = JSON.parse(fs.readFileSync(env.PHOTO_MAP_PATH, 'utf8')).map;
    assert.deepEqual(Object.keys(map).sort(), ['a1.jpg', 'a2.jpg', 'a3.jpg', 'd1.jpg']);
    assert.equal(map['a1.jpg'], map['a2.jpg']);
    assert.equal(map['a1.jpg'], map['a3.jpg']);
    assert.match(map['a1.jpg'], /^https:\/\/photos\.example\/photos\/[0-9a-f]{64}\.jpg$/);
    assert.equal(map['b1.jpg'], undefined, 'screened-out picture is not published');
    assert.equal(map['c1.jpg'], undefined, 'unscreened picture stays in the archive');

    // Re-running uploads nothing new.
    await run(process.execPath, args, { env, cwd: process.cwd() });
    assert.equal(r2.puts.length, 2);

    // On the site: four links (three of them the same picture) become two.
    const { canonicalizePublicListings } = await import('../src/lib/listing_contract.js');
    const [listing] = canonicalizePublicListings([{
      id: 1, name: 'Garden Spa', phone: '0811111111', image_url: `${cloud}/a3.jpg`,
      photo_urls: [`${cloud}/a1.jpg`, `${cloud}/a2.jpg`, '/images/relaxsociety/2026-09-01/d1.jpg'],
    }], { source: 'snapshot', allowUnverified: true, photoMap: new Map(Object.entries(map)) });
    assert.equal(listing.imageUrl, map['a1.jpg']);
    assert.deepEqual(listing.allPhotoUrls, [map['a1.jpg'], map['d1.jpg']]);

    // The listing is flagged later: its pictures leave the bucket, not only the map.
    const flag = openLocalDb(dbPath);
    flag.prepare('UPDATE companions SET is_safe_image = 0 WHERE id = 1').run();
    flag.close();
    const dry = await run(process.execPath, args.filter((a) => a !== '--upload'), { env, cwd: process.cwd() });
    assert.match(dry.stdout, /2 previously published picture\(s\) are now withheld and will be removed/);
    assert.equal(r2.objects.size, 2, 'a dry run removes nothing');
    const third = await run(process.execPath, args, { env, cwd: process.cwd() });
    assert.match(third.stdout, /removed 2 withheld picture\(s\) from the bucket/);
    assert.match(third.stdout, /COMPLETE/);
    assert.equal(r2.objects.size, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(env.PHOTO_MAP_PATH, 'utf8')).map, {});
  } finally {
    r2.server.close();
  }
});

test('the R2 client refuses to run without credentials', async () => {
  const { createR2Client } = await import('../scripts/lib/r2_client.js');
  assert.throws(() => createR2Client({ bucket: 'b' }), /R2_ACCESS_KEY_ID/);
});

test('a link to an already-published copy still counts as a reference to that picture', async () => {
  const { planPublication } = await import('../scripts/publish_photos.js');
  const { rewritePhotoUrl } = await import('../src/lib/listing_contract.js');
  const shaA = 'a'.repeat(64);
  const shaB = 'b'.repeat(64);
  const photos = [
    { key: 'a1.jpg', sha: shaA, dhash: null, bytes: 100 },
    { key: 'b1.jpg', sha: shaB, dhash: null, bytes: 100 },
  ];
  // feed.json after a previous run: its links already point at R2.
  const map = new Map([['a1.jpg', `https://photos.example/photos/${shaA}.jpg`], ['b1.jpg', `https://photos.example/photos/${shaB}.jpg`]]);
  const feedUrl = (name) => rewritePhotoUrl(`https://x.supabase.co/storage/v1/object/public/listing-photos/t/${name}`, map);
  assert.equal(feedUrl('a1.jpg'), map.get('a1.jpg'));
  assert.equal(feedUrl('z9.jpg'), 'https://x.supabase.co/storage/v1/object/public/listing-photos/t/z9.jpg', 'unpublished links are left alone');

  const { clusters, stats } = planPublication({
    photos,
    references: [{ urls: [feedUrl('a1.jpg')], safe: true }, { urls: [feedUrl('b1.jpg')], safe: false }],
  });
  const status = Object.fromEntries(clusters.map((c) => [c.canonical, c.status]));
  assert.deepEqual(status, { 'a1.jpg': 'publish', 'b1.jpg': 'withheld' });
  assert.equal(stats.referencesToMissingFiles, 0);
});

test('Firestore re-pointing touches only photo fields and counts what the site would still load from Supabase', async () => {
  const { planPhotoRelink } = await import('../scripts/firestore_sync.js');
  const sb = (name) => `https://x.supabase.co/storage/v1/object/public/listing-photos/t/${name}`;
  const pub = (sha) => `https://photos.example/photos/${sha}.jpg`;
  const map = new Map([['a1.jpg', pub('a')], ['a2.jpg', pub('a')], ['b1.jpg', pub('b')]]);
  const docs = [
    { id: '1', data: { name: 'Garden Spa', isSafeImage: true, imageUrl: sb('a2.jpg'), allPhotoUrls: [sb('a1.jpg'), sb('a2.jpg'), sb('z9.jpg')] } },
    { id: '2', data: { name: 'Screened', isSafeImage: false, imageUrl: sb('x1.jpg'), allPhotoUrls: [sb('x1.jpg')] } },
    { id: '3', data: { name: 'Done', isSafeImage: true, imageUrl: pub('b'), allPhotoUrls: [pub('b')] } },
  ];
  const { updates, stats } = planPhotoRelink(docs, map);
  assert.deepEqual(updates, [{ id: '1', fields: { imageUrl: pub('a'), allPhotoUrls: [pub('a'), sb('z9.jpg')] } }]);
  assert.deepEqual(stats, { documents: 3, supabaseLinksBefore: 6, supabaseLinksAfter: 1, hiddenLinksAfter: 2, documentsChanged: 1 });
  assert.equal(planPhotoRelink(docs, null).updates.length, 0, 'no map, no writes');
});
