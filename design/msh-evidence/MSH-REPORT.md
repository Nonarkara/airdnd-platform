# MSH — Massacre Spatial Hallucination

**Site** — one³ OTOP registry (`otop.nonarkara.org`)
**Law** — the owner's design law, applied verbatim. `docs/MSH-LAW.md` is the canonical copy; this file is the evidence for this pass, not a second law.
**Date** — 2026-10-22, continued 2026-10-23
**Viewports** — 390 × 844, 1024 × 900, 1440 × 900
**Instruments** — `scripts/otop-msh-audit.mjs` (chrome cost, task visibility, hierarchy, overlap), `scripts/otop-empty-tracks.mjs` (uncovered rectangles inside grid containers), `scripts/otop-route-sweep.mjs` (every view renders), `scripts/spatial/spatial-check.mjs` (the vendored gate), `scripts/spatial/spatial-falsify.mjs` (the gate's self-test)

---

## Found

### Pass one — nine spatial failures

| # | Element | Viewport | Measured hole | Task cost |
|---|---|---|---|---|
| 1 | `nav.atlas-tabs` | 390 | 376px sticky column, **45% of an 844px viewport** | The reader lost half the phone to a chapter list before the first word of the chapter |
| 2 | `nav.atlas-tabs` | 1024, 1440 | 51 of 65px hidden behind `.hdr` | The chapter names were invisible while still charging 65px of screen; only a 3px amber sliver showed |
| 3 | `.t-stubs` (province measures) | 1440 | 660 × 102px = **67,000px²** | Two empty tracks beside the seventh measure, with a rule dangling into the void |
| 4 | `.t-stubs.dossier-face-cats` | 1440 | 444 × 102px = 45,000px² | Same failure, second instance |
| 5 | `.t-zones` | 1024 | 570 × 138px = **79,000px²**, black | The block's rule colour is the ink, so the empty tracks rendered as a black void in the middle of the page |
| 6 | `.meters` | 1024 / 1440 | 654 × 90px = 59,000px² / 866 × 86px | Seven signals in a grid that auto-fit its columns: the count chose the tracks and the last row was left empty |
| 7 | `.bank-shelf-strip` | 1024, 1440 | 330 × 48px = 16,000px² | Seven shelves in four columns; the last row held one shelf and three empty cells |
| 8 | `li.atlas-finding` | 1024, 1440 | 1,224 × 60px = **73,000px²** | The action link auto-placed into the narrow header column, stranding the width of the row beside it |
| 9 | `article.row.match-row` | 390 | 174 × 48px, twice | On a phone the score sat alone in a half-empty row, and the place cell sat alone in another |

### Pass two — five more, after the first nine were fixed

| # | Element | Viewport | Measured hole | Task cost |
|---|---|---|---|---|
| 10 | `li.find-row.has-phone` | 390 | 174 × 60px, six rows | The phone dropped below the name and left the right half of the row empty, so the digits no longer formed a column |
| 11 | `header.find-head` | 1024, 1440 | 768 × 36px / 1,170 × 36px | The stats ribbon overran the headline block by 36px, leaving a band of nothing under the lead paragraph |
| 12 | `div.method` | 1024, 1440 | 288 × 60px / 684 × 78px | The facts column ended 78px above the prose column, so the page's bottom-right corner was empty |
| 13 | `li.atlas-finding` | 1024, 1440 | 108 × 78px | The Thai name was a grid cell: the column under it was empty for the height of the row |
| 14 | `div.ch-cards` | 1440 | 324 × 438px = **142,000px²** | The champions grid's last row held 2 of 4 cards; the other two cells were void |

### Instrument defects found along the way

An instrument that cannot see is an instrument that says "clean":

- `firstAction` reported the skip link (parked at `left: -9999px`) on every page. Off-canvas is not an action.
- Chrome was only measured at rest. A sticky band that is harmless at scroll 0 ate 45% of the phone at scroll 600.
- The empty-track probe waited 1,000 ms and measured pages whose shards had not landed. The biggest hole on the site (`.meters` at 1440, 866 × 86px) was invisible to it for that reason.
- The probe read a container's padding and a grid's declared gap as empty space. Padding is a declared inset; a gap is declared spacing. Neither is a hole. **The row gap was being excluded but the column gap was not** — two ragged line ends, one above the other, were being counted as one 60px void.
- **The probe was measuring the wrong website.** Port 8080 was held by `open-webui`; the probe found zero grid containers in that stranger's splash page and printed *"no empty tracks found"*. A clean bill for a page that was never loaded. Both instruments now assert the page identifies itself as the one³ OTOP app before they measure, and the probe prints how many grid containers it actually saw. It also caught a stale preview server serving an empty document later in the same pass.

### Shipability failures found by the route sweep

Two views shipped **blank** to the live site. Both built. Both returned 200. Neither rendered a pixel.

| View | Cause | Symptom |
|---|---|---|
| Champions | A `useEffect` sat **below** an early `return` — the hook appeared and disappeared between renders | React error #310; `<div id="root">` empty once the first shard landed |
| Matchmaker | `loadIndex()` resolves to `{ index, meta }`; the view stored the envelope and mapped `index.provinces` | `Cannot read properties of undefined (reading 'map')`; blank from the first paint |

---

## Changed

| # | Repair | Spatial demand removed |
|---|---|---|
| 1 | The chapter strip is one horizontal band at every width, 54px tall on a phone, scrolling sideways when seven chapters cannot fit, with the active chapter scrolled into view | 376px → 54px of sticky column; **45% → 12%** of the phone's screen |
| 2 | The strip parks at `top: var(--hdr-h)` — the masthead's own height, one token, both bands agree | 51px of invisible chrome → 0 |
| 3 | The province's seven measures became a **register**: one measure per line, the value in its own column, the rank in the last | 67,000px² of empty tracks → 0 |
| 4 | The face's five categories became five columns — five divides by five and by one, so this grid can never hold an unused track | 45,000px² → 0 |
| 5 | Below 1100px the zones became a register: the number beside its name, the bar in a shared track so every bar is the same length | 79,000px² of black void → 0 |
| 6 | Seven signals became seven cells, so the count sets the tracks. Below 1200 the block becomes a register | 59,000px² → 0 |
| 7 | The bank's seven shelves became seven columns | 16,000px² → 0 |
| 8 | The finding's link sits under the prose, and the Thai header spans both rows | 73,000px² → 0 |
| 9 | On a phone the score, name, producer, place and contact each take the full width; the category and the stars share a row | 2 stranded cells → 0 |
| 10 | The phone keeps its own column at every width, and the row's declared row gap is excluded from the raster as declared spacing | 174 × 60px ragged ends → 0; the digits still line up down the page |
| 11 | The masthead's four measures read **one line each** — English then Thai, the way every other register on this site reads | 1,170 × 36px band → 0 |
| 12 | The legal note left the two-column grid and became a note below it, the way every other page-level note sits on this site | 684 × 78px tail → 7px |
| 13 | The Thai name became a **hanging marginal note**: it sits in the left margin and the prose wraps *under* it | 108 × 78px column → 0 |
| 14 | The Champions view: the photo-warming effect moved above the guard returns; the Matchmaker view unwraps `{ index, meta }` | 2 blank pages → 2 working views |
| 15 | The probe now excludes declared row gaps on both axes and asserts which app it measured | 2 false voids → 0; a clean bill for the wrong website → impossible |

**A bar of one length beside a bar of another lies.** The meters and the zones were rebuilt so that every bar shares one track length, and the meters' labels reserve two lines so the bars share a baseline. A 7% bar drawn across a full row reads as half of an 87.5% bar drawn across a column; that was fixed, not decorated.

**A label in a margin is not a grid cell.** The atlas finding was a two-column register, and the Thai name's column was empty for the height of the row. It is now a hanging note: the name sits in the margin and the prose wraps under it, so the space under the name is filled with the sentence it labels.

---

## Verified

**Measurements** — `scripts/otop-msh-audit.mjs`, 18 measurements across 6 views × 3 widths, on the shipped build:

```
find     @390  chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 30.4px  largest 30.4px x1  sideways=false
find     @1024 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 47.1px  largest 47.1px x1  sideways=false
find     @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 48px    largest 48px   x1  sideways=false
method   @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 44px    largest 44px   x1  sideways=false
atlas    @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 44px    largest 44px   x1  sideways=false
bank     @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 44px    largest 44px   x1  sideways=false
match    @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 44px    largest 44px   x1  sideways=false
province @1440 chrome 51px (6%)  scrolled 51px (6%)  firstAction 0px a.brand  on-screen  h1 44px    largest 88px   x1  sideways=false
```

- **Chrome cost** — 51px (6%) of the viewport at every width, on every view, before and after scrolling. Before this pass the atlas carried 376px (45%) on a phone and 65px (7%) of invisible chrome on a desktop.
- **Task visibility** — the masthead and its search or control is on the first screen at every width on every view. The province dossier's h1 ("Chiang Mai", 44px) and its object number ("TH-50", 88px) are both above the fold at 1024 and 1440; on a phone the number falls to 48px and the name to 28px, and the number remains the largest element on the page.
- **Geometry failures** — no sideways scroll on any view at any width. No sticky band overlaps another. **3 empty grid tracks remain**, all at the end of a list, and all written down below.
- **Hierarchy** — one dominant element per view: the h1 or the object number; the largest text is unique on every view (`largest … x1`) except where the province's specimen number is deliberately larger than the name.
- **Preservation** — every feature still works: the registry still streams 154,050 records, the Find search, the Match filters, the province shards, the certificate table, the atlas chapters and the data bank were all exercised in the browser; the chapter strip's tabs switch chapters and keep the active one in view; the meter bars still encode the same percentages.

**Instruments, on the shipped build**

| Instrument | Result |
|---|---|
| `otop-empty-tracks.mjs` | 4,105 grid containers inspected across 7 views × 3 widths → **3 findings**, all listed under Remaining |
| `otop-msh-audit.mjs` | 18 measurements → **0 flagged** |
| `otop-route-sweep.mjs` | 13 views → **13 render**, no React error, no empty root |
| `spatial:gate` | 168 measurements across 6 routes and 28 widths → **0 findings**; the baseline is byte-identical after the pass |
| `spatial:check` (falsifier) | 6 injected page defects and 6 broken-baseline cases → **all 12 caught**; the clean build passes |
| `npm run test:otop` | **152 / 152** pass |
| `npm test` | 246 / 248 pass — the two failures are `scraper_ai_governor` and `scraper_highwater`, which need `TELEGRAM_API_ID` / `TELEGRAM_API_HASH` in `.env` and are unrelated to this work |

**Screenshots** — `design/msh-evidence/after/` (every view at 390, 1024 and 1440, plus a scrolled capture of each), `design/msh-evidence/live/` (the same sweep against the deployed site), `design/msh-evidence/els/` (element-level captures of every block that was rebuilt).

**Live** — the deployed site, not the local build. `https://otop.nonarkara.org` → `otop.pages.dev`, bundle `assets/index-Ct3eaU8w.js`:

| Check | Result |
|---|---|
| `otop:verify` (the canonical live smoke test) | **all checks passed** — bundle matches the local dist, the three lazy chunks 200, all 13 published artefacts have the expected shape, the SPA fallback 200 |
| 28 routes and artefacts | 200 / 200 |
| `otop-route-sweep.mjs` against the live host | **13 / 13 views render** — Champions and Matchmaker included, both of which were blank before this pass |
| `otop-empty-tracks.mjs` against the live host | 4,105 grid containers → **3 findings**, the same three written down below |
| `otop-msh-audit.mjs` against the live host | 18 measurements → **0 flagged**, chrome 51px (6%) at every width |

**Gate** — `npm run spatial:gate`, the falsifier and the route sweep run in CI on every push.

---

## Remaining

1. **`nav.dossier-walk` — 528 × 48px at 1440, 324 × 48px at 1024.** The neighbouring-provinces nav sets the previous province to the left edge, the next to the right edge, and the one way out (Atlas) in the middle. The space between them is the distance between neighbours, and the arrows carry the direction; collapsing the three into a group would remove the metaphor and leave the same space at the right margin instead. **Written down, not repaired** — a stranger can check it: the left item points left, the right item points right, and the exit sits between them.

2. **`div.ch-cards` — 324 × 438px at 1440.** The champions grid holds 50 cards in four columns and the last row holds 2. The count is not fixed: every filter changes it, so no track count can divide it, and a masonry layout would break the ranking order the cards are read in. The void is at the *end* of the list, where the data ends — not inside it. **Written down, not repaired** — a stranger can check it: change any filter and the end-rag moves; no row in the middle is ever empty.

3. **The province specimen tag's lower margin** — the tag is 349px tall and its content ends at 250px. The tag shares a grid row with a seven-line register; the air is the label's bottom margin. It is whitespace inside a label, not an empty track, and the probe no longer reports it.

4. **The atlas findings run at roughly 125 characters a line.** The house measure is 45–75ch. These are register entries in a full-width table, not paragraphs, and narrowing them would put a 540px void in the right of every row — the trade the site already made for the Match and Find rows. **Written down, not repaired.**

5. **Independent review** — this pass is the agent's own reading of the law against its own work. The law's section 6 requires an independent review for visual work; the screenshots and the measurements in `design/msh-evidence/` are the receipt, but a second pair of eyes has not yet checked them.

6. **CI has not been observed running.** The workflow is committed and mirrors the local steps, but no GitHub Actions run has been watched end to end.
