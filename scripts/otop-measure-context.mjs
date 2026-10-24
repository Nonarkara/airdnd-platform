/**
 * Context dump for the line-measure offenders.
 *
 * For each text block over the ceiling, print the element and the chain of
 * containers above it, with their widths — so the repair can be a
 * recomposition of the right region rather than a clamp on one selector.
 *
 *   node scripts/otop-measure-context.mjs <base> <width> [view]
 */
import { assertOtop, launchBrowser } from './otop-identity.mjs';

const BASE = (process.argv[2] || 'http://localhost:8124').replace(/\/+$/, '');
const WIDTH = Number(process.argv[3] || 1440);
const ONLY = process.argv[4] || null;

const ROUTES = [
  ['find', '/?view=find'],
  ['match', '/?view=match&lens=b2c'],
  ['atlas', '/?view=atlas'],
  ['province', '/?view=province&code=50'],
  ['matchmaker', '/?view=matchmaker'],
  ['briefs', '/?view=briefs'],
  ['tides', '/?view=tides'],
  ['champions', '/?view=champions'],
  ['story', '/?view=story'],
  ['history', '/?view=history'],
  ['crossrefs', '/?view=crossrefs'],
  ['bank', '/?view=bank'],
  ['method', '/?view=method'],
];

const browser = await launchBrowser();

for (const [name, route] of ROUTES) {
  if (ONLY && name !== ONLY) continue;
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await assertOtop(page, name);
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);

  const found = await page.evaluate(() => {
    const out = [];
    const SEL = 'p, li, dd, dt, h1, h2, h3, h4, span, a, figcaption, blockquote, div, section, td, th, label, button, legend, summary';
    const boxish = (el) => {
      const d = getComputedStyle(el).display;
      return d === 'block' || d === 'grid' || d === 'flex' || d === 'list-item'
        || d === 'table' || d === 'table-row' || d === 'table-cell'
        || d === 'inline-block' || d === 'inline-flex' || d === 'inline-grid' || d === 'flow-root';
    };
    const label = (el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/).join('.') : '');
    const ctx2d = document.createElement('canvas').getContext('2d');
    const unitCache = new Map();
    const unitFor = (cs) => {
      const k = `${cs.fontStyle}|${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}`;
      if (unitCache.has(k)) return unitCache.get(k);
      ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx2d.measureText('abcdefghijklmnopqrstuvwxyz').width / 26;
      unitCache.set(k, w || parseFloat(cs.fontSize) * 0.5);
      return unitCache.get(k);
    };
    const ZERO_WIDTH = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u200B-\u200F\uFE00-\uFE0F\u2060]/g;
    const widthChars = (t) => t.replace(ZERO_WIDTH, '').length;
    for (const el of document.querySelectorAll(SEL)) {
      const nodes = [];
      const walk = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) { const t = c.nodeValue.replace(/\s+/g, ' '); if (t.trim()) nodes.push(c); }
          else if (c.nodeType === 1) { if (boxish(c)) continue; if (c.tagName === 'BR') continue; walk(c); }
        }
      };
      walk(el);
      if (!nodes.length) continue;
      let full = ''; const segs = [];
      for (const n of nodes) { const t = n.nodeValue.replace(/\s+/g, ' '); segs.push({ node: n, offset: full.length, len: t.length }); full += t; }
      if (full.trim().length < 40) continue;
      const locate = (g) => { for (const s of segs) if (g < s.offset + s.len) return { node: s.node, off: g - s.offset }; const l = segs[segs.length - 1]; return { node: l.node, off: l.len }; };
      const lines = new Map();
      const re = /\S+/g; let m;
      while ((m = re.exec(full))) {
        const a = locate(m.index), b = locate(m.index + m[0].length - 1);
        const r = document.createRange();
        try { r.setStart(a.node, a.off); r.setEnd(b.node, b.off + 1); } catch { continue; }
        const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0 && x.height > 0);
        if (!rects.length) continue;
        const rect = rects[0];
        const key = String(Math.round(rect.top / 2));
        const L = lines.get(key) || { left: rect.left, right: rect.right };
        L.left = Math.min(L.left, rect.left); L.right = Math.max(L.right, rect.right);
        lines.set(key, L);
      }
      if (!lines.size) continue;
      const cs = getComputedStyle(el);
      const unit = unitFor(cs);
      let widest = 0;
      for (const L of lines.values()) widest = Math.max(widest, (L.right - L.left) / unit);
      const lre = Math.round(widest);
      if (lre <= 75) continue;
      const chain = [];
      let p = el;
      while (p && p !== document.body) {
        const r = p.getBoundingClientRect();
        const pcs = getComputedStyle(p);
        chain.push(`${label(p)} [${Math.round(r.width)}px ${pcs.display}${p === el ? '' : ` mw:${pcs.maxWidth}`}]`);
        p = p.parentElement;
      }
      out.push({ sel: label(el), lre, font: cs.fontSize, chain: chain.slice(0, 5).join('  >  '), text: full.trim().slice(0, 44) });
    }
    // dedupe by selector + text
    const seen = new Set(); const uniq = [];
    for (const o of out.sort((a, b) => b.lre - a.lre)) {
      const k = o.sel + '|' + o.text;
      if (seen.has(k)) continue; seen.add(k); uniq.push(o);
    }
    return uniq;
  });

  console.log(`\n══ ${name} (${WIDTH}px) — ${found.length} distinct offenders`);
  for (const f of found.slice(0, 40)) {
    console.log(`  ${String(f.lre).padStart(4)}lre ${f.font.padStart(6)}  ${f.text}`);
    console.log(`         ${f.chain}`);
  }
  await ctx.close();
}
await browser.close();
