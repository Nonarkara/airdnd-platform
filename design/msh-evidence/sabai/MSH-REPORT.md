# MSH — Massacre Spatial Hallucination · Sabai Sabai

**Site** — Sabai Sabai (`sabaisabai-airdnd.pages.dev`), the community-intelligence directory.
**Law** — the owner's design law, as applied to one³ in `../MSH-REPORT.md`. Same instruments and thresholds: a 45–75 character line, a heading of at most five lines, no empty grid track, chrome and first action measured on the first screen. A finding is either fixed or written down with a reason.
**Date** — 2026-10-27.
**Viewports** — 390 × 844, 1024 × 900, 1440 × 900.
**Instruments** — the one³ instruments, made site-aware rather than forked. `scripts/msh/sites.mjs` holds each site's identity, routes and reader tasks, selected with `MSH_SITE=sabai`; `MSH_OFFLINE=1` refuses off-machine requests so a sandbox page settles. Default behaviour (one³) is unchanged and was re-verified (below).

```
MSH_SITE=sabai MSH_OFFLINE=1 node scripts/otop-route-sweep.mjs  http://localhost:4173
MSH_SITE=sabai MSH_OFFLINE=1 node scripts/otop-measure.mjs      http://localhost:4173 1440 --selftest
MSH_SITE=sabai MSH_OFFLINE=1 node scripts/otop-empty-tracks.mjs http://localhost:4173
MSH_SITE=sabai MSH_OFFLINE=1 node scripts/otop-msh-audit.mjs    http://localhost:4173
```

---

## Found → fixed

| Instrument | Before | After |
|---|---|---|
| Line measure (1440) | **183** blocks over 75 characters, worst **200** | **0** at 390, 1024 and 1440 |
| Hole probe | **62** empty tracks | **0** across 1,126 grid containers |
| Route sweep | 2 routes with no `h1` (`/map`, `/places`) | **13/13** render, each with its own `h1` |
| First-screen audit | 6 flagged (an instrument defect, below) | **0** of 18 flagged; chrome 10–15% of the first screen |
| Hierarchy | text larger than the page title on `/analytics` (4 figures) and `/` at 1024 | nothing larger than the `h1` on any main page at any width |

### The measure

One house token, the same as one³: `--read: 32em` (about 65 Latin characters), applied to running text (`p`, `li`, `blockquote`, `figcaption`, `dd`) in `src/index.css`. Where a paragraph is a grid item, the column carries the measure rather than the paragraph (`.meth-tier`), because a capped paragraph in a wider track is a hole.

### The holes

| Where | What it was | What it is now |
|---|---|---|
| Analytics upgrade panels | 4 panels in 3 columns: the fourth alone beside a **924 × 612px** void | 2 × 2 |
| Analytics card grid | single cards stranded beside full-width ones | `dense` flow; an odd last half-width card takes the row (counted with `:nth-child(… of :not(.an-wide))`) |
| Charts, venue cards | auto-fit grids kept the column count on the last row (**1,062 × 270px**, **324 × 378px**) | wrapping rows; the last cards share the width; the venue collage keeps its height |
| Insights cards | 3 cards in 2 columns | the third takes the row |
| Footer, every page | edge to edge with no gutter (clipping "Verified snapshot"); a short brand column beside the disclaimer (**522 × 72px**) | the page column; brand over data source, beside the disclaimer |
| Methodology sections | the section number owned a 4rem column, empty below it for up to **1,686px** per section | the number labels the heading from above |
| Methodology resources | tag and link at the far right with a void beneath them | under the description |
| Hour heatmap | drew only the 16 hours that had posts in a 24-column strip | all 24 hours, zero-filled — the quiet hours are the finding |
| Corpus notes | three one-line notes in a box stretched to a bar chart's height | a row of three under the chart |
| Filter bar at 1024 | 5 fields in 3 columns | the last field takes the remaining cells |
| Home hero at 1024 | stats panel shorter than the copy | stretches to the copy |
| Live feed, photo-less posts | a 4:3 photo slot holding one letter — **230px** per card | a 52px band with the initial |

### Hallucinations — content, not geometry

Removed from the public site because each presented invented or simulated data as fact:

- **`/intel` — "Live Industry Telemetry & Field Radar".** Every line was hard-coded in `scripts/build_industry_intel.js`: "16 sources monitored", "ThaiNuru.com · 340 venues · daily scrape · ONLINE · trust 88", "+12%" keyword velocity, and "live" wire items whose timestamps were the moment the script ran. Retired; the route redirects to `/analytics`; it is gone from the nav.
- **`/trends`** — six Gemini-written "signals" with post counts on LINE, Facebook and WeChat, platforms this system never reads. Retired; redirects to `/insights`.
- **"Municipal Zoning" map overlay** — simulated districts drawn on a map of real places. Removed. (Public Works already labels the same data illustrative and keeps it out of its counts.) The transit stations stay: their coordinates match the stations.
- **Analytics "Macro-Economy Context"** — simulated provincial GDP and wages presented as fact, divided into one national average price. Removed.
- **"0.2% of raw messages carry media"** — divided the feed snapshot's photo cards by the whole archive. Replaced by archived photos per listing, which the data supports.

The generators (`build_industry_intel.js`, `trends_sync.js`, `build_economy_data.js`) are removed with their output; all are in git history.

### Structure

- Analytics, Method and Public Works rendered without the site header: clicking them in the nav made the nav disappear. Every nav destination now carries the header and footer.
- Footer links pointed at `#map`, `#workflow`, `#live-listings`, anchors present on only some pages; they are routes now.
- Map and Places titles are the page `h1`.

---

## Instrument defects found and fixed

A gate that measures wrongly says "clean" or cries wolf; both were found.

1. **The ruler split letter-spaced words into one-word lines.** Its word-gap tolerance used the block's font, so a tracked eyebrow (2.2px) inside the paper masthead set every word as its own "line" — and a 625px block of one-word lines read as a ribbon. The tolerance is now the word's own font size plus the tracking on both sides of the space. `--selftest` still bites 3/3 at every width, on Sabai and on one³.
2. **The hole probe compared the wrong neighbours.** It marked the gap between consecutive items of one left-sorted list, which in a 2 × 2 grid compares the top-left card with the bottom-left one; the column gap between two whole, correctly placed cards was reported as a void (Paper plates 18 × 630px, Analytics cards 12 × 1,020px). Each item now pairs with its nearest right-hand neighbour in its own rows. Run against untouched `main`, the fixed probe drops exactly those three artefacts and keeps all 59 real holes.
3. **The first-screen audit counted a background as chrome.** A fixed layer painted behind the page (`.app-backdrop`, z-index −2) was reported as a 100% band and as hiding the header above it — while a real click on the nav worked. Layers behind the page are not chrome, and a band hides another only if it is painted above it.
4. **The ruler overwrote one³'s receipt.** Its output path was fixed to `design/msh-evidence/`; any site but one³ now writes under its own folder.

## one³, re-verified

With the shared instruments changed, one³ was built and measured in default mode: route sweep **14/14**, ruler self-test **3/3**, nothing over the ceiling at 1440. Its receipts were not rewritten.

## Not measured here

Map tiles, photos and anything else served from outside the machine — the sandbox cannot reach them, and the instruments refuse those requests on purpose. The geometry measured is the page's own. Screenshots are not committed for the same reason: offline, they would show blank tiles and placeholder photos that the live site does not have.
