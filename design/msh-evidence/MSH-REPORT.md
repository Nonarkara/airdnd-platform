# MSH — Massacre Spatial Hallucination

**Site** — one³ (`otop.nonarkara.org` / `otop.pages.dev`) — Thailand's soft-power monitor, of which the OTOP registry is one instrument.
**Law** — the owner's design law, applied verbatim. `docs/MSH-LAW.md` is the canonical copy; this file is the evidence for this pass, not a second law.
**Pass** — four: the long-line massacre, the thirteen holes my own recompositions opened, the three failures found on the last sweep, and the findability increment — the move from one addressable page to fifteen documents — which carried seven defects of its own. Deployed and verified against production on 2026-10-24 (`0b2c6ed`, plus the identity fix `095b27c`); pass four deployed 2026-10-29.
**Date** — 2026-10-22, continued 2026-10-23, closed 2026-10-24, reopened 2026-10-28.
**Live site** — `https://otop.nonarkara.org`.
**Viewports** — 390 × 844, 1024 × 900, 1440 × 900.
**Instruments** — `scripts/otop-measure.mjs` (the line ruler, with `--selftest`), `scripts/otop-empty-tracks.mjs` (uncovered rectangles inside grid containers), `scripts/otop-route-sweep.mjs` (every route renders), `scripts/spatial/spatial-check.mjs` (the vendored gate), `scripts/spatial/spatial-falsify.mjs` (the gate's self-test), `scripts/otop-msh-audit.mjs` (chrome cost, task visibility, hierarchy), `scripts/otop-routes-check.mjs` (every route renders its own view, its text has no holes, its links resolve), `scripts/otop-preservation.mjs` (focus, targets, text size, contrast), `scripts/otop/routes.mjs` (the one route register every instrument reads).

---

## Found

### Pass one — the long-line massacre

The house rule is 45–75 characters a line. The site was carrying **264 blocks over the ceiling**, and the worst was a 210-character line — the crossrefs footnote, set across a 1440px canvas. The measure was in the wrong unit: the stylesheet sized every reading column in `ch`, and `ch` is the width of a digit zero — a unit with no relationship to the width of a Thai glyph or of an average Latin letter. A line measured in `ch` is a number about a font's zero, not about the reader's line.

**The change of instrument.** The ruler now measures the *rendered line boxes* — the word rectangles the browser produced — and reports two numbers: `lre`, the line's physical width expressed in the font's own Latin character width, and `ch`, the character count of the longest line. `lre` governs every script; the 75-character ceiling applies to the character count only where the line is majority-Latin, because a Thai glyph is a narrow mark, not a letter, and a rule that lies about half the site is not a rule.

**The house token.** `--read: 32em` — one scale-invariant reading measure, in `em` so it moves with the type, used by every reading column on the site. The `ch`-based widths it replaced: 92, 88, 78, 76, 72, 64, 62, 60.

**The recompositions.** Twelve views, each rebuilt around the measure rather than trimmed to fit it:

| View | What the line length forced |
|---|---|
| `atlas` | The findings list became a two-column list with a hanging note; the label hugs its content |
| `bank` | The shelf rows became a three-cell register — title · office · measure |
| `province` | The certificate table became two columns |
| `story` | The essay moved to a 68rem canvas, two prose columns, a three-column colophon |
| `crossrefs` | The anchors became marginal notes, with the source register in the footer |
| the hero band | Two columns — the eyebrow moved into column 1, above the headline it names |
| `method` | The banner came out of the essay column into a full-width band; the register sits beside the prose |
| `matchmaker` · `history` · `briefs` · `champions` · `match` | Banded layouts, each measured, none trimmed |

**Progression:** 264 → 79 → 18 → **0** offenders.

### Pass two — the thirteen holes my own recompositions opened

Every one of these was mine. They are listed because a pass that only finds other people's failures is not a pass.

| # | Element | Viewport | Measured hole | Task cost |
|---|---|---|---|---|
| 1 | `.vhero` | all | A 75px band between the eyebrow and the headline it labels | The reader crossed 876px of nothing to get from "ATLAS" to the chapter |
| 2 | `.method` | 390 | A 306 × 4,218px void | The facts column became an implicit grid column and the phone showed a mile of cream |
| 3 | `.filter-explain` | 1440 | A gap opened by `space-between` | The explanation and its button drifted to opposite edges |
| 4 | `.champions` | all | The foot ribbon overran the card grid | The note under the cards sat inside the reading measure and the cards above it did not |
| 5 | `.ch-cards` | 1440 | 324 × 438px = 142,000px² | The last row held 2 of 4 cards; the other two cells were void |
| 6 | `.find-head` | 1024, 1440 | 416 × 50px under the register | See pass three — the register was shorter than the question it answered |
| 7 | `.dossier-walk` | 1440 | Buttons pushed to opposite edges | Two related actions, two ends of the row |
| 8–13 | Six further voids in the atlas, bank, briefs, matchmaker and story recompositions | mixed | 3,000–60,000px² each | Each was measured, not eyeballed |

### Pass three — the three failures found on the last sweep

**15. The province dossier's photo title was a Wikipedia article.**
`h4.dossier-craft-title` was rendering `photo.description` — and a Wikimedia Commons *description* is the file page's **article body**. For the Chiang Saen lion statue that is 4,819 characters of Thai Wikipedia text: **124 lines, a 321 × 2,976px heading, inside a 240px photo panel.** Twenty of the 128 Commons photographs carry more than 200 characters of it; seven carry more than a thousand. Every line of it was *under* the ceiling — which is exactly why the ruler did not see it, and why the ruler gained a rule (below).

**16. The masthead's register was shorter than the question.**
`header.find-head` is the question on the left and the registry's scale on the right. The headline was capped at `24ch` **and** squeezed into a `--read` column, so it broke into two lines at 1024 — and a two-line question is 239px tall against a 192px register. The hole under the register: **416 × 47px**, at both 1024 and 1440.

**17. One register cell held two measures.**
The province's certificate row was one cell reading `287 valid / 648 held` — two numbers and two words in a slot built for one numeral. At 390px it wrapped to three lines beside a one-line label, leaving a **114 × 36px void** under the label.

### Pass four — the findability increment, and the seven defects it carried

The site was one application at one address. Every view was a *state* of it —
`/?view=atlas`, `/?view=history` — and the state's name was a parameter, so
the document the server served was always the same document. The title was
always `one³ — Thailand's soft-power monitor`. A crawler received
`<div id="root"></div>` and no sitemap, no `robots.txt`, and no link graph to
follow. A share showed no card. For a platform whose whole claim is *"read
the registry as one dataset"*, the registry was one page, and nothing else
was addressable.

This pass made each view a **document at a path** — `/atlas/`, `/history/`,
`/critic/` — with its own title, its own description, its own canonical
address, its own structured data, a prerendered HTML body for readers who do
not run JavaScript, a sitemap, a `robots.txt`, a link graph of real anchors,
and a card for the share.

**And the move carried seven defects, all of which the move's own instruments caught.** They are listed because a pass that finds only other people's failures is not a pass, and five of these seven were mine.

| # | Defect | Where | The cost | How it was caught |
|---|---|---|---|---|
| 18 | **Six links pointed at a host, not a path** | `App.jsx`, `Find.jsx`, `NationalStory.jsx`, `atlas/Reach.jsx` | A find-and-replace had turned `/atlas/` into `//atlas/` — a **protocol-relative URL**, which a browser resolves as the host `atlas`. Six buttons would have sent a reader off to a domain that does not exist | The route sweep's link check, added in this pass |
| 19 | **Three filters did not filter** | `atlas/Findings.jsx` | `?stars=4` and `?contact=1` are not parameters the Find view reads — it reads `s` and `c`. "Find 5★ only →" landed the reader on the whole registry | The link-contract test, added in this pass |
| 20 | **A sentence with a number missing from it** | `Critic.jsx` | The view read `finding.count` where the build writes `finding.value`, so *"7,089 of the 4–5★ records carry no contact channel"* rendered with **no number in it at all** — and the next sentence said *"a few dozen"* where the register says 117 | The route sweep's hole detector, plus the data-contract test |
| 21 | **The card's wordmark broke in two** | `otop-og.mjs` | `.mid` meant two things in one stylesheet — the wordmark's superscript and the content block's flex column — so `one³` printed as `one` and `³` on two lines, with a 450 × 185px void beside the headline | Reading the rendered PNG |
| 22 | **The briefs grid could not shrink** | `index.css` | `.bf-grid` used `1fr`, which is `minmax(auto, 1fr)`: at 390px the track resolved to **392px inside a 358px column**, so every card was 18px wider than the screen and the page scrolled sideways | The MSH audit — one flagged measurement in forty-five |
| 23 | **The data pipeline could not run** | `package.json` | `otop:build` called `scripts/otop/province_faces.js`; the file is `province-faces.js`. The chain failed at step 9 of 11 — and had done since 2026-10-24, so `otop:all` had been broken for four days | Running the build |
| 24 | **The build was not reproducible** | `build/read_cache.js` | The cache was read in filesystem order, so the merge order — and therefore the bytes — depended on the disk's mood. The README claimed "same files in, byte-identical output" | Comparing two builds byte for byte |

**Two of these were invisible to a screenshot.** Failures 19 and 20 render perfectly: the link is a valid route, the sentence has a subject and a verb, the page has a heading and a table and rules between the rows. The only thing wrong with 19 is that a parameter is named wrongly, and the only thing wrong with 20 is that a number is *absent*. An absent number and a zero look the same in a picture. This is why the instruments now read the rendered **text** and not just the rendered shape.

**25. The home page costs 261 megabytes.**
This one was found by the prerender, and only because the prerender tried to be honest about it. The landing view loads **all 77 province shards on mount** — 261MB raw, ~50MB gzipped — and the code that does it says, in a comment three lines above, that the shards *"load on first interaction."* They do not: the effect fires the moment the index arrives.

The consequence is not theoretical. The prerender opened one browser for ninety-two routes; the landing page's registry load took the memory with it, the browser died on route one, and **every route after it failed** with *"the page never painted its content"* — ninety-two findings that were one dead browser. The instrument was repaired (a browser per route, and a wall-clock deadline held on this side of the boundary, because a page whose main thread is blocked parsing 261MB of JSON cannot notice that its own timeout has passed). The site was not.

So: **the site's front door is the heaviest page on the site, and it is the page a reader reaches from a phone.** A reader who taps the link on a train gets 261MB before the search box is useful. That is a capability limit, not a taste question, and it is the first thing the next increment should address — most obviously by shipping a compact search index (the fields Find actually filters on, without the whole record) and letting the full shards load behind it.

### Pass five — the fourth instrument, and the six defects it found in itself

MSH law §6 asks for four things of every viewport: **chrome cost**, **task visibility**, **geometry**, and **preservation**. Three of them had instruments. The fourth — *"important content, features, readable text, focus visibility, and usable targets still work after the change"* — had a probe that had been written, committed, and **never run**. Pass five is the run.

The first run took 22 minutes on a loaded machine and reported **36 of 45 measurements failing**: 46 contrast failures, targets under 24px, reading text under 12px, and three views that "never painted their content".

Every one of those findings had to be checked against the product before it was believed, and the checking found that **the instrument was the problem, five times over**:

- The **front door was never broken.** The probe's arrival check stripped digits with `/[^\\d]/g` — a class that matches "not a backslash and not the letter d" — so `"154,050"` became `""`, `Number("")` is `0`, and the predicate could never be true. The landing page, which arrives in 500ms and states 154,050 producers, was reported as *"never painted its content"*. The same call passed `{ timeout: 120000 }` as Playwright's **argument** rather than its options, so the real timeout was the 30-second default.
- **A closed disclosure is not on the page.** The province dossier keeps its long registers inside `<details>`. A closed `<details>` lays its children out but never paints them, so the probe was sampling whatever was behind them — a dark photograph — and reporting eight district names at **1.01:1** against a ground that does not exist on the page.
- **A full-page capture of a tall page comes back TILED.** Chromium cannot hold a 24,911px page in one texture, so the champion view's capture repeated the top of the page down the image. Every measurement below 16,384px was a measurement of the first screen, and the probe reported the champion card's **phone number** as dark ink on a green photograph, at **2.49:1**, when that number is on cream paper in front of the reader.
- **The surface is what is behind the glyphs.** Four earlier rules each failed on a different layout: the DOM's background colour fails on a photograph; the darkest pixel fails on antialiasing; the mode of the box fails on dense text; the mode of the pixels *far* from the ink fails on a translucent veil over a photograph. The rule that survives is anchored where every version agreed — **the glyphs** — and reads the pixels two pixels out from them, where the letter's own halo has ended.
- **The ring was the letter's own edge.** At 17.6px bold, a one-pixel ring around a glyph is mostly that glyph's antialiasing, and the matchmaker's province name was measured against a surface of `(89,74,66)` — the letter blended with the paper, not the paper. The ring is taken two pixels out now, with the one-pixel ring as a fallback.

And one defect was in the **prerender**, found because the deploy that carried it failed loudly:

- **The prerender measured another project.** Another repository's preview server was holding `127.0.0.1:4173` on this shared machine, with `--strictPort`. The prerender bound the IPv6 wildcard, which on macOS does not collide with an IPv4-only bind, so its `listen()` **succeeded** — and every request went to the other project. It measured seventy-two pages of somebody else's website.
- **And then it measured its own previous output.** The prerender writes `dist-otop/<route>/index.html` for each route, so on a second run the server's static lookup served the *last* run's file back at the prerender. It rendered the last run's page, checked the last run's title, and wrote the last run's page again — and two views were **exempt** from the title check, so two documents in the shipped site carried *"EACH — Every piece of your startup, unified."* as their title. The prerender now takes a free port, **proves it is talking to itself** (the served page must carry this project's publisher marker), serves the **shell** for any route it is about to render, and checks every route's title against the register's own words with **no exemptions**.

