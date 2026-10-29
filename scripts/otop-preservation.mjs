/**
 * THE PRESERVATION PROBE — the fourth thing MSH law §6 asks for, and the one
 * no instrument on this site measures.
 *
 * The law asks, for every viewport:
 *
 *   "Preservation: important content, features, readable text, focus
 *    visibility, and usable targets still work after the change."
 *
 * The other three — chrome cost, task visibility, geometry — are measured
 * elsewhere. This one was prose. A recomposition can fix every hole and still
 * leave the reader unable to focus a control, tap a chip, or read a number:
 * the space got better and the work got harder. "Preserve the product" (§5.6)
 * is an instruction, not a sentiment, and an instruction that is not measured
 * is an instruction nobody has to keep.
 *
 * THREE CHECKS, EACH WITH A NUMBER BEHIND IT
 *
 * 1. FOCUS VISIBILITY. Tab to every control and look at whether the focused
 *    one is visibly different. A control that takes focus and shows nothing is
 *    a control a keyboard user cannot find — and the site looks perfectly
 *    fine to a mouse, which is why this has to be measured and not assumed.
 *
 *    The Tab is a REAL Tab. The site's focus ring is drawn on
 *    `:focus-visible`, which Chrome matches for keyboard focus and NOT for
 *    `element.focus()` called from script — so a probe that "focuses" each
 *    control programmatically would have reported every control on the site
 *    as having no focus ring, and the finding would have been an artefact of
 *    the instrument.
 *
 * 2. USABLE TARGETS. The WCAG 2.2 AA floor is 24x24 CSS px; Apple's is
 *    44x44. The law asks for "usable interaction targets" without naming a
 *    number, so both are reported: 24 is the floor and a failure, 44 is the
 *    comfortable one and a note.
 *
 *    A link inside a sentence is exempt, because WCAG 2.2 SC 2.5.8 exempts
 *    inline targets: the size of a text link is set by the line-height of the
 *    prose around it, and padding it out to 24px would break the line the
 *    reader is in. A link that is a CONTROL — a nav item, a chip, a row
 *    button — is not exempt.
 *
 * 3. READABLE TEXT. The smallest type on the page, and the smallest type
 *    carrying reading rather than a label. A 10px label in a register is a
 *    legitimate choice of voice; a 10px body of prose is not.
 *
 * 4. CONTRAST. "Readable" is not a size; it is a relationship between the
 *    ink and the paper. The third check above asks how big the type is. This
 *    one asks whether the reader can SEE it.
 *
 *    It is here because of what it found. The site's selected-filter chips
 *    were painted with `color: var(--ground, currentColor)` and `--ground`
 *    was never defined, so `currentColor` resolved to the inherited ink and
 *    the chip was painted `#1f0e0a` on `#1f0e0a`. The label of every active
 *    filter — the stars filter, the category filter, the reach filter, the
 *    province filter, the active photo plate — was invisible on the live
 *    site. Nothing else on this site could see it: the size was right, the
 *    box was the right shape, the focus ring worked, and the reader was
 *    looking at a solid black rectangle with no word in it.
 *
 *    So the probe computes the real contrast ratio of every piece of text on
 *    the page, against the surface actually behind it, and reports the ones
 *    that fall under the WCAG 2.1 AA floor — 4.5:1 for ordinary text, 3:1 for
 *    large text.
 *
 * node scripts/otop-preservation.mjs [base]
 */
import { assertOtop, launchBrowser } from './otop-identity.mjs';
import { ROUTES, urlFor, assertRegisterCoversApp } from './otop/routes.mjs';

const BASE = (process.argv[2] || 'https://otop.nonarkara.org').replace(/\/+$/, '');

// The register must still be the whole site before the probe goes out.
assertRegisterCoversApp();

const VIEWS = ROUTES.map((r) => [r.name, urlFor(r)]);

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 1024, h: 900 },
  { w: 1440, h: 900 },
];

// The AA floor, and the comfortable target.
const TARGET_MIN = 24;
const TARGET_COMFORT = 44;
// The smallest type that is still reading rather than metadata.
const READABLE_MIN = 12;
// WCAG 2.1 AA. 4.5:1 for ordinary text, 3:1 for large text (24px, or 18.66px
// and bold). A page can pass every other check and still be unreadable.
const CONTRAST_MIN = 4.5;
const CONTRAST_MIN_LARGE = 3;
// How many Tab presses to make. The site has a few hundred controls on the
// landing view; this walks the first eighty, which is every control a
// reader meets before the fold and the whole of the smaller views.
const TAB_STEPS = 80;

