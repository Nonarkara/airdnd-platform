/**
 * Measure the measure.
 *
 * The house rule is 45–75 characters a line. Nothing on this site is allowed
 * to run wider, because a line the reader cannot hold in memory is a line
 * they have to read twice: the eye reaches the end of line one and cannot
 * find line two again, and the sentence is lost.
 *
 * Two numbers, because one number lies:
 *
 *   lre  — the line's rendered width expressed in the font's own Latin
 *          character width. "This line is as long as 168 English
 *          characters." This is the physical measure, and it is the one the
 *          reader's eye actually suffers: it is script-agnostic, so Thai
 *          (which has no spaces and is information-dense) is judged by the
 *          same ruler as English instead of being flattered by counting its
 *          glyphs.
 *   ch   — the character count of the longest line. The old measure. It is
 *          kept because it is the house rule's own wording, and because a
 *          line can be physically short yet carry many characters.
 *
 * Both are measured on the RENDERED line boxes, from the word rectangles the
 * browser produced — not from the element's width, and not from an average.
 * One over-long line is the line the reader loses, so the maximum is the
 * number that matters.
 *
 * node scripts/otop-measure.mjs [base] [width]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { assertOtop, launchBrowser } from './otop-identity.mjs';
import { activeSite } from './msh/sites.mjs';

const BASE = (process.argv[2] || 'https://otop.nonarkara.org').replace(/\/+$/, '');
const WIDTH = Number(process.argv[3] || 1440);

const OTOP_ROUTES = [
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
  ['softpower', '/?view=softpower'],
];
const ROUTES = activeSite().routes ?? OTOP_ROUTES;

const MAX = 75;   // the house ceiling
const MIN = 45;   // and the floor for a paragraph
// A HEADING is a label. Six lines of it is not a label any more — it is a
// body wearing a heading's clothes. This is the third end of the failure the
// ceiling cannot see: the Chiang Saen dossier set 4,819 characters of
// Wikipedia article in an <h4>, and it measured 124 lines of 30 characters
// each — every line well UNDER the ceiling, and a 2,976px heading.
const HEADING_MAX_LINES = 5;
// --selftest proves the ruler bites. A rule that has never failed is a rule
// nobody should rely on, so each rule is tested against the defect it
// exists to catch, injected into the real page and measured by the same
// code that measures the site.
const SELF_TEST = process.argv.includes('--selftest');

const browser = await launchBrowser();
const rows = [];
const seen = [];
const selftestResults = [];

for (const [name, route] of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await assertOtop(page, name);
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // The self-test runs once, on the first route: the rules are the rules
  // everywhere, and running them on every route would triple the sweep for
  // the same proof.
  const runSelfTest = SELF_TEST && seen.length === 0;

  const found = await page.evaluate(({ MAX, MIN, HEADING_MAX_LINES, SELF_TEST }) => {
    // A Thai syllable is several code points, and the vowel and tone marks
    // among them take NO width at all. Counting them made every Thai line
    // look 40% longer than it is, and made the ruler a lie about half the
    // site. Only characters that occupy space are counted.
    const ZERO_WIDTH = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u200B-\u200F\uFE00-\uFE0F\u2060]/g;
    const widthChars = (t) => t.replace(ZERO_WIDTH, '').length;
    // The Latin characters on a line, counted separately. The house ceiling
    // of 75 CHARACTERS is a rule about Latin reading load: a Thai glyph is
    // a narrow mark, not a letter, and a Thai syllable is several code
    // points. Thai is therefore judged on the physical width alone, which
    // is the constraint the eye actually suffers.
    const latinCount = (t) => (t.replace(ZERO_WIDTH, '').match(/[ -~]/g) || []).length;
    // A text block: any element that renders text of its own. The element's
    // own text is the text inside it, stopping at box-level descendants —
    // a wrapper around other boxes has no text of its own to measure.
    const SEL = 'p, li, dd, dt, h1, h2, h3, h4, span, a, figcaption, blockquote, div, section, td, th, label, button, legend, summary';
    const boxish = (el) => {
      const d = getComputedStyle(el).display;
      return d === 'block' || d === 'grid' || d === 'flex' || d === 'list-item'
        || d === 'table' || d === 'table-row' || d === 'table-cell'
        || d === 'inline-block' || d === 'inline-flex' || d === 'inline-grid'
        || d === 'flow-root';
    };
    const label = (el) => el.tagName.toLowerCase() + '.' + String(el.className || '').split(/\s+/).slice(0, 2).join('.');

    // The Latin character width of this document's own faces, measured from
    // the font itself — not assumed, not tabulated.
    const ctx2d = document.createElement('canvas').getContext('2d');
    const unitCache = new Map();
    const unitFor = (cs) => {
      const key = `${cs.fontStyle}|${cs.fontWeight}|${cs.fontSize}|${cs.fontFamily}`;
      if (unitCache.has(key)) return unitCache.get(key);
      ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const w = ctx2d.measureText('abcdefghijklmnopqrstuvwxyz').width / 26;
      unitCache.set(key, w || parseFloat(cs.fontSize) * 0.5);
      return unitCache.get(key);
    };

    let blocks = 0;
    const measureOne = (el) => {
      const nodes = [];
      const walk = (node) => {
        for (const child of node.childNodes) {
          if (child.nodeType === 3) {
            const t = child.nodeValue.replace(/\s+/g, ' ');
            if (t.trim()) nodes.push(child);
          } else if (child.nodeType === 1) {
            if (boxish(child)) continue; // a nested box: not this element's text
            if (child.tagName === 'BR') continue;
            walk(child);
          }
        }
      };
      walk(el);
      if (!nodes.length) return null;

      // Flatten the element's own inline content into one string, keeping a
      // map back to (node, offset) so any word can be located exactly.
      let full = '';
      const segs = [];
      for (const n of nodes) {
        const t = n.nodeValue.replace(/\s+/g, ' ');
        segs.push({ node: n, offset: full.length, len: t.length });
        full += t;
      }
      const chars = full.trim().length;
      if (chars < 40) return null;
      blocks++;

      const locate = (g) => {
        for (const s of segs) {
          if (g < s.offset + s.len) return { node: s.node, off: g - s.offset };
        }
        const last = segs[segs.length - 1];
        return { node: last.node, off: last.len };
      };

      // Walk the WORDS, and put each one on the line box it was rendered
      // into. The measure of the block is the longest of those lines.
      //
      // A visual row is NOT a line. In a multi-column block — the method
      // page's provenance band, the story's prose — the last line of column
      // one and the first line of column two sit at the same height, and a
      // ruler that merged them would measure a line that does not exist:
      // 1,301px of nothing. So a word joins the line it FOLLOWS: the one
      // whose right edge it starts after. A word that starts to the LEFT of
      // every line in its row has begun a new column, and opens a new line.
      const rows = new Map();
      const re = /\S+/g;
      // The word space, as a tolerance. A column gap is wider than this; a
      // word space is not.
      const tol = parseFloat(getComputedStyle(el).fontSize) * 0.35 || 5;
      // …measured in the WORD's own type: a letter-spaced eyebrow inside a
      // block (Sabai's paper masthead, 2.2px tracking) sets its word gaps
      // wider than the block's 0.35em, and the ruler split every word into a
      // one-word "line" — then called the block a ribbon. The tracking on
      // both sides of the space is part of the space.
      const tolFor = (node) => {
        const pcs = getComputedStyle(node.parentElement || el);
        const spacing = Math.max(0, parseFloat(pcs.letterSpacing) || 0);
        return Math.max(tol, (parseFloat(pcs.fontSize) || 0) * 0.35 + 2 * spacing + 1);
      };
      let m;
      while ((m = re.exec(full))) {
        const a = locate(m.index);
        const b = locate(m.index + m[0].length - 1);
        const r = document.createRange();
        try {
          r.setStart(a.node, a.off);
          r.setEnd(b.node, b.off + 1);
        } catch {
          continue;
        }
        const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0 && x.height > 0);
        if (!rects.length) continue;
        const rect = rects[0];

        const bucket = Math.round(rect.top / 2);
        let row = rows.get(bucket);
        if (!row) { row = []; rows.set(bucket, row); }

        // The line this word belongs to: the one whose own horizontal extent
        // contains it. A word that starts past the end of every line — by a
        // column gap, not a word space — opens a new line.
        let line = null;
        const wordTol = tolFor(a.node);
        for (const ln of row) {
          if (rect.left >= ln.left - wordTol && rect.left <= ln.right + wordTol) {
            if (!line || ln.right > line.right) line = ln;
          }
        }
        if (!line) {
          line = { chars: 0, latin: 0, words: 0, left: rect.left, right: rect.right, lastRight: rect.right, sample: '' };
          row.push(line);
        }
        line.chars += widthChars(m[0]) + (line.words ? 1 : 0);
        line.latin += latinCount(m[0]);
        line.words += 1;
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.lastRight = rect.right;
        if (line.sample.length < 90) line.sample += (line.sample ? ' ' : '') + m[0];
      }

      const lines = [];
      for (const row of rows.values()) for (const ln of row) lines.push(ln);
      if (!lines.length) return null;

      const cs = getComputedStyle(el);
      const unit = unitFor(cs);
      let widest = null;   // the physically longest line
      let densest = null;  // the line carrying the most characters
      let latinWorst = null; // the line carrying the most LATIN characters
      for (const line of lines.values()) {
        const px = line.right - line.left;
        const lre = px / unit;
        line.lre = lre;
        if (!widest || lre > widest.lre) widest = line;
        if (!densest || line.chars > densest.chars) densest = line;
        if (!latinWorst || line.latin > latinWorst.latin) latinWorst = line;
      }
      const lre = Math.round(widest.lre);
      const ch = densest.chars;
      const r = el.getBoundingClientRect();

      /* A RIBBON. The other end of the failure: text set in a column so
         narrow that a line holds one or two characters, and the block runs
         for hundreds of pixels down the page. The ceiling test ignores it —
         a ribbon is short — and the empty-track probe sees only the sliver
         between the columns. On a 390px phone this is what a card grid
         collapses into when the column count is wrong: 50 cards, each 81px
         wide, each 1,961px tall, every word broken. */
      // A ribbon: EVERY line in the block is narrow. The narrowest line is
      // not the test — a paragraph's last line is always short, and a
      // paragraph that ends on one word is not a ribbon.
      const narrowest = Math.min(...lines.map((l) => l.right - l.left));
      const widestLine = widest.right - widest.left;
      if (r.height > 300 && widestLine < 120 && r.width < 400) {
        return {
          sel: label(el),
          lre,
          ch,
          latin: latinWorst.latin,
          thai: latinWorst.chars - latinWorst.latin,
          words: densest.words,
          lines: lines.length,
          widthPx: Math.round(r.width),
          fontPx: Math.round(parseFloat(cs.fontSize)),
          heightPx: Math.round(r.height),
          ribbon: Math.round(narrowest),
          text: (widest.sample || '').slice(0, 70),
        };
      }

      /* A HEADING THAT IS A WALL. Every line of it can be under the ceiling
         and the heading can still be a failure: what the reader loses is not
         the line, it is the knowledge that the heading is over. A heading is
         a label, so a heading that runs to many lines is a body wearing a
         heading's clothes — and the page has to say which one it is. */
      if (/^H[1-6]$/.test(el.tagName) && lines.length > HEADING_MAX_LINES) {
        return {
          sel: label(el),
          lre,
          ch,
          latin: latinWorst.latin,
          thai: latinWorst.chars - latinWorst.latin,
          words: densest.words,
          lines: lines.length,
          widthPx: Math.round(r.width),
          fontPx: Math.round(parseFloat(cs.fontSize)),
          heightPx: Math.round(r.height),
          heading: lines.length,
          text: (widest.sample || '').slice(0, 70),
        };
      }

      if (lre <= MIN && ch <= MIN) return null; // narrow is a different problem

      return {
        sel: label(el),
        lre,
        ch,
        latin: latinWorst.latin,
        thai: latinWorst.chars - latinWorst.latin,
        words: densest.words,
        lines: lines.length,
        widthPx: Math.round(r.width),
        fontPx: Math.round(parseFloat(cs.fontSize)),
        text: (widest.sample || '').slice(0, 70),
      };
    };

    const scan = () => {
      const acc = [];
      for (const el of document.querySelectorAll(SEL)) {
        const rec = measureOne(el);
        if (rec) acc.push(rec);
      }
      return acc;
    };

    let out = scan();

    /* ── the instrument against itself ───────────────────────────────────
       A rule that has never failed is a rule nobody should rely on. Each
       rule below is tested by INJECTING the defect it exists to catch, into
       the real page, in the real browser, and re-running the same
       measurement over it. If the rule does not bite on its own defect,
       the ruler is lying and the run is a failure — not a pass with a
       footnote. The Chiang Saen heading wall, the 81px ribbon of a card grid
       that counted its columns wrong, and the over-long line are each
       reproduced here at their measured size. */
    const selftest = [];
    if (SELF_TEST) {
      // The counter is the PAGE's, not the probes': the injected defects are
      // measured too, and a count that included them would describe the
      // instrument rather than the site.
      const blocksBefore = blocks;
      const probe = (name, make, expect) => {
        const el = make();
        document.body.appendChild(el);
        const hit = scan().find((f) => f.sel === expect.sel && f[expect.key]);
        selftest.push({
          rule: name,
          caught: Boolean(hit),
          detail: hit ? { key: expect.key, value: hit[expect.key] } : null,
        });
        el.remove();
      };

      // 1. A HEADING THAT IS A WALL — the defect the Chiang Saen dossier
      //    shipped: 4,819 characters of Wikipedia article in an <h4>.
      probe(
        'a heading that is a wall',
        () => {
          const h = document.createElement('h4');
          h.textContent = 'ประวัติความเป็นมาของเมืองเชียงแสน มีบันทึกไว้ในตำนานพงศาวดาร '.repeat(60);
          h.style.cssText = 'max-width:320px;margin:0;';
          return h;
        },
        { sel: 'h4.', key: 'heading' },
      );

      // 2. A RIBBON — the champion card grid that counted 1 column on a
      //    phone: 50 cards, 81px wide, 1,961px tall, every word broken.
      probe(
        'a column too narrow to hold a word',
        () => {
          const d = document.createElement('div');
          d.className = 'selftest-ribbon';
          // Words, so the column wraps at its spaces and every line it holds
          // is as wide as the column. A single unbroken word would overflow
          // the column instead of filling it, and the probe would be testing
          // a different defect than the one it names.
          d.textContent = 'ผ้าไหม สมัคร สิเนียม บางเส้น '.repeat(220);
          d.style.cssText = 'width:81px;';
          return d;
        },
        { sel: 'div.selftest-ribbon', key: 'ribbon' },
      );

      // 3. A LINE OVER THE CEILING — the house rule itself.
      probe(
        'a line over the ceiling',
        () => {
          const p = document.createElement('p');
          p.className = 'selftest-long';
          p.textContent = 'word '.repeat(140);
          p.style.cssText = 'max-width:none;width:1200px;';
          return p;
        },
        { sel: 'p.selftest-long', key: 'lre' },
      );

      // The page's own count, restored: the probes measured their own
      // defects, and a count that included them would describe the
      // instrument rather than the site.
      blocks = blocksBefore;
    }

    return {
      blocks,
      out: out.sort((a, b) => Math.max(b.lre, b.latin) - Math.max(a.lre, a.latin)),
      selftest,
    };
  }, { MAX, MIN, HEADING_MAX_LINES, SELF_TEST: runSelfTest });

  seen.push(`${name}: ${found.blocks} text blocks`);
  if (found.selftest?.length) selftestResults.push(...found.selftest.map((t) => ({ view: name, ...t })));
  for (const f of found.out) {
    // A ribbon is its own failure: the column is too narrow to hold a word.
    if (f.ribbon) {
      rows.push({ view: name, ...f, why: 'ribbon' });
      continue;
    }
    // A heading that is a wall is its own failure too: every line of it can
    // be short, and the reader still loses the fact that it ended.
    if (f.heading) {
      rows.push({ view: name, ...f, why: 'heading' });
      continue;
    }
    // Two rules, and they are not the same rule:
    //   the WIDTH — the physical length of the line, in Latin characters.
    //     Every script, every size. This is the constraint the reader
    //     suffers: a line whose next row is two A4 sheets away is lost.
    //   the CHARACTERS — the reading load of Latin text. Only applied to a
    //     line that is mostly Latin; a Thai line's character count is not
    //     comparable, and a rule that lies about half the site is not a
    //     rule.
    const latinMajority = f.latin > f.thai;
    if (f.lre > MAX || (latinMajority && f.latin > MAX)) {
      rows.push({ view: name, ...f, why: f.lre > MAX ? 'width' : 'characters' });
    }
  }
  await ctx.close();
}