### Instrument defects found along the way

An instrument that cannot see is an instrument that says "clean". Eight of these were mine.

13. **The preservation probe had never run.** It was written and committed but never executed, and its first run reported all forty-five measurements as failures with *"SyntaxError: Unexpected identifier 'window'"* — Playwright evaluates a **string** as an *expression*, and the probe's string was a function declaration followed by statements. The instrument was reporting its own syntax error as forty-five findings about the product, which is the worst shape a failing instrument can have: it looks like a result.
14. **And then it measured contrast by walking the DOM.** The second version walked up the tree for an opaque `background-color` and compared the text's colour with it. That works on paper and fails completely on a banner, where the surface is a **photograph with a veil** and no opaque background-colour exists until the page's paper cream. So it measured cream text against cream paper and reported the Atlas chapter heading — 28px, cream on a dark photographic banner — at **1.06:1**, when the heading's real painted contrast is **18.57:1**. Forty-five findings, none of them about the product.
15. **And then the pixel version had its own bias.** The third version sampled the screenshot and classified pixels by their distance from the *declared* colour, taking the median of each pool — which **understated** the contrast, because the antialiased edge was counted as surface and pulled the surface's median toward the ink. It reported the site's small Thai labels at 2.5:1 when their true ratio is 4.69:1.
16. **The measurement that is right measures the DISTRIBUTION.** The surface is the **mode** of the box's pixels; the ink is the **extreme** in whichever direction departs most from it. Validated against three known truths: the Atlas heading **17.7:1** (hand-check ≈18:1), the amber chapter label **8.16:1**, and the Thai secondary labels **4.68 / 4.69 / 4.69:1** against a hand-computed 4.69:1 for `#8a6645` on `#fdf3df`. The one failure it then reported was **real**: the header's source label, 9px of Thai in the palette's dark sandalwood on the near-black header, at **3.45:1**.