/**
 * The signature of an element's focus appearance.
 *
 * It includes the PARENT's outline and box-shadow, because a focus ring is
 * often drawn on the wrapper and not on the control itself — and the
 * household rule here is zero box-shadow, so an inset ring on a row is the
 * one place a shadow is allowed to be, and it has to be caught.
 */
const SIG_FN = `
function __mshSig(el) {
  var cs = getComputedStyle(el);
  var p = el.parentElement ? getComputedStyle(el.parentElement) : null;
  return [
    cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset,
    cs.boxShadow,
    cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth,
    cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor,
    cs.backgroundColor, cs.color, cs.textDecorationLine, cs.textDecorationColor,
    cs.filter, cs.transform, cs.opacity, cs.letterSpacing, cs.textShadow,
    p ? [p.outlineStyle, p.outlineWidth, p.outlineOffset, p.outlineColor,
         p.boxShadow, p.borderTopColor, p.backgroundColor].join('|') : '',
  ].join('~');
}`;

const browser = await launchBrowser();
const rows = [];
let fatal = null;

for (const [name, route] of VIEWS) {
  for (const vp of VIEWPORTS) {
    try {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: vp.w < 700,
        hasTouch: vp.w < 700,
      });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
      await assertOtop(page, `${name} @${vp.w}px`);
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

      // The landing view streams the whole registry; the other views load
      // their own artefact. Either way the page has to have ARRIVED before
      // it is measured: a half-built page has fewer controls, and "every
      // control is focusable" measured on half a page is a claim about half
      // a page.
      const arrived = await page
        .waitForFunction(
          () => {
            const h1 = document.querySelector('main h1, .state h1');
            if (!h1 || !h1.textContent.trim().length) return false;
            // The landing view's own claim that the registry has landed.
            const dd = document.querySelector('.find-panel-stats dd');
            if (!dd) return true;
            return Number(dd.textContent.replace(/[^\\d]/g, '')) > 0;
          },
          { timeout: 120000 }
        )
        .then(() => true)
        .catch(() => false);
      if (!arrived) {
        throw new Error(`${route} never painted its content — the measurement would be of a page that had not arrived`);
      }
      await page.waitForTimeout(400);

      // ---- the unfocused state, captured before anything is pressed -----
      await page.evaluate(`${SIG_FN}
        window.__mshVis = function (el) {
          var cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          var r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        var FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
        var list = Array.prototype.slice.call(document.querySelectorAll(FOCUSABLE)).filter(window.__mshVis);
        list.forEach(function (el, i) { el.setAttribute('data-msh-f', String(i)); });
        window.__mshPre = list.map(function (el) { return __mshSig(el); });
        window.__mshCount = list.length;
      `);

      // ---- the walk: a REAL Tab, in order, as a keyboard user would -----
      const tabbed = [];
      const seenIdx = new Set();
      await page.evaluate(() => {
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        window.scrollTo(0, 0);
      });
      // A focus that lands on something NOT in the captured list is a miss, not
      // the end of the document: the list was taken before the walk, and a
      // control can appear (a disclosure, a hydrated island) in between.
      // Breaking on the first miss would truncate the walk and report the
      // controls AFTER that point as "never reached" — a false all-clear.
      let misses = 0;
      let reachedEnd = false;
      for (let step = 0; step < TAB_STEPS; step++) {
        await page.keyboard.press('Tab');
        const now = await page.evaluate(`${SIG_FN}
          var el = document.activeElement;
          if (!el || el === document.body || el === document.documentElement) return null;
          var idx = el.getAttribute ? el.getAttribute('data-msh-f') : null;
          return {
            idx: idx,
            sig: __mshSig(el),
            tag: el.tagName.toLowerCase(),
            cls: String(el.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 2).join('.'),
            text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 34),
          };
        `);
        if (!now) {
          reachedEnd = true;
          break; // focus left the document — the walk is over.
        }
        if (now.idx === null) {
          if (++misses >= 5) break; // five in a row: this is the end, not a gap.
          continue;
        }
        misses = 0;
        if (seenIdx.has(now.idx)) continue;
        seenIdx.add(now.idx);
        tabbed.push(now);
      }

      // ---- 1. focus visibility -------------------------------------------
      const invisible = [];
      for (const t of tabbed) {
        const pre = await page.evaluate((i) => window.__mshPre[Number(i)], t.idx);
        if (pre === t.sig) {
          invisible.push({ sel: `${t.tag}${t.cls ? '.' + t.cls : ''}`, text: t.text });
        }
      }

      // ---- 2. usable targets ---------------------------------------------
      const targets = await page.evaluate(
        ({ TARGET_MIN, TARGET_COMFORT }) => {
          const vis = (el) => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          const name = (el) => {
            const cls = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
            return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
          };
          // WCAG 2.2 SC 2.5.8: a target that is INLINE — a link inside a
          // sentence — is exempt. The size of a text link is set by the
          // line-height of the prose around it; padding it out to 24px would
          // break the line the reader is in. A link that is a CONTROL is not
          // exempt.
          const inlineInSentence = (el) => {
            if (el.tagName !== 'A') return false;
            if (getComputedStyle(el).display !== 'inline') return false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              if (/^(P|LI|DD|DT|TD|TH|FIGCAPTION|BLOCKQUOTE|SMALL)$/.test(p.tagName)) {
                // There is other text in the sentence — that is what makes it
                // a link IN a sentence rather than a sentence of its own.
                const own = (p.textContent || '').trim().length;
                const mine = (el.textContent || '').trim().length;
                return own > mine + 2;
              }
              if (/^(MAIN|NAV|SECTION|HEADER|FOOTER|ARTICLE)$/.test(p.tagName)) return false;
            }
            return false;
          };

          const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
          const list = Array.prototype.slice.call(document.querySelectorAll(FOCUSABLE)).filter(vis);
          const small = [];
          const tiny = [];
          let smallest = null;
          for (const el of list) {
            const r = el.getBoundingClientRect();
            const w = Math.round(r.width);
            const h = Math.round(r.height);
            const min = Math.min(w, h);
            const exempt = inlineInSentence(el);
            const rec = {
              sel: name(el),
              w,
              h,
              min,
              exempt,
              text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 34),
            };
            if (!smallest || min < smallest.min) smallest = rec;
            if (!exempt && (h < TARGET_MIN || w < TARGET_MIN)) {
              if (small.length < 8) small.push(rec);
            }
            if (!exempt && min < TARGET_COMFORT) {
              if (tiny.length < 8) tiny.push(rec);
            }
          }
          return { count: list.length, small, tiny, smallest };
        },
        { TARGET_MIN, TARGET_COMFORT },
      );

      // ---- 3. readable text ------------------------------------------------
      const type = await page.evaluate((READABLE_MIN) => {
        const label = (el) => {
          const cls = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
          return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
        };
        const sizes = [];
        for (const el of document.querySelectorAll('main *')) {
          if (el.children.length) continue;
          const t = (el.textContent || '').trim();
          if (!t) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const fs = parseFloat(cs.fontSize);
          if (fs > 0) sizes.push({ fs, len: t.length, sel: label(el), text: t.slice(0, 34) });
        }
        const smallest = sizes.length ? sizes.reduce((a, b) => (b.fs < a.fs ? b : a)) : null;
        // The smallest type that carries READING — a run of text long enough
        // to be a sentence rather than a label.
        const readings = sizes.filter((s) => s.len > 120);
        const smallestReading = readings.length ? readings.reduce((a, b) => (b.fs < a.fs ? b : a)) : null;
        return {
          smallest,
          smallestReading,
          belowReadable: sizes.filter((s) => s.fs < READABLE_MIN && s.len > 40).slice(0, 5),
        };
      }, READABLE_MIN);

      // ---- 4. contrast --------------------------------------------------
      // The surface actually behind the text, and the ink actually on it.
      const contrast = await page.evaluate(
        ({ CONTRAST_MIN, CONTRAST_MIN_LARGE }) => {
          const parse = (c) => {
            const m = String(c).match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
            if (p.length < 3 || p.some(isNaN)) return null;
            return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
          };
          // fg OVER bg.
          const over = (fg, bg) => {
            const a = fg[3];
            return [
              fg[0] * a + bg[0] * (1 - a),
              fg[1] * a + bg[1] * (1 - a),
              fg[2] * a + bg[2] * (1 - a),
              1,
            ];
          };
          // The paper behind an element: every background up the tree, the
          // opaque one first, then the translucent ones over it.
          const paper = (el) => {
            const stack = [];
            let n = el;
            while (n && n.nodeType === 1) {
              const c = parse(getComputedStyle(n).backgroundColor);
              if (c && c[3] > 0) {
                stack.push(c);
                if (c[3] >= 1) break;
              }
              n = n.parentElement;
            }
            let bg = [255, 255, 255, 1];
            for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
            return bg;
          };
          const chan = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          const lum = (c) => 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
          const ratio = (a, b) => {
            const l1 = lum(a);
            const l2 = lum(b);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          };
          const label = (el) => {
            const cls = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
            return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
          };

          const low = [];
          let checked = 0;
          for (const el of document.querySelectorAll('main *')) {
            if (el.children.length) continue;
            const t = (el.textContent || '').trim();
            if (!t) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const fg = parse(cs.color);
            if (!fg) continue;
            // The text's own opacity, and every opacity above it.
            let alpha = fg[3];
            let n = el;
            while (n && n.nodeType === 1) {
              alpha *= parseFloat(getComputedStyle(n).opacity);
              n = n.parentElement;
            }
            const bg = paper(el);
            const ink = over([fg[0], fg[1], fg[2], alpha], bg);
            const fs = parseFloat(cs.fontSize);
            const weight = Number(cs.fontWeight) || 400;
            const large = fs >= 24 || (fs >= 18.66 && weight >= 700);
            const floor = large ? CONTRAST_MIN_LARGE : CONTRAST_MIN;
            const r2 = ratio(ink, bg);
            checked++;
            if (r2 < floor) {
              if (low.length < 12) {
                low.push({
                  sel: label(el),
                  ratio: Math.round(r2 * 100) / 100,
                  floor,
                  fs,
                  weight,
                  text: t.slice(0, 30),
                });
              }
            }
          }
          return { checked, low };
        },
        { CONTRAST_MIN, CONTRAST_MIN_LARGE },
      );

      rows.push({
        view: name,
        w: vp.w,
        focusables: tabbed.length,
        declaredFocusables: targets.count,
        invisible,
        smallTargets: targets.small,
        tinyTargets: targets.tiny,
        smallestTarget: targets.smallest,
        contrastChecked: contrast.checked,
        lowContrast: contrast.low,
        ...type,
      });
      await ctx.close();
    } catch (e) {
      fatal = fatal || [];
      fatal.push(`${name} @${vp.w}px — ${e.message}`);
      try {
        await ctx?.close();
      } catch {
        /* the context was never opened */
      }
    }
  }
}