// Each site keeps its own receipts: one³'s stay at the folder root, where
// MSH-REPORT.md cites them; any other site writes under its own name.
const EVIDENCE = activeSite().key === 'otop' ? 'design/msh-evidence' : `design/msh-evidence/${activeSite().key}`;
mkdirSync(EVIDENCE, { recursive: true });
writeFileSync(
  `${EVIDENCE}/line-measure-${WIDTH}.json`,
  JSON.stringify(
    { base: BASE, width: WIDTH, max: MAX, min: MIN, headingMaxLines: HEADING_MAX_LINES, rows, selftest: selftestResults },
    null,
    2,
  ),
);

console.log(`\nmeasure over ${MAX} characters a line, at ${WIDTH}px\n`);
console.log(seen.join('\n') + '\n');

if (selftestResults.length) {
  console.log('── the ruler against itself');
  for (const t of selftestResults) {
    console.log(
      t.caught
        ? `  · bites: ${t.rule.padEnd(38)} ${t.detail.key}=${t.detail.value}`
        : `  ✗ DEAD: ${t.rule.padEnd(38)} the rule did not fire on the defect it exists to catch`,
    );
  }
  const dead = selftestResults.filter((t) => !t.caught);
  if (dead.length) {
    console.error(
      `\nFAIL — ${dead.length} rule(s) of the ruler did not bite. A measure that cannot fail is not a measure.\n`,
    );
    process.exit(1);
  }
  console.log('');
}