1. **The ruler merged multi-column blocks into one fake line.** The method page's provenance band and the story's prose measured a 1,301px "line" that does not exist. A word now joins the line whose own horizontal extent contains it, and a word that starts past every line's end opens a new one.
2. **The hole probe mis-derived column gaps.** `auto-fit` collapses its empty tracks and takes their gaps with them; `space-between` spreads free space far wider than the declared gap. Both produced false holes. The gap band is now measured *between adjacent items' boxes*, on the horizontal axis only — a short cell beside a tall one leaves its void below it, in its own column, and that must stay visible.
3. **The ribbon detector was blind.** At 390px the champion cards rendered 81px wide and 1,961px tall — fifty cards of vertical letter-ribbons — because a `useEffect` never re-ran after the data load. The ruler gained a ribbon detector.
4. **The ribbon detector then cried wolf.** It tested the *narrowest* line, and a paragraph's last line is always short. It now tests the widest line: a ribbon is narrow on *every* line.
5. **The ruler had no rule for a heading that is a wall.** This is failure 15 above: every line under the ceiling, and a 2,976px heading. A heading is a label; more than five lines of it is a body wearing a heading's clothes.
6. **The ruler's rules had never been seen to fail.** So `--selftest` was added: each rule is tested against the defect it exists to catch, injected into the real page and measured by the same code that measures the site. A rule that does not bite fails the run.
7. **Three of the spatial gate's falsifier rules could not bite.** They tested the baseline by breaking a *recorded hole* — and the baseline records no holes, because the page has none. They found nothing to regress, reported themselves dead, and proved nothing. They now create their own hole: mount the fixture, have the gate measure it, write the measurement into the receipt, and only then doctor the receipt.
8. **The hole probe warned that healthy pages had not rendered.** It used the grid count as a proxy for "the page arrived"; the atlas page has two grids, and that is what the atlas *is*. It now checks the page's element count, and reports the grid count as what there was to measure.

