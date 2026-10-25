# MSH — Massacre Spatial Hallucination

**Site** — one³ (`otop.nonarkara.org` / `otop.pages.dev`) — Thailand's soft-power monitor, of which the OTOP registry is one instrument.
**Law** — the owner's design law, applied verbatim. `docs/MSH-LAW.md` is the canonical copy; this file is the evidence for this pass, not a second law.
**Pass** — three: the long-line massacre, the thirteen holes my own recompositions opened, and the three failures found on the last sweep. Deployed and verified against production on 2026-10-24 (`0b2c6ed`, plus the identity fix `095b27c`).
**Date** — 2026-10-22, continued 2026-10-23, closed 2026-10-24.
**Live site** — `https://otop.nonarkara.org` — serving `assets/index-BEF3pjr9.js`, the export of commit `0b2c6ed`.
**Viewports** — 390 × 844, 1024 × 900, 1440 × 900.
**Instruments** — `scripts/otop-measure.mjs` (the line ruler, with `--selftest`), `scripts/otop-empty-tracks.mjs` (uncovered rectangles inside grid containers), `scripts/otop-route-sweep.mjs` (every route renders), `scripts/spatial/spatial-check.mjs` (the vendored gate), `scripts/spatial/spatial-falsify.mjs` (the gate's self-test), `scripts/otop-msh-audit.mjs` (chrome cost, task visibility, hierarchy).

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

### Instrument defects found along the way

An instrument that cannot see is an instrument that says "clean". Eight of these were mine.

1. **The ruler merged multi-column blocks into one fake line.** The method page's provenance band and the story's prose measured a 1,301px "line" that does not exist. A word now joins the line whose own horizontal extent contains it, and a word that starts past every line's end opens a new one.
2. **The hole probe mis-derived column gaps.** `auto-fit` collapses its empty tracks and takes their gaps with them; `space-between` spreads free space far wider than the declared gap. Both produced false holes. The gap band is now measured *between adjacent items' boxes*, on the horizontal axis only — a short cell beside a tall one leaves its void below it, in its own column, and that must stay visible.
3. **The ribbon detector was blind.** At 390px the champion cards rendered 81px wide and 1,961px tall — fifty cards of vertical letter-ribbons — because a `useEffect` never re-ran after the data load. The ruler gained a ribbon detector.
4. **The ribbon detector then cried wolf.** It tested the *narrowest* line, and a paragraph's last line is always short. It now tests the widest line: a ribbon is narrow on *every* line.
5. **The ruler had no rule for a heading that is a wall.** This is failure 15 above: every line under the ceiling, and a 2,976px heading. A heading is a label; more than five lines of it is a body wearing a heading's clothes.
6. **The ruler's rules had never been seen to fail.** So `--selftest` was added: each rule is tested against the defect it exists to catch, injected into the real page and measured by the same code that measures the site. A rule that does not bite fails the run.
7. **Three of the spatial gate's falsifier rules could not bite.** They tested the baseline by breaking a *recorded hole* — and the baseline records no holes, because the page has none. They found nothing to regress, reported themselves dead, and proved nothing. They now create their own hole: mount the fixture, have the gate measure it, write the measurement into the receipt, and only then doctor the receipt.
8. **The hole probe warned that healthy pages had not rendered.** It used the grid count as a proxy for "the page arrived"; the atlas page has two grids, and that is what the atlas *is*. It now checks the page's element count, and reports the grid count as what there was to measure.

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

---

## Verified

| Gate | Result |
|---|---|
| Line measure, 1440 / 1024 / 390 | **Nothing over the ceiling** at all three widths — 1,671 text blocks at 1440 including 81 in the soft-power view |
| Ruler self-test, all three widths | **3/3 rules bite** — a heading wall (80 lines), a 39px ribbon, a 160-lre line. A rule that does not bite fails the run |
| Hole probe, 7 routes × 3 widths | **No empty tracks across 4,584 grid containers** |
| Route sweep | **All 14 routes rendered**, each with its h1 |
| Spatial gate | 168 measurements across 6 routes and 28 widths — every hole, orphan, scattered pair and wrap either fixed or written down |
| Spatial falsifier | **23/23 caught** — 10 injected page defects, 12 broken-baseline cases, 1 case about the instrument itself; 8 of 8 failure modes |
| `npm run test:otop` | **154/154 pass** (152 before, plus 2 new caption tests) |
| `npm test` | **248/250** — the two failures are `scraper_ai_governor` and `scraper_highwater`, which need `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` in `.env`; they are unrelated to this pass and were failing before it |

### The same gates, run against the live site

The preview server is where the work was done, but a receipt about a live site has to be a receipt about the live site. After the deploy, every instrument was pointed at `https://otop.nonarkara.org`:

| Gate, against production | Result |
|---|---|
| `otop:verify` | **All checks passed** — and the live bundle hash (`assets/index-BEF3pjr9.js`) **matches the export byte for byte**, so the site is serving the commit, not yesterday's |
| Line measure, 1440 | **Nothing over the ceiling**, measured on the live site |
| Line measure, 390 | **Nothing over the ceiling**, measured on the live site |
| Hole probe, 7 routes × 390 / 1024 / 1440 | **No empty tracks across 4,584 grid containers**, measured on the live site |
| Route sweep | **All 14 routes rendered** — including `softpower`, whose h1 is *"Thailand's soft power, measured on the supply side."* |
| `soft_power.json` | 26,302 bytes served; **7 tools, all measured** — otop · handicraft · local-food · film-heritage · exports · fisheries · labour |
| Document title | `one³ — Thailand's soft-power monitor` |

The 1024 line measure was run against the preview, on the **same bytes** production serves — the live bundle hash matches the export exactly — but it did not complete against production itself: two attempts failed on navigation timeouts against the live host. It is recorded here as the preview measurement it was, not as a live one.

Live screenshots are in `design/msh-evidence/live/` — `find-1440`, `find-390`, `softpower-1440`, `softpower-390`, `province-1440`, `method-1440`.

**One instrument defect this exposed.** The live sweep failed all 14 routes with *"REFUSING TO MEASURE"* — against a site serving exactly the right bundle. The identity assertion keyed on `OTOP_TITLE = "OTOP registry intelligence"`, a marketing phrase that changed when the platform became the soft-power monitor. A gate that breaks whenever the copy changes is a gate that gets "fixed" by weakening it, so the assertion now checks the thing that does not change: the wordmark. The title must **begin with `one³`**, which still rejects another process holding the port. (`095b27c`.)

---

## Remaining

1. **Independent review has not happened.** MSH law §6 requires it for visual work. Every figure above is my own measurement of my own work, with the instruments I wrote or repaired. A second pair of eyes on the screenshots is still owed.
2. **CI cannot run.** GitHub refuses to start the job — *"The job was not started because an Actions budget is preventing further use."* Every gate in the table above was therefore run locally against the preview server. The CI workflow itself is unverified and will stay unverified until the budget allows it.
3. **The Commons article is no longer in the panel.** Failure 15 was fixed by moving 4,819 characters of article body to where it belongs — the source page. A reader who wanted the article body in the dossier will not find it there. That is a deliberate trade, and it is the only place on this site where content was removed rather than recomposed.
4. **The exports figure is not the customs total.** It is the value declared on certificates of origin, which is what the register publishes. The view states this; anyone quoting the number must quote it as declared, not as exports.
5. **The soft-power monitor measures the supply side only.** Six registers of what the state and the market have already certified. It does not measure soft power as received — reception, perception and influence are not in any of these datasets, and the frame says so.
6. **The wordmark was left alone.** `one³` still means One Tambon · One Product · One Platform. The monitor is what the platform now does; putting the platform's description into the mark would make the mark a slogan. The expansion lives once, in the footer, and the monitor's frame names the relationship. *If the owner wants the mark to widen, that is a naming decision, not a layout one — it should be made deliberately, in one place.*
