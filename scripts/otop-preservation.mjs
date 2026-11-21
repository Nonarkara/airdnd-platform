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

// One view, when you are chasing one finding:
//   OTOP_PROBE_VIEW=atlas node scripts/otop-preservation.mjs [base]
// The probe measures the whole site by default, because a view nobody
// measured is a view nobody has a receipt for.
const ONLY = process.env.OTOP_PROBE_VIEW || null;
const VIEWS = ROUTES.map((r) => [r.name, urlFor(r)]).filter(([name]) => !ONLY || name === ONLY);

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
      // TWO DEFECTS LIVED IN THIS ONE CALL, and both of them said "the product
      // is broken" when the product was fine.
      //
      // The first was the digit strip. Written as /[^\\d]/g inside a template
      // string, the class is "not a backslash and not the letter d" — so
      // "154,050" was stripped to the empty string, Number("") is 0, and the
      // predicate could NEVER be true. The front door was reported as a page
      // that never painted, on a page that painted in 500ms and stated
      // 154,050. The instrument had been crying "the landing page is broken"
      // since it was written.
      //
      // The second was the signature. Playwright's waitForFunction takes
      // (pageFunction, arg, options) — the second parameter is the ARGUMENT
      // passed to the function, not the options. So { timeout: 120000 } was
      // handed to the predicate as its argument and the real timeout stayed
      // at the 30s default. The instrument gave up three times faster than it
      // said it would.
      const arrived = await page
        .waitForFunction(
          () => {
            const h1 = document.querySelector('main h1, .state h1');
            if (!h1 || !h1.textContent.trim().length) return false;
            // The landing view's own claim that the registry has landed.
            const dd = document.querySelector('.find-panel-stats dd');
            if (!dd) return true;
            return Number(dd.textContent.replace(/[^\d]/g, '')) > 0;
          },
          undefined,
          { timeout: 120000 }
        )
        .then(() => true)
        .catch(() => false);
      if (!arrived) {
        throw new Error(`${route} never painted its content — the measurement would be of a page that had not arrived`);
      }
      await page.waitForTimeout(400);

      // A CLOSED DISCLOSURE IS NOT ON THE PAGE.
      //
      // The province dossier keeps its long registers inside <details>. A
      // closed <details> LAYS OUT its children but never PAINTS them, so the
      // probe was sampling whatever happened to be behind them — a dark
      // photograph plate — and reporting a contrast failure for text no
      // reader can see. Eight findings on the province view, at 1.01:1,
      // against a ground of near-black that does not exist anywhere on the
      // page.
      //
      // The instrument was measuring a page the reader never sees. So the
      // disclosures are OPENED before anything is measured: the register is
      // the page, and the reader who opens it is the reader the law is
      // about. A target that is only reachable after a click is still a
      // target.
      const opened = await page.evaluate(() => {
        let n = 0;
        for (const d of document.querySelectorAll('details')) {
          if (!d.open) {
            d.open = true;
            n++;
          }
        }
        return n;
      });
      if (opened) await page.waitForTimeout(600);

      // ---- the unfocused state, captured before anything is pressed -----
      // Playwright evaluates a STRING as an EXPRESSION, and this body is a
      // function declaration followed by statements — which is not an
      // expression, so it raised "SyntaxError: Unexpected identifier
      // 'window'" and reported all forty-five measurements as failures.
      // The instrument was reporting its own syntax error as forty-five
      // findings about the product, which is the worst shape a failing
      // instrument can have: it looks like a result.
      //
      // An IIFE makes the whole thing one expression, and the body runs.
      await page.evaluate(`(() => { ${SIG_FN}
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
      })()`);

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
        const now = await page.evaluate(`(() => { ${SIG_FN}
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
        })()`);
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
      // THE SURFACE THE READER ACTUALLY SEES.
      //
      // The first version of this measured contrast by walking the DOM for
      // an opaque background colour and comparing the text's colour with it.
      // That works on paper — and fails completely on a banner, where the
      // surface is a PHOTOGRAPH with a veil over it and no opaque
      // background-colour anywhere until the page's paper cream.
      //
      // So it measured cream text against cream paper and reported the
      // Atlas chapter heading — "What does the data say?", 28px, cream on a
      // dark photographic banner — at **1.06:1**, when the heading's real
      // painted contrast, sampled from the pixels on the screen, is
      // **18.57:1**. Forty-five findings, none of them about the product.
      //
      // The instrument was reporting its own limitation as a property of the
      // site, and a gate that cries wolf on every layout is a gate nobody
      // reads. So the measurement is now taken from the SCREENSHOT: one
      // full-page image per view, and for each piece of text, the pixels
      // that are the text and the pixels that are the surface behind it.
      // The screenshot must be of the page at its NATURAL scroll.
      //
      // A full-page capture paints a sticky band where it is STUCK, not
      // where it belongs, so every row below it is displaced by the band's
      // height. The probe then read the pixels of the header while asking
      // about a gold button on paper, and reported 1:1 — the surface it
      // measured was the page's ink, because that is what was painted at
      // those coordinates.
      //
      // So: scroll to the top, let the sticky bands fall back into place,
      // and capture. The elements' rectangles are read afterwards at the
      // same scroll, so the two agree.
      //
      // AND THE PAGE HAS TO STOP MOVING BEFORE IT IS CAPTURED. A full-page
      // capture scrolls the document, which makes the browser load the
      // images it deferred — and a card whose photograph arrives is a card
      // whose height changes. So the capture was a picture of the page
      // BEFORE the photographs and the rectangles were a picture of the page
      // AFTER them: the champion card's phone link was read 2,289px away
      // from where it is, and the probe sampled a photograph there and
      // called it a contrast failure.
      //
      // So the images are asked for, the page is walked to the bottom and
      // back, and the capture waits for every one of them. A page that has
      // stopped moving can be photographed and measured against.
      await page.evaluate(() => {
        for (const img of document.querySelectorAll('img')) img.loading = 'eager';
      });
      await page.evaluate(async () => {
        const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
        for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
        }
        window.scrollTo(0, 0);
      });
      await page
        .evaluate(async () => {
          await Promise.all(
            Array.from(document.images).map((img) =>
              img.complete
                ? null
                : new Promise((resolve) => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                  }),
            ),
          );
        })
        .catch(() => {});

      // THE PAGE IS MEASURED IN SCREENS, NOT IN ONE PICTURE.
      //
      // A full-page capture of a page taller than Chromium's 16,384px texture
      // limit does not come back as one picture. It comes back TILED, with
      // the top of the page repeated down the image. The champion view is
      // 24,911px tall — so every measurement taken below 16,384px was taken
      // from a picture of the first screen, and the probe reported the
      // champion card's phone number as dark ink on a green photograph, at
      // 2.49:1, when that number is on cream paper in front of the reader.
      //
      // So the page is measured the way a reader reads it: screen by
      // screen, with the capture and the rectangles taken at the same
      // scroll, so the two agree by construction. There is no stitching and
      // no limit to exceed.
      const contrast = { checked: 0, measured: 0, low: [] };
      const docH = await page.evaluate(() => document.documentElement.scrollHeight);
      const stepPx = await page.evaluate(() => Math.max(240, Math.floor(window.innerHeight * 0.75)));
      await page.evaluate(() => {
        window.__mshSeen = new WeakSet();
      });
      for (let y = 0; y <= docH; y += stepPx) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(120);
        const shot = await page.screenshot().catch(() => null);
        if (!shot) continue;
        const res = await page.evaluate(
          async ({ CONTRAST_MIN, CONTRAST_MIN_LARGE, shot }) => {
          const parse = (c) => {
            const m = String(c).match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
            if (p.length < 3 || p.some(isNaN)) return null;
            return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
          };
          const chan = (v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          const lum = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
          const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const label = (el) => {
            const cls = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
            return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
          };

          // The screenshot, decoded into pixels we can sample.
          let data = null;
          let W = 0;
          let H = 0;
          if (shot) {
            const img = new Image();
            img.src = 'data:image/png;base64,' + shot;
            try {
              await img.decode();
              const c = document.createElement('canvas');
              c.width = img.width;
              c.height = img.height;
              W = c.width;
              H = c.height;
              const ctx2 = c.getContext('2d', { willReadFrequently: true });
              ctx2.drawImage(img, 0, 0);
              data = ctx2.getImageData(0, 0, W, H).data;
            } catch {
              data = null;
            }
          }

          const low = [];
          let checked = 0;
          let measured = 0;
          // The band that is painted OVER the content when the page is
          // scrolled: the masthead, the atlas tabs, the chapter rail.
          let coverTop = 0;
          if (window.scrollY > 0) {
            for (const band of document.querySelectorAll('header, .hdr, .atlas-tabs, .chapters')) {
              const b = band.getBoundingClientRect();
              if (b.top <= 0 && b.bottom > coverTop) coverTop = b.bottom;
            }
          }

          for (const el of document.querySelectorAll('main *')) {
            if (el.children.length) continue;
            const t = (el.textContent || '').trim();
            if (!t) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            // Text that is not painted cannot be read, and its box shows
            // whatever is BEHIND it. Measuring it against those pixels is
            // how the probe reported eight contrast failures for a district
            // name on a photograph that was never on the page.
            if (typeof el.checkVisibility === 'function') {
              if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
            }
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const fg = parse(cs.color);
            if (!fg) continue;

            // Only what is on THIS screen, and not under the sticky band —
            // a scroll-down step paints the masthead over the content, and
            // the pixels there are the masthead's, not the text's.
            if (r.bottom < 0 || r.top > window.innerHeight) continue;
            if (window.scrollY > 0 && r.top < coverTop) continue;

            // One element, one measurement. The page is measured screen by
            // screen and the screens overlap, so an element that is on two
            // screens must not be counted twice. It is marked AFTER the
            // screen checks: an element that is not on this screen has not
            // been measured, and marking it here would lose it for good.
            if (window.__mshSeen.has(el)) continue;
            window.__mshSeen.add(el);

            // Where the text sits in this screen's image.
            const x0 = Math.round(r.left);
            const y0 = Math.round(r.top);
            const x1 = Math.min(Math.round(r.right), W);
            const y1 = Math.min(Math.round(r.bottom), H);
            let r2 = null;
            let how = 'pixels';
            let surfHow = null;
            let surfaceRGB = null;
            let inkRGB = null;

            if (data && x1 > x0 && y1 > y0) {
              // THE SURFACE IS THE MODE. THE INK IS THE DECLARED COLOUR.
              //
              // The pixels in a text box are mostly the surface behind the
              // text, plus the text, plus the antialiased edge between them.
              // So the SURFACE is the most common pixel — and the surface is
              // the one thing the DOM cannot tell us, because on a banner it
              // is a PHOTOGRAPH and there is no opaque background-colour
              // anywhere above the text.
              //
              // The INK is the colour the text is SET in: the computed style,
              // composited with the opacity of the element and of every
              // ancestor above it. Taking the ink from the pixels as well was
              // the third version of this mistake. At 8.4px no glyph ever
              // reaches the declared colour, because every edge is
              // antialiased, so the darkest pixel in the box is a blend — and
              // the probe reported the site's own 4.69:1 label as 3.54:1. The
              // reader sees the declared colour; the declared colour is what
              // the standard asks about.
              const pw = x1 - x0;
              const ph = y1 - y0;
              const px = new Array(pw * ph);
              for (let y = 0; y < ph; y++) {
                for (let x = 0; x < pw; x++) {
                  const i = ((y0 + y) * W + (x0 + x)) * 4;
                  px[y * pw + x] = [data[i], data[i + 1], data[i + 2]];
                }
              }
              if (px.length >= 40) {
                // THE SURFACE IS WHAT IS DIRECTLY BEHIND THE TEXT.
                //
                // This is the fifth version of this measurement, and the
                // reason there have been five is worth writing down, because
                // every earlier version measured a box instead of a word.
                //
                //  1. The DOM's background colour. Fails on a photograph.
                //  2. The darkest pixel in the box. Fails on antialiasing.
                //  3. The mode of the box. Fails when the text is dense.
                //  4. The mode of the pixels far from the ink. Fails when
                //     the text sits on a veil over a photograph: the photo
                //     shows through the veil, and the probe read the photo
                //     instead of the veil the reader actually sees.
                //  5. The mode of the box minus the ink. Fails for the same
                //     reason on a box where the ink is sparse.
                //
                // The one thing every version agreed on is WHERE the text is.
                // So the measurement is anchored there: find the glyphs (the
                // pixels near the declared colour), then look at the pixels
                // immediately AROUND the glyphs. Those are the surface the
                // text is set on — the paper under a word, the veil under a
                // caption, the photograph under a heading. A veil, a
                // photograph and a tinted panel each come out as themselves,
                // because that is what is under the ink.
                const declaredInk = [fg[0], fg[1], fg[2]];
                const dist = (p) => Math.hypot(p[0] - declaredInk[0], p[1] - declaredInk[1], p[2] - declaredInk[2]);
                const INK_TOL = 90;
                const isGlyph = new Uint8Array(px.length);
                let glyphs = 0;
                for (let i = 0; i < px.length; i++) {
                  if (dist(px[i]) <= INK_TOL) {
                    isGlyph[i] = 1;
                    glyphs++;
                  }
                }
                let pool = null;
                let how2 = 'the pixels around the glyphs';
                if (glyphs >= 4 && glyphs < px.length * 0.85) {
                  // The ring: the pixels around the glyphs — but NOT the
                  // glyphs' own antialiasing.
                  //
                  // A one-pixel ring is the halo of the letter, and on a
                  // large bold glyph the halo is most of the ring: the
                  // matchmaker's 17.6px province name was measured against a
                  // surface of (89,74,66), which is the letter blended with
                  // the paper, not the paper. So the ring is taken two
                  // pixels out, where the halo has ended, and a one-pixel
                  // ring is used only when the two-pixel one is too small to
                  // read a mode from.
                  const ringAt = (radius) => {
                    const ring = [];
                    for (let y = 0; y < ph; y++) {
                      for (let x = 0; x < pw; x++) {
                        const i = y * pw + x;
                        if (isGlyph[i]) continue;
                        let touches = false;
                        for (let dy = -radius; dy <= radius && !touches; dy++) {
                          for (let dx = -radius; dx <= radius; dx++) {
                            const ny = y + dy;
                            const nx = x + dx;
                            if (ny < 0 || nx < 0 || ny >= ph || nx >= pw) continue;
                            if (isGlyph[ny * pw + nx]) {
                              touches = true;
                              break;
                            }
                          }
                        }
                        if (touches) ring.push(px[i]);
                      }
                    }
                    return ring;
                  };
                  const ring2 = ringAt(2);
                  if (ring2.length >= 8) {
                    pool = ring2;
                    how2 = 'the pixels around the glyphs';
                  } else {
                    const ring1 = ringAt(1);
                    if (ring1.length >= 8) {
                      pool = ring1;
                      how2 = 'the pixels around the glyphs (one pixel out)';
                    }
                  }
                }
                if (!pool) {
                  // A translucent ink never reaches its declared colour on
                  // screen — every pixel is a blend — so the glyphs cannot be
                  // found by colour. Fall back to the far end of the
                  // distribution, which is the old rule, and say so.
                  const dist2 = (p) => Math.hypot(p[0] - declaredInk[0], p[1] - declaredInk[1], p[2] - declaredInk[2]);
                  const sorted = px.slice().sort((a, b) => dist2(b) - dist2(a));
                  pool = sorted.slice(0, Math.max(12, Math.floor(sorted.length * 0.25)));
                  how2 = 'farthest from ink (fallback)';
                }
                const bins = new Map();
                for (const p of pool) {
                  const k = (p[0] >> 3) + ',' + (p[1] >> 3) + ',' + (p[2] >> 3);
                  bins.set(k, (bins.get(k) || 0) + 1);
                }
                let mode = null;
                for (const [k, n] of bins) if (!mode || n > mode.n) mode = { k, n };
                const inMode = pool.filter(
                  (p) => (p[0] >> 3) + ',' + (p[1] >> 3) + ',' + (p[2] >> 3) === mode.k,
                );
                const surface = inMode
                  .reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0])
                  .map((v) => v / inMode.length);
                const sL = lum(surface[0], surface[1], surface[2]);
                // The declared ink, faded by every opacity above it.
                let alpha = fg[3];
                let n2 = el;
                while (n2 && n2.nodeType === 1) {
                  alpha *= parseFloat(getComputedStyle(n2).opacity);
                  n2 = n2.parentElement;
                }
                const ink = [
                  fg[0] * alpha + surface[0] * (1 - alpha),
                  fg[1] * alpha + surface[1] * (1 - alpha),
                  fg[2] * alpha + surface[2] * (1 - alpha),
                ];
                r2 = ratio(lum(ink[0], ink[1], ink[2]), sL);
                measured++;
                // The two numbers a reader of this receipt needs: the surface
                // the ratio was measured against, and the ink that was
                // composited onto it. A ratio without them is a number
                // nobody can check.
                surfaceRGB = surface.map(Math.round);
                inkRGB = ink.map(Math.round);
                surfHow = how2;
              }
            }

            if (r2 === null) {
              // The box was not in the screenshot, or held too few pixels to
              // read. That is not a pass and it is not a failure; it is
              // "not measured", and it is counted as such.
              how = 'not measured';
            }

            const fs = parseFloat(cs.fontSize);
            const weight = Number(cs.fontWeight) || 400;
            const large = fs >= 24 || (fs >= 18.66 && weight >= 700);
            const floor = large ? CONTRAST_MIN_LARGE : CONTRAST_MIN;
            checked++;
            if (r2 !== null && r2 < floor) {
              if (low.length < 12) {
                low.push({
                  sel: label(el),
                  ratio: Math.round(r2 * 100) / 100,
                  floor,
                  fs,
                  weight,
                  how,
                  surfHow,
                  surface: surfaceRGB ? surfaceRGB.join(',') : null,
                  ink: inkRGB ? inkRGB.join(',') : null,
                  text: t.slice(0, 30),
                });
              }
            }
          }
          return { checked, measured, low };
        },
          { CONTRAST_MIN, CONTRAST_MIN_LARGE, shot: shot.toString('base64') },
        );
        contrast.checked += res.checked;
        contrast.measured += res.measured;
        for (const l of res.low) {
          if (contrast.low.length < 12) contrast.low.push(l);
        }
      }

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
        contrastMeasured: contrast.measured,
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
  'smallest'.padEnd(11) + 'under24'.padEnd(9) + 'tiny-type'.padEnd(11) + 'reading-type'.padEnd(13) +
  'contrast'.padEnd(11) + 'low-contrast',
);
console.log('-'.repeat(112));
for (const r of rows) {
  const bad =
    r.invisible.length > 0 ||
    r.smallTargets.length > 0 ||
    r.belowReadable.length > 0 ||
    r.lowContrast.length > 0;
  if (bad) failures++;
  const smallest = r.smallestTarget ? `${r.smallestTarget.min}px` : '-';
  const tinyType = r.smallest ? `${r.smallest.fs}px` : '-';
  const readType = r.smallestReading ? `${r.smallestReading.fs}px` : '-';
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${r.view.padEnd(11)} ${String(r.w).padEnd(6)} ${String(r.focusables).padEnd(8)}` +
    `${String(r.invisible.length).padEnd(9)}${smallest.padEnd(11)}${String(r.smallTargets.length).padEnd(9)}` +
    `${tinyType.padEnd(11)}${readType.padEnd(13)}` +
    `${String(r.contrastMeasured ?? 0).padEnd(7)}/${String(r.contrastChecked ?? 0).padEnd(4)}` +
    `${r.lowContrast.length ? r.lowContrast.length : '0'}`,
  );
  for (const s of r.invisible) console.log(`       NO FOCUS RING: ${s.sel} "${s.text}"`);
  for (const s of r.smallTargets) console.log(`       TARGET UNDER 24px: ${s.sel} ${s.w}x${s.h}px "${s.text}"`);
  for (const t of r.belowReadable) console.log(`       TYPE UNDER ${READABLE_MIN}px: ${t.sel} ${t.fs}px "${t.text}"`);
  for (const c of r.lowContrast) {
    console.log(
      `       CONTRAST ${c.ratio}:1 (needs ${c.floor}):1: ${c.sel} ${c.fs}px w${c.weight} "${c.text}"` +
        (c.surface ? ` [surface ${c.surface} · ink ${c.ink}${c.surfHow ? ' · ' + c.surfHow : ''}]` : ''),
    );
  }
  const unread = (r.contrastChecked ?? 0) - (r.contrastMeasured ?? 0);
  if (unread > 0) {
    console.log(`       (note) ${unread} text(s) could not be measured — the box was too small to read, which is not a pass`);
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