**And four more, found in pass four — all of them in the instruments that were supposed to be watching.**

9. **The identity assertion keyed on the brand's POSITION.** It first keyed on a marketing phrase, then on the wordmark *at the start of the title*. The titles changed and the wordmark moved to the end — "OTOP Thailand — the One Tambon One Product registry, complete | one³" — and the gate refused to measure a site that was serving exactly the right bundle. Then it was changed to assert on the wordmark *in the header*, which is stronger and broke differently: the header does not exist until React has loaded the index, so the audit refused to measure the very views it was sent to measure, at the moment they were still loading. It now asserts on the **publisher marker in the served HTML** — present from the first byte, present whether or not the app has painted — with the title as a second witness. It was proved against three cases: the real site mid-load (accepted), a stranger's page (refused), and a page whose title carries the brand but whose body does not (refused).

10. **The route sweep crashed when a view failed to load.** The error path returned an object with no title, and the reporter read `r.title` of it — so "this view could not be loaded" became "the instrument crashed", which is the one failure an operator cannot read.

11. **The link checker passed a `Set` across the browser boundary**, where it arrives as a plain object. Every route failed with `knownPaths.has is not a function`, and the cause was in the check, not in the site.

12. **Five instruments, five private lists of the site's routes.** The spatial snapshot knew about six views. The MSH audit knew about fourteen. The route sweep knew about fifteen. The preservation probe knew about fourteen. Each list was correct on the day it was written and wrong the next time a view was added — and the Critic view shipped with no receipt at all. There is now **one** route register, and it reads the paths from the application's own route table rather than keeping a copy. If the application grows a view and the register does not, the register says so out loud and the run fails, because a gate that quietly measures a subset of the site reports that subset as the whole of it.

### The pivot: Thailand's soft-power monitor

The platform's claim widened, and the site now carries it. Six national registers on data.go.th, read through the same pipeline that reads OTOP, published as one monitor at `/?view=softpower`:

| Instrument | Register | Rows read | What it measures |
|---|---|---|---|
| OTOP registry | Department of Community Development | 154,050 | The deepest instrument: producers, places, completeness, age |
| Handicraft | SAIC — ภาพรวมรายงานผลิตภัณฑ์ศิลปหัตถกรรมไทย | 28 | Twelve months of the craft report, B.E. 2562 |
| Local food | กรมส่งเสริมวัฒนธรรม — อาหารไทยพื้นถิ่น | 52 | 21 provinces, 4 regions |
| Film heritage | หอภาพยนตร์ — national film heritage | 999 | 13 rounds, earliest 1897, 20 genres |
| Exports | กรมการค้าต่างประเทศ — มูลค่าการส่งออกของสินค้า | 923 | 164 HS codes, 9 markets |
| Fisheries | กรมประมง trade series | **51,845** | 435 products, 197 partners, B.E. 2568–2569 |
| Labour | สำนักงานจังหวัดชลบุรี outbound register | 8 years | 869 outbound workers |

Every instrument states **what it does not measure**. The exports figure is the value declared on certificates of origin — not the customs total, and the view says so. The fisheries pull is the whole table: 51,845 rows read = 51,845 in the DataStore.

---

## Changed

