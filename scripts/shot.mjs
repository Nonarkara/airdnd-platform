#!/usr/bin/env node
/**
 * Screenshot the live site at the three widths the anti-slop review
 * checklist demands, for every top-level view.
 *
 * Usage: node scripts/shot.mjs [base] [outDir]
 * Output: <outDir>/<view>-<width>.png  +  <outDir>/report.json
 *
 * The SPA renders client-side and the Find view fetches 77 province
 * shards before it has a full result set, so every shot waits for the
 * network to go quiet and then for the layout to stop moving.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://otop.pages.dev/';
const OUT = process.argv[3] || '/tmp/otop-shots';
const WIDTHS = [1440, 1024, 390];

const VIEWS = [
  ['find', '/?view=find'],
  ['method', '/?view=method'],
  ['atlas', '/?view=atlas'],
  ['atlas-reach', '/?view=atlas&tab=reach'],
  ['atlas-money', '/?view=atlas&tab=money'],
  ['match-b2c', '/?view=match&lens=b2c'],
  ['province', '/?view=province&code=50'],
  ['bank', '/?view=bank'],
];

fs.mkdirSync(OUT, { recursive: true });

// The Find view streams 77 province shards before it has a full result set.
// A fixed sleep catches it mid-load — and a half-loaded page is not the
// page we are auditing. The build's own record count is the thing to wait
// for: when the number on screen equals the number in the build, the shards
// have all landed.
const metaRes = await fetch(new URL('/otop_meta.json', BASE));
const EXPECTED = metaRes.ok ? (await metaRes.json())?.counts?.recordsAfterMerge ?? null : null;

const browser = await chromium.launch({ channel: 'chrome' });
const report = [];

for (const [name, route] of VIEWS) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 900 },
      deviceScaleFactor: 1,
      isMobile: w < 700,
      hasTouch: w < 700,
    });
    const page = await ctx.newPage();
    await page.goto(new URL(route, BASE).toString(), { waitUntil: 'domcontentloaded' });
    // Let the SPA mount, the shards load, and the layout settle.
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    if (EXPECTED) {
      await page.waitForFunction(
        (expected) => {
          const el = document.querySelector('.find-stats strong');
          if (!el) return false;
          return Number(el.textContent.replace(/[^\d]/g, '')) === expected;
        },
        EXPECTED,
        { timeout: 90000 }
      ).catch(() => {});
    }
    await page.waitForTimeout(700);

    const info = await page.evaluate(() => {
      const root = document.getElementById('root');
      const all = Array.from(root?.querySelectorAll('*') || []);
      // Elements that sit alone at the end of a wrapped row.
      const rows = Array.from(root?.querySelectorAll('*') || [])
        .filter((e) => {
          const kids = Array.from(e.children);
          if (kids.length < 2) return false;
          const r = e.getBoundingClientRect();
          return kids.some((k) => k.getBoundingClientRect().top > r.top + r.height / 2);
        });
      const h2s = Array.from(root?.querySelectorAll('h2') || []).map((h) => ({
        text: h.textContent.trim().slice(0, 48),
        size: Math.round(parseFloat(getComputedStyle(h).fontSize)),
        y: Math.round(h.getBoundingClientRect().top),
      }));
      const text = root?.innerText || '';
      return {
        title: document.title,
        h1: Array.from(root?.querySelectorAll('h1') || []).map((h) => h.textContent.trim().slice(0, 60)),
        h2s,
        rootKids: root?.children.length ?? -1,
        textLen: text.length,
        scrollH: document.documentElement.scrollHeight,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        elementCount: all.length,
        // A row that breaks and leaves one orphan alone.
        orphanRows: rows.length,
        firstText: text.slice(0, 200),
        // What's above the fold — the "how far down is the first action" measure.
        aboveFold: Array.from(root?.querySelectorAll('a,button,input,select') || [])
          .filter((e) => e.getBoundingClientRect().top < 900)
          .slice(0, 6)
          .map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30)),
      };
    });

    await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
    const overflow = info.scrollW > info.clientW ? ` OVERFLOW(${info.scrollW}>${info.clientW})` : '';
    console.log(
      `${name.padEnd(13)} ${String(w).padEnd(5)} h1=${JSON.stringify(info.h1).slice(0, 44).padEnd(46)} h2=${info.h2s.length} text=${String(info.textLen).padEnd(6)} h=${String(info.scrollH).padEnd(6)} orph=${info.orphanRows}${overflow}`
    );
    if (w === 1440) {
      console.log(`   h2 ladder: ${info.h2s.map((h) => `${h.size}px`).join(' ')}`);
      console.log(`   above fold: ${info.aboveFold.join(' | ')}`);
      console.log(`   first: ${info.firstText.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
    report.push({ name, w, ...info });
    await ctx.close();
  }
}

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log(`\nshots in ${OUT}`);
process.exit(0);