if (!rows.length) {
  console.log('nothing over the ceiling.');
} else {
  let worst = 0;
  const byView = new Map();
  for (const r of rows) {
    const bad = r.lre > MAX ? r.lre : r.latin;
    worst = Math.max(worst, bad);
    if (!byView.has(r.view)) byView.set(r.view, []);
    byView.get(r.view).push(r);
  }
  for (const [view, list] of byView) {
    console.log(`── ${view} — ${list.length} offender(s)`);
    for (const r of list.slice(0, 14)) {
      if (r.ribbon) {
        console.log(
          `  RIBBON  line ${r.ribbon}px wide, block ${r.widthPx}x${r.heightPx}px @${r.fontPx}px  ${r.sel.padEnd(24)} "${r.text}"`,
        );
        continue;
      }
      if (r.heading) {
        console.log(
          `  HEADING ${String(r.heading).padStart(4)} lines, block ${r.widthPx}x${r.heightPx}px @${r.fontPx}px  ${r.sel.padEnd(24)} "${r.text}"`,
        );
        continue;
      }
      console.log(
        `  ${String(r.lre).padStart(4)}lre ${String(r.latin).padStart(4)}lat ${String(r.ch).padStart(4)}ch ` +
          `${String(r.words).padStart(3)}w ${r.why.padEnd(10)} ${r.sel.padEnd(26)} ${String(r.widthPx).padStart(5)}px @${r.fontPx}px  "${r.text}"`,
      );
    }
    if (list.length > 14) console.log(`  … and ${list.length - 14} more`);
  }
  console.log(`\n${rows.length} text block(s) over the ceiling. Worst: ${worst}.`);
}
await browser.close();
process.exit(rows.length ? 1 : 0);