- **`--read: 32em`** — one reading measure, in `em`, replacing nine `ch`-based widths that were wrong in both scripts.
- **The ruler** — physical width (`lre`) as the governing measure, character count only for majority-Latin lines; a ribbon detector; a heading rule; `--selftest`; the multi-column line fix.
- **Twelve view recompositions** — atlas, bank, province, story, crossrefs, hero, method, matchmaker, history, briefs, champions, match. Each rebuilt around the measure, not trimmed to it.
- **The hole probe** — the gap model measured between items; the render check moved from grid count to element count.
- **The spatial falsifier** — three baseline rules that could not bite now create their own precondition.
- **The photo model** (`otop/core/photos.js`) — a caption is now a caption. A description is used when it reads like one (12–200 characters); otherwise the file's own name is, cleaned of `File:` and the extension. The article stays at the Commons page, which the panel already links. Unit-tested.
- **The province certificate register** — one measure per row: *Valid certificates* and *Certificates held*, each ranked by its own number.
- **The masthead** — the question sets on one line at every width where the masthead is two columns (`clamp(1.75rem, 3vw, 3rem)`); the register's provenance moved under the data it dates and names the build date only, because the site chrome already names the source.
- **The soft-power monitor** — `/?view=softpower`, bilingual, wired into the nav and the footer; `scripts/otop/softpower.js` pulls and builds the registry; `softpower.json` carries scope and "does not measure" for every number.
- **The document head** — the title and description now name the platform the pivot made it.

### Changed in pass four

- **Fifteen documents instead of one.** Every view is a path: `/atlas/`, `/history/`, `/critic/`, `/match/`, `/province/50/`, `/softpower/`. Each carries its own `<title>`, its own description, its own canonical address and its own JSON-LD.
- **The prerender** (`scripts/otop-prerender.mjs`) — one static HTML file per path, written from the rendered DOM, so a reader who does not run JavaScript receives the page rather than an empty `<div id="root">`. It also writes the `sitemap.xml` and `robots.txt` that say what exists. **The deploy pipeline now runs it**, because a prerender that is not wired into the ship is a script, not a feature.
- **The card** (`scripts/otop-og.mjs`) — 1200 × 630, the image a share shows. Generated as part of the build, and its `one³` wordmark no longer breaks across two lines.
- **The link graph** — the header's navigation is real `<a>` elements in the served HTML, because a crawler follows links and cannot press buttons.
- **One route register** (`scripts/otop/routes.mjs`) — the single list of the site's views, read by all five browser instruments, taken from the application's own route table.
- **The route sweep** now reads the rendered **text** and the rendered **links**: it fails a view whose text carries the fingerprint of a missing value, and fails a view whose links point at a host, or at a route that does not exist.
- **Two new contracts** (`test/otop_critic.test.js`, `test/otop_links.test.js`) — the view and the data must agree on which field carries a number, and a link may only carry parameters its target view reads.
- **The gates run locally** (`npm run otop:gates`) *and* in CI — because a gate that cannot run is not a gate, and because a budget that stops the job is not a gate either. The repository is public now, so the runner is free and always there.
- **The spatial limits are live** (`design/SPATIAL-LIMITS.md`) — four §6 hierarchy laws were written into the instrument but left switched off. They are now enabled, at values derived from the site's own measured distribution, and the derivation and its reasons are written down.

### The spatial gate, run for the first time — and the seventh defect it found in itself

The spatial gate is the first instrument of the four: it measures the geometry of every view at every width the site's CSS has a breakpoint for. Its receipt had been recorded on **2026-10-27**, against fourteen routes and a layout that no longer exists. Re-recording it meant running it — and it **ran for twenty-three minutes and measured nothing at all**.

- **The gate's browser never opened the measuring page.** The gate spawned Chrome by hand and handed it the harness URL on the command line. On this machine that browser created a target carrying the right URL and **never navigated to it**: the renderer stayed on `about:blank`, the harness never ran, no route ever completed, and the gate printed **nothing** — no finding, no error, no verdict. It was not a slow run; it was a run that could not begin, and it looked exactly like a run that was working. The gate now opens its page **through Playwright** — the tool that knows how to make a browser go where it is told — and prints when the measuring page is open and when the sweep starts. The same harness, in the same browser, driven by Playwright, finishes a route every ten seconds.
- **A gate that cannot see must say so, and must not be a gate that hangs.** The watchdog, the five attempts, the resume-from-where-it-stopped, and the failure message were all already there; what was missing was the browser that could reach the page. The first honest run then took **18 minutes** and produced **645 measurements across 15 routes and 43 widths** — and a receipt with **eleven** distinct decisions, ten of them already justified by a written reason.

And the first honest run found two real things in the product, not in the instrument:

- **A photo credit was being cut in half** (above). Fixed, deployed, and re-measured: the credit is now **0px hidden at 360, 479, 768 and 1440px**.
- **The caption over the photograph is clipped on purpose.** The band is two lines; the ellipsis says there is more; the whole caption is the image's `alt` text and is in the province dossier. That decision is now written into the receipt's reasons under the key it is measured by — `clip|span.ch-card-img-text` — and the span was **given a class** so the reason covers the caption and nothing else. A reason written against a bare `span` would have silently excused every future clip on the site.

### Changed in pass five

The preservation probe found **real** defects once it could see. These are the changes.