await browser.close();

// ---------------------------------------------------------------- the report
let failures = 0;
console.log(`\npreservation probe — ${BASE}\n`);
console.log(
  'view'.padEnd(13) + 'w'.padEnd(6) + 'tabbed'.padEnd(8) + 'no-ring'.padEnd(9) +
  'smallest'.padEnd(11) + 'under24'.padEnd(9) + 'tiny-type'.padEnd(11) + 'reading-type'.padEnd(13) + 'low-contrast',
);
console.log('-'.repeat(100));
for (const r of rows) {
  const bad = r.invisible.length > 0 || r.smallTargets.length > 0 || r.belowReadable.length > 0;
  if (bad) failures++;
  const smallest = r.smallestTarget ? `${r.smallestTarget.min}px` : '-';
  const tinyType = r.smallest ? `${r.smallest.fs}px` : '-';
  const readType = r.smallestReading ? `${r.smallestReading.fs}px` : '-';
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${r.view.padEnd(11)} ${String(r.w).padEnd(6)} ${String(r.focusables).padEnd(8)}` +
    `${String(r.invisible.length).padEnd(9)}${smallest.padEnd(11)}${String(r.smallTargets.length).padEnd(9)}` +
    `${tinyType.padEnd(11)}${readType.padEnd(13)}${r.lowContrast.length ? r.lowContrast.length : '0'}`,
  );
  for (const s of r.invisible) console.log(`       NO FOCUS RING: ${s.sel} "${s.text}"`);
  for (const s of r.smallTargets) console.log(`       TARGET UNDER 24px: ${s.sel} ${s.w}x${s.h}px "${s.text}"`);
  for (const t of r.belowReadable) console.log(`       TYPE UNDER ${READABLE_MIN}px: ${t.sel} ${t.fs}px "${t.text}"`);
  for (const c of r.lowContrast) {
    console.log(`       CONTRAST ${c.ratio}:1 (needs ${c.floor}):1: ${c.sel} ${c.fs}px w${c.weight} "${c.text}"`);
  }
  if (r.tinyTargets.length) {
    const s = r.tinyTargets[0];
    console.log(`       (note) ${r.tinyTargets.length} target(s) under 44px, smallest ${s.min}px — ${s.sel} "${s.text}"`);
  }
}

if (fatal) {
  console.error(`\nFAIL — ${fatal.length} measurement(s) could not be taken:`);
  for (const f of fatal) console.error(`  ✗ ${f}`);
  failures += fatal.length;
}

console.log(
  `\n${rows.length} measurements, ${failures} flagged.` +
    (failures
      ? '\nA control with no focus ring, a target under 24px, or a body of reading under 12px is a failure.\n'
      : '\nEvery control shows where it is, every target clears 24px, and no reading is set below 12px.\n'),
);
process.exit(failures ? 1 : 0);
