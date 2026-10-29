/**
 * A one-off reading of the four things the derived limits point at.
 * Not an instrument — a question, asked once, answered in numbers.
 *
 *   node scripts/spatial/_read-hierarchy.mjs [base]
 */
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8124').replace(/\/+$/, '');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

// 1. THE FIND VIEW'S TITLE TIE. Where the title is exactly the same size as
//    the next largest text, and what that text is.
await page.goto(`${BASE}/find/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!document.querySelector('.find-panel-stats dd'), { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(600);

const tie = await page.evaluate(() => {
  const h1 = document.querySelector('main h1');
  const title = parseFloat(getComputedStyle(h1).fontSize);
  const out = { title, peers: [] };
  for (const el of document.querySelectorAll('main *')) {
    if (h1.contains(el)) continue;
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\s+/g, ' ').trim();
    if (!own) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (fs >= title - 0.5) {
      out.peers.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.getAttribute('class') || '').slice(0, 40),
        fs,
        w: Number(cs.fontWeight),
        text: own.slice(0, 40),
      });
    }
  }
  return out;
});
console.log('FIND @390 — title', tie.title, 'px; anything at or above it:');
for (const p of tie.peers) console.log('   ', p.tag, p.cls, p.fs + 'px', 'w' + p.w, JSON.stringify(p.text));

// 2. THE LOUD PEERS OF THE FIND VIEW. What is actually shouting.
await page.goto(`${BASE}/find/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!document.querySelector('.find-panel-stats dd'), { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(600);
const loud = await page.evaluate(() => {
  const main = document.querySelector('main#content') || document.querySelector('main');
  const h1 = main.querySelector('h1');
  const title = parseFloat(getComputedStyle(h1).fontSize);
  const tally = {};
  let peerChars = 0, bodyChars = 0;
  for (const el of main.querySelectorAll('*')) {
    let own = '';
    for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.replace(/\s+/g, ' ').trim();
    if (!own) continue;
    if (h1.contains(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const w = Number(cs.fontWeight) || 400;
    bodyChars += own.length;
    if (w >= 600 && fs >= 15 && fs < title) {
      peerChars += own.length;
      const k = el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '').split(/\s+/)[0];
      tally[k] = (tally[k] || 0) + own.length;
    }
  }
  return { share: Math.round((peerChars / bodyChars) * 1000) / 1000, peerChars, bodyChars, tally };
});
console.log('\nFIND loud share', loud.share, '—', loud.peerChars, 'of', loud.bodyChars, 'chars');
for (const [k, v] of Object.entries(loud.tally).sort((a, b) => b[1] - a[1])) console.log('   ', k, v, 'chars');

// 3. THE HISTORY VIEW'S FIRST ACTION. 11,870px of reading before the first
//    control. What is in that space?
await page.goto(`${BASE}/history/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const hist = await page.evaluate(() => {
  const main = document.querySelector('main#content') || document.querySelector('main');
  const acts = [...main.querySelectorAll('a[href], button, input, select, textarea')];
  const first = acts.find((a) => {
    const r = a.getBoundingClientRect();
    return r.width && r.height && r.right > 0 && r.left < innerWidth;
  });
  const r = first ? first.getBoundingClientRect() : null;
  // What sits in the space above it?
  const above = [];
  for (const el of main.querySelectorAll('h1,h2,h3,.chapter-h,.hs-plate,figure,section')) {
    const b = el.getBoundingClientRect();
    if (b.height && b.top < 3000) {
      above.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.getAttribute('class') || '').split(/\s+/).slice(0, 2).join('.'),
        top: Math.round(b.top + scrollY),
        h: Math.round(b.height),
        text: (el.textContent || '').trim().slice(0, 44),
      });
    }
  }
  return {
    firstAction: r ? { top: Math.round(r.top + scrollY), sel: first.tagName.toLowerCase() + '.' + String(first.getAttribute('class') || '').split(/\s+/)[0], text: (first.textContent || '').trim().slice(0, 40) } : null,
    pageHeight: Math.round(document.documentElement.scrollHeight),
    above: above.slice(0, 18),
  };
});
console.log('\nHISTORY — page height', hist.pageHeight, '| first action', JSON.stringify(hist.firstAction));
for (const a of hist.above) console.log('   ', a.top, '+' + a.h, a.tag, a.cls, JSON.stringify(a.text));

await browser.close();