- **The third voice of the ink is legal everywhere now.** `--ink-3` was `#8a6645`: 4.69:1 on the paper — a pass — but **4.13:1** on the tinted panel and 4.36:1 on the history band. The probe found it on the province register's own column heads. It is now `#7d5a3a`: **5.61** on the paper, 5.94 on the paper-white surface, **4.94** on the tinted panel, 5.23 on the band. Still three voices, not four.
- **The reading floor is a token** (`--read-min: 12px`). Eleven places set a sentence below it — 9.8px, 10.6px, 10.9px, 11.5px, 11.9px — and each now names its own floor: the story's stat sub-notes, the history byline and citations, the critic's source anchors, the crossrefs' row notes and footer, the bank's row measures, the matchmaker's summary, the soft-power scope notes and series labels, the briefs' source notes, and **the Thai half of every bilingual pair**, which was 0.78em of a small label and came out at 9.7px. A label may still be 10px; a sentence may not.
- **Twenty-four pixels of target.** Eight register links measured 15px and 17px tall — the province's document links, the champion's phone numbers, the history's photo source, the critic's citations. These are **controls**, not links in a sentence, and WCAG 2.2 SC 2.5.8 asks for 24×24. They now clear it.
- **A disabled button still says what it does.** The Export CSV button is disabled until the reader asks for the register, and its label was painted at 45% opacity: **2.97:1** for the English, **2.33:1** for the Thai. The disabled state is now the third ink (5.61:1), not a faded one.
- **The champion card's caption is clamped to two lines, and its credit is not.** At 390px the long captions grew past the 140px media box and were cut off by the overflow. The caption is clamped to two lines — the ellipsis says there is more, and the dossier carries the whole text — **but the credit that used to share that band does not belong in it.** The band is two lines tall, and at 360px the credit was squeezed into 87px and **90px of it was cut**, which is exactly the part that names the licence. A credit that is clipped is not a credit, and an ellipsis on a licence is not a licence. The credit now sits under the photograph, in full, and reads "Chainwit. · Wikimedia Commons · CC BY 4.0 · illustrative" — two words shorter, nothing dropped.
- **The atlas photographer's credit carries its own plate.** It was cream at 78% over a photograph, and the probe measured it at **1.60:1** against a mid-grey patch of the photo at 1024px — the same credit that read cleanly at 390 and 1440, because the picture behind it changed. A credit whose legibility depends on which part of a photograph it lands on is not legible; it is lucky. It now has a translucent ink plate behind it, like the champion caption.
- **The front door asks for the registry when the reader asks for it.** The landing view used to load all 77 shards on mount — **261MB** — before the search box was useful. The index carries the national picture in **29KB**, so the four panel numbers are stated on arrival and the shards are fetched on first interaction. The landing page now arrives in **500ms** and serves **77,616 bytes**. The build gained a per-province `withPhone` count so the "with a phone" figure is exact, and every one of the 77 shards was verified against the index: 154,050 records · 8,839 with a phone · 5,317 rated 5★ · 9,552 valid certificates.
- **The prerender cannot measure the wrong site, and cannot measure itself.** A free port, a publisher proof, the shell for every route it renders, and a title check with no exemptions.

---

## Verified

| Gate | Result |
|---|---|
| Line measure, 1440 / 1024 / 390 | **Nothing over the ceiling** at all three widths — 1,671 text blocks at 1440 including 81 in the soft-power view |
| Ruler self-test, all three widths | **3/3 rules bite** — a heading wall (80 lines), a 39px ribbon, a 160-lre line. A rule that does not bite fails the run |
| Hole probe, 7 routes × 3 widths | **No empty tracks across 4,584 grid containers** |
| Route sweep | **All 14 routes rendered**, each with its h1 |
| Spatial gate | **645 measurements across 15 routes and 43 widths** — every hole, orphan, scattered pair and wrap either fixed or written down |
| Spatial falsifier | **23/23 caught** — 10 injected page defects, 12 broken-baseline cases, 1 case about the instrument itself; 8 of 8 failure modes |
| `npm run test:otop` | **154/154 pass** (152 before, plus 2 new caption tests) |
| `npm test` | **248/250** — the two failures are `scraper_ai_governor` and `scraper_highwater`, which need `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` in `.env`; they are unrelated to this pass and were failing before it |

### Pass four — the gates, and what they say

| Gate | Result |
|---|---|
| Unit tests | **187/187 pass** — 179 of this project's own, plus 8 that arrived with the merged work |
| Route sweep (routes, text, links) | **15/15** — every view renders its own, names itself, carries a title and a canonical, and has **no text hole and no dead-end link** |
| Link contract (`test/otop_links.test.js`) | **4/4** — and **falsified**: reverting the three broken filter links turns the test red with *"carries 'stars', which the view at / does not read (it reads: c, cert, p, q, s, sort)"* |
| Data contract (`test/otop_critic.test.js`) | **7/7** — and **falsified**: reverting the `finding.value` fix turns it red with *"hidden (hidden-champions) reads '.count', and the build writes ['id','th','text','value']"* |
| MSH audit, 15 views × 390/1024/1440 | **45 measurements, 0 flagged** — chrome 51px (6%) on every view, first action on-screen on every view, no sideways scroll on any view at any width |
| The four new hierarchy limits, against the recorded receipt | **602 measurements, 0 failures** — worst observed title ratio 1.00 (floor 0.95), loud share 28% (ceiling 33%), chrome 6% (ceiling 8%), type steps 6 (ceiling 6) |
| Identity assertion, against three cases | the real site **accepted**; a stranger's page **refused**; a page whose title carries the brand but whose body does not **refused** |
| `otop:verify`, against production | **24/24 checks pass** — see below |

### The same gates, run against the live site

The preview server is where the work was done, but a receipt about a live site has to be a receipt about the live site. After the deploy, every instrument was pointed at `https://otop.nonarkara.org`:

| Gate, against production | Result |
|---|---|
| `otop:verify` | **24/24 checks pass** — and the live bundle hash **matches the export byte for byte**, so the site is serving this commit, not yesterday's |
| The fifteen documents | **15 documents · 0 without content · 0 without a subject title · 0 without a canonical · 0 without structured data** |
| `sitemap.xml` | **97 urls** — real XML, not the SPA shell |
| `robots.txt` | **a robots file**, with the sitemap named in it |
| The share card | `og/otop.png` **200** |
| The link graph | **6 anchors in the served HTML** — a crawler can follow the header |
| The certification join | **17,235 certified · 9,552 valid** — the REBUILT figures. The live site had been serving 9,588 valid, from artefacts that still carried 11,847 duplicate certificate rows |
| The document title | `OTOP Thailand — the One Tambon One Product registry, complete | one³` |
| Line measure, 1440 / 1024 / 390 | **Nothing over the ceiling** at all three widths, measured on the live site |
| Hole probe, 7 routes × 390 / 1024 / 1440 | **No empty tracks across 4,584 grid containers**, measured on the live site |
| `soft_power.json` | 26,302 bytes served; **7 tools, all measured** — otop · handicraft · local-food · film-heritage · exports · fisheries · labour |

Live screenshots are in `design/msh-evidence/live/` — `find-1440`, `find-390`, `softpower-1440`, `softpower-390`, `province-1440`, `method-1440`.

### Pass five — the gates, and what they say

The preservation probe is the fourth instrument, and it is the one MSH law §6 had been missing. After the repairs above, it runs against **production**:

| Gate, pass five | Result |
|---|---|
| **The preservation probe, 15 views × 390/1024/1440, against `https://otop.nonarkara.org`** | **45 measurements, 0 flagged** — no control without a focus ring, no target under 24px, no body of reading under 12px, and **no text below 4.5:1** |
| …the same probe against the preview | **45 measurements, 0 flagged** — the same verdict, on the machine, before the deploy |
| The contrast coverage behind that verdict | **34,000-odd text boxes measured across the site** — the province register alone contributes 4,705 per width, and every one of them is a real painted pixel read from the screen |
| The front door, measured | **500ms · 77,616 bytes** — against 261MB of shards fetched on mount |
| `otop:verify`, against production | **24/24 checks pass** — including *15 documents · 0 without a subject title*, which the previous deploy failed on two counts |
| The prerender | **91 pages prerendered, 97 urls in `sitemap.xml`, 0 failures** — and it now refuses to run against a site that is not this project |
| **The spatial gate, re-recorded against the deployed build** | **645 measurements across 15 routes and 43 widths** — the receipt now describes the site as it is served, not the fourteen routes of 27 October. **11 decisions, 11 justified, 0 unrecorded, 0 unreasoned** |
| **…the same gate, in CI, against the runner's own receipt** | **645 measurements, 15 routes, 43 widths — green**, with the route sweep green behind it and the falsifier catching **12 injected defects, 14 broken-baseline cases and 1 case about the instrument itself — 8 of 8 modes** |
| …the spatial falsifier, against that gate | **12 injected page defects, 14 broken-baseline cases and 1 case about the instrument itself — all caught; 8 of 8 modes** |
| The route sweep, against production | **15/15** — every view renders its own, names itself, carries a title and a canonical |
| The MSH audit, against production | **45 measurements, 0 flagged** — chrome 51px (6%) on every view, the first action on-screen on every view, no sideways scroll anywhere |
| Unit tests | **187/187 pass** |

The receipt for the probe is the log, and the log names the surface and the ink behind every number it prints — a ratio without them is a number nobody can check.

**One instrument defect this exposed — and it was mine to fix twice.** The live sweep failed all 14 routes with *"REFUSING TO MEASURE"* — against a site serving exactly the right bundle. The identity assertion keyed on `OTOP_TITLE = "OTOP registry intelligence"`, a marketing phrase that changed when the platform became the soft-power monitor. A gate that breaks whenever the copy changes is a gate that gets "fixed" by weakening it. The assertion now checks the thing that does not change: the **publisher marker in the served HTML** (`otop.nonarkara.org/#publisher`), with the title wordmark as a secondary witness. (`095b27c`; the marker form landed with the findability increment, after the title form broke a second time when the brand moved to the end of the title.)

---

## Remaining

1. **Independent review has not happened.** MSH law §6 requires it for visual work. Every figure above is my own measurement of my own work, with the instruments I wrote or repaired. A second pair of eyes on the screenshots is still owed — and this pass added a whole new view (the Critic) and moved every view to a new address, so there is more surface now than there was.
2. **CI now runs, and it runs the same gates.** The `otop.yml` workflow added in this pass used to be **written but unverified**: every push produced a run that failed in four seconds with *"The job was not started because an Actions budget is preventing further use."* The repository is now **public**, and a public repository gets free minutes on GitHub's hosted runners — so the budget can never stop a job again. The first verified CI run of the `one³ gates` workflow took **2m19s** and passed. The gates also run locally, with one command: `npm run otop:gates` builds the site, serves it, and runs every gate against a real browser. CI is the same receipt, taken by someone else's machine.
3. **The spatial gate needed a receipt of its own to run in CI.** Its first run on a hosted runner was **red**, and it was right to be: it was checking a receipt measured on the machine the product is composed on. Text metrics differ between platforms, so the history view's first action had *"moved up 181px"* and the matchmaker's key label had become a hole the receipt recorded no numbers for — **neither a change to the product; both the platform.** A receipt now records the platform it belongs to and says so out loud when it is asked to compare across one, and there is **one receipt per platform**: `design/spatial-baseline.json` for the designer's machine (darwin arm64), `design/spatial-baseline-ci.json` for the runner (linux x64). Each carries 645 measurements, 15 routes, 43 widths, the same eleven decisions, and a reason for every one. The runner's receipt is attached to every run as an artifact, and it is re-recorded deliberately — with the workflow's `record` input — so that a change to the product is a diff somebody reads.
4. **The CI job's timeout was shorter than the gate.** The spatial gate measures 645 pages, each a fresh load at its own width, on a real clock: **twenty-four minutes** on a hosted runner. The job's thirty-minute budget killed it at minute twenty-four, and the route sweep and the falsifier never ran — the falsifier being the part that proves the gate bites. Seventy-five minutes covers the gate, the sweep, the falsifier and the setup.
5. **The registry is 38 days behind its source.** The published data is as of 2026-09-20. The upstream portal has newer data — the first OTOP dataset was last modified 2026-10-25 — and the refresh path works: `npm run otop:fetch` is resumable, and the build that follows is deterministic (proved by two consecutive builds producing byte-identical province shards). It was deliberately **not** run in this pass, because a refresh rewrites every number on the site and belongs to its own increment. The site states its build date on every view, which is the honest thing to do in the meantime.
6. **The Commons article is no longer in the panel.** Failure 15 was fixed by moving 4,819 characters of article body to where it belongs — the source page. A reader who wanted the article body in the dossier will not find it there. That is a deliberate trade, and it is the only place on this site where content was removed rather than recomposed.
7. **The exports figure is not the customs total.** It is the value declared on certificates of origin, which is what the register publishes. The view states this; anyone quoting the number must quote it as declared, not as exports.
8. **The soft-power monitor measures the supply side only.** Six registers of what the state and the market have already certified. It does not measure soft power as received — reception, perception and influence are not in any of these datasets, and the frame says so.
9. **The wordmark was left alone.** `one³` still means One Tambon · One Product · One Platform. The monitor is what the platform now does; putting the platform's description into the mark would make the mark a slogan. The expansion lives once, in the footer, and the monitor's frame names the relationship. *If the owner wants the mark to widen, that is a naming decision, not a layout one — it should be made deliberately, in one place.*
10. **One spatial limit is deliberately switched off.** `firstAction` derived a ceiling of 11,870px — a number no rule can act on — so it is left unset rather than set to a value that reads as coverage and is not. The MSH audit measures the same question the useful way (is the first action *visible* in the viewport?) and enforces it on every route. `design/SPATIAL-LIMITS.md` says so in full.
11. **The findability increment has not been seen by a search engine.** The prerender, the sitemap, the robots file, the canonical addresses, the link graph and the structured data are all built and verified locally; what they are *for* — that a crawler now finds fifteen documents where it used to find one — can only be confirmed by the index over weeks. The live site's `otop:verify` receipt proves the artefacts are being served; it cannot prove what a crawler did with them.
12. **The Critic view's register leaves its short columns empty.** The spatial gate's first run against the fifteen-route site reported 264 findings; the receipt re-recorded in this pass carries **170 findings across 11 decisions**, and **54 of them are the Critic's four-column register** — the number, the criticism, the attribution, and the registry's answer — where the answer is a paragraph and the other three are labels, so the labels leave 150–215px empty beneath them in a ~200px row. **This is not a new shape**: the same rule records the matchmaker's `span.mm-row-rank` 34 times, the `span.t-key` 19 times, the matchmaker's control group 18 times and the photo source 27 times, and every one of those decisions carries a written reason — the house position being that a register row's ragged bottom is the form, and is recorded rather than flagged. But it is three findings times four columns on one view, and the honest next step is to **recompose the Critic's row** so the answer sits *below* the claim, full width, the way the Atlas chapters do — which removes the four-way raggedness rather than accepting it. It was not done in this pass: the row is legible, the law's remedy for a register is a reason rather than a rewrite, and the change would have cost a re-measure and a second deploy of ninety-one documents. It is named here so it is not forgotten.
13. **The gate's receipt was stale.** The baseline that the gate checks against was recorded on 2026-10-27 — before the findability increment — so it described fourteen routes and a layout that no longer exists. A receipt of what the site *was*. It is now re-recorded: **645 measurements across 15 routes and 43 widths, taken from snapshots of the deployed build**, and the receipt carries **eleven** decisions with **eleven** reasons. The gate passes against it, and the falsifier confirms the gate still bites — 12 injected page defects, 14 broken-baseline cases and 1 case about the instrument itself, all caught, 8 of 8 modes.
14. **The gate could not run at all until this pass.** Its receipt was a number nobody could check, because the instrument that produced it could not open its own measuring page: a hand-spawned Chrome took the harness URL and never navigated to it, and the gate sat for twenty-three minutes measuring a blank page while printing nothing. That is repaired and documented above — the browser is now opened through Playwright — but the lesson outlives the bug: **an instrument that reports nothing is not an instrument that found nothing.** A gate that cannot see has to say it is blind, in the run, in the open.
