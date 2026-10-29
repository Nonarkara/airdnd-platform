# one³ — OTOP registry intelligence

One Tambon · One Product · One Platform. Thailand's OTOP
registry read as data. Every record carries its source, its
completeness, and its age.

`otop.nonarkara.org` · Case study #2 of the community-intelligence platform.

Case study #1 (the wellness directory) mines *unstructured* community chatter and
its value is in structuring chaos. OTOP is the mirror image: the data is already
structured, already official, and already published — and it is stale, scattered
across agencies, duplicated, and thin. So the value here is not extraction. It is
**reconciliation, entity resolution, and honesty about condition**.

The two share an engine and nothing else — separate app, separate build, separate
deploy, separate audience.

---

## Run it

```bash
npm run otop:fetch      # ① pull raw CKAN data from data.go.th   (NETWORK)
npm run otop:build      # ② normalise → resolve → shard → aggregate  (PURE)
npm run otop:dev        # ③ develop at http://localhost:5180
npm run otop:site       # ③ build to dist-otop/
npm test                # the unit tests, including the resolution and scoring traps
```

`npm run otop:discover` lists what stage ① *would* pull without pulling it.

### Shipping it

```bash
npm run otop:ship       # card → build → prerender → deploy → verify the live host
```

`otop:ship` is the whole release in one command, and it is ordered so that
each step can only ship what the step before it proved:

| Step | Command | What it produces |
|---|---|---|
| the card | `npm run otop:og` | `otop/public/og/otop.png` — the 1200×630 image a share shows |
| the build | `npm run otop:site` | `dist-otop/` — the application and its data artefacts |
| the documents | `npm run otop:prerender` | one static HTML file per path, plus `sitemap.xml` and `robots.txt` |
| the deploy | wrangler | the live host |
| the proof | `npm run otop:verify` | 22 checks against the live host, not against the local build |

**The prerender is not optional.** The site is a single-page application, so
a crawler that does not run JavaScript receives an empty `<div id="root">` —
and most crawlers do not run JavaScript. The prerender writes each view out
as a document at the path it lives on, so `/history/` is a document on the
server rather than a route the client router invents. It also writes the
`sitemap.xml` and `robots.txt` that say what exists.

**The verification is against the live host.** `otop:verify` fetches the
deployed URL and checks fifteen things: that the bundle served is the bundle
last built here, that the lazy chunks resolve, that the published artefacts
have the right shape rather than merely a 200, that the SPA fallback still
catches deep links, that **every path is a document with its own title, its
own canonical address and its own structured data**, that the sitemap is XML
and the robots file is a robots file, and that the header's navigation is
anchors in the served HTML — because a crawler follows links and cannot press
buttons.

### The gates

```bash
npm run otop:routes      # every path renders its own view, and its text has no holes
npm run otop:preserve    # focus visibility, target sizes, text size, contrast
npm run otop:msh         # chrome cost, task visibility, hierarchy — at 390/1024/1440
npm run spatial:gate     # the spatial law, against a recorded baseline
npm run spatial:check    # the falsifier: proves the gate above can actually fail
```

All five take a base URL as their first argument, and all five refuse to
measure a page that is not this app — a probe that measures the wrong page
and reports "clean" is worse than no probe.

**One route register.** `scripts/otop/routes.mjs` is the single list of the
site's views, and it reads the paths from the application's own route table
(`otop/src/lib/routes.js`) rather than keeping a copy. Every instrument above
reads it. If the application grows a view and the register does not, the
register says so out loud and the run fails — because a gate that quietly
measures a subset of the site reports that subset as the whole of it.

Stage ① covers the **whole catalogue** — the "OTOP" search on data.go.th runs to
roughly 28 pages of datasets, and `package_search` is paged through to
exhaustion across three queries and three publishing organisations. It is
**resumable**: every resource already on disk is skipped, so an interrupted run
is resumed by running it again. Useful flags:

| Flag | Effect |
|---|---|
| `--concurrency 6` | in-flight requests, default 4 — be polite to a government portal |
| `--limit 20` | cap resources, for a smoke test |
| `--refetch` | ignore the cache and pull everything again |
| `--max-rows-per-resource N` | cap a single enormous resource |

### The two stages are separate on purpose

**Stage ① is the only thing that touches the network.** It writes untouched CKAN
responses into `otop/data/raw/` and transforms nothing. That buys two things:

1. **Stage ② is reproducible.** Same files in, the same output — so a
   reviewer can rerun it and get your numbers, and CI can build without
   reaching a government portal that is frequently slow or down.

   Two things move, and both are meant to:

   - the **build timestamp**, which is the receipt of when the numbers were
     computed;
   - the **certification split** (`certValid` / `certExpired`), which is
     computed *as of the build date*. A certificate that was valid last month
     and lapses today moves from one column to the other — the record count
     does not change, only the answer to "is it valid now?". That is the
     honest behaviour for a registry that claims to be current, and it is why
     the site prints the date its numbers are as of.

   Everything else — all 154,050 records, every province shard, every
   aggregate — is byte-identical between runs. The cache is read in sorted
   order for exactly this reason: an unsorted directory read makes the merge
   order, and therefore the bytes, depend on the filesystem's mood.
2. **The raw cache is an archive.** If a publisher deletes or silently rewrites a
   dataset, the version this project analysed still exists on disk, and the
   finding drawn from it is still defensible.

Raw payloads are gitignored (they get large); `manifest.json` is committed,
because it is the provenance record. `git add -f` a payload if you want a
specific vintage preserved in history.

> **data.go.th is unreachable from Claude Code's cloud sandbox** — the egress
> policy returns 403 on CONNECT for `*.go.th`. Stage ① must be run from your Mac
> or any network with access. Everything after it runs anywhere.

---

## What the pipeline does

```
data.go.th (CKAN 2.9)
  │  package_search × 3 queries + 3 publishing organisations
  │  keep packages matching OTOP / หนึ่งตำบล / ผลิตภัณฑ์ชุมชน
  ↓
per resource: datastore_search → else download the blob
  │  TIS-620 / windows-874 detection (Thai Excel exports are not UTF-8)
  │  RFC-4180 CSV parse, delimiter sniffing
  ↓
field DISCOVERY, not field assumption
  │  score every column against the alias dictionary in otop.config.json
  │  a resource with no name column or no area column is skipped LOUDLY
  ↓
canonical record
  │  province ← TIS-1099 code | Thai | romanisation | ISO | free-text address
  │  category ← declared code/name, else head-initial keyword inference
  │  stars ← OPC 1–5, with ไม่ผ่าน preserved as 0 (assessed) ≠ null (unrecorded)
  │  years  ← Buddhist and Common era both normalised to CE
  ↓
entity resolution by SIGNAL UNION (not a ranked key — see below)
  ↓
otop_index.json  ·  p/<provinceCode>.json × 77  ·  otop_meta.json  ·  otop_insights.json
```

### Published as province shards, always

A national pull is plausibly hundreds of thousands of records. A single
`otop.json` would be tens of megabytes — too slow for a static host and
impossible to filter in the browser. So records are published as one shard per
province behind a small `otop_index.json` that carries the national picture and
enough per-province detail for the matching engine to decide which shards are
worth fetching at all.

Sharding runs **at every scale, including the fixture**. A build that sharded
only when it happened to be large would ship a loading path nobody had ever
exercised until production. `otop.json` is still written as a convenience export
below 20,000 records, and is deleted rather than left stale above it; the app
never loads it.

`insights.js` reads the corpus back *out of the shards* and refuses to write if
the total disagrees with the index — so every build verifies its own output
rather than trusting two artefacts from the same pass to agree.

---

## Matching demand to supply

Two lenses over the same corpus, because the buyer's question differs.

**Source · B2B** — ranked for due diligence. Grading, cross-agency corroboration
and filing recency carry more weight, because the phone call is cheap and the
failed purchase order is not. Adds *sourcing basins*: provinces ranked by
**reachable** depth, answering the question a flat directory cannot — "where can
I meet six credible suppliers in one trip?" Ten unreachable listings in one
province are not a basin; three reachable ones are.

**Discover · B2C** — ranked for reach. Contactability dominates, because a
consumer who cannot reach the producer cannot buy anything at all.

The fit score is decomposed into five components — contactability, assurance,
freshness, corroboration, locatability — and every component is returned
alongside the score so the interface can show *why* a producer ranks where it
does. A ranking handed over without its reason is authority without argument.

The requirement round-trips through the URL, so a sourcing brief is a link.
Shortlists export to CSV.

### What the engine refuses to score

A buyer's real questions are: can they make what I need, in the quantity I need,
to the standard I need, by when? **The registry answers none of them.** It holds
no capacity, no minimum order quantity, no lead time, no food-safety, organic,
Halal or export certification, and no evidence a producer filed in 2020 is still
trading.

Inferring capacity from a star rating would invent the most consequential number
on the page. So the engine scores only what the registry attests, and every
result carries caveats naming what it could not assess — including *dynamic*
ones measured on that specific result set ("41% of these matches have no contact
of any kind recorded"). The output is an honest shortlist to go and verify, not
a supplier ranking.

### The map

Province circles on an OpenStreetMap base layer, positioned at each provincial
capital and sized by matching supply depth.

**Not producer pins.** The registry records no producer coordinates — not "some
are missing", none. Geocoding a hundred thousand Thai village addresses would
manufacture point-level precision the source never had, and a dropped pin reads
as a verified location. The province is the resolution the data supports, and it
is also the resolution a sourcing decision is made at: you choose a province to
visit, then a producer. The caption says so on the page.

---

## The two design decisions that matter

### 1. Identity is a union of signals, not a ranked key

The obvious design ranks the identifiers — tax ID beats phone beats name — and
keys each row on the strongest one it has. **That design is wrong**, and this
repository has already paid for it once: the wellness directory keyed venues on a
Google Maps link, which is locally unique but globally meaningless, and real
venues vanished for weeks (`tasks/lessons.md` · 2026-08-04).

The same trap here is a column like `PRODUCT_ID = "P-002"`. It is a row number
inside one agency's spreadsheet. Under a ranked key it *outranks* the telephone
number and blocks the genuine cross-agency match, so one producer becomes two and
the national count inflates. This was caught by the fixture during development
and is now pinned by a test.

So every record emits **every** signal it can support, and records sharing any
signal are unioned. This resolves transitively: A shares a tax ID with B, B
shares a phone with C, all three are one producer — which no ranked key can do.

Registration numbers are namespaced by dataset, so they may de-duplicate rows
*within* one agency's export and can never join across agencies.

### 2. The over-merge guard is administrative, not statistical

Union-find's failure mode is the opposite one: one shared contact number
swallowing the country. A district CDD office line printed on 200 producer rows
would collapse 200 real producers into a single record.

The guard: **a telephone number appearing in more than one province is a
switchboard, not an identity, and is withdrawn.** A tax ID is never withdrawn —
one legal entity can operate across provinces, and that is exactly the multi-site
producer we *want* merged.

Withdrawn signals are recorded per record in `withdrawnSignals`, so the decision
stays auditable.

---

## Honesty rules, enforced in code

| Rule | Where |
|---|---|
| A record with no provenance cannot be constructed | `buildRecord` throws |
| A missing province is `null`, never defaulted to Bangkok | `resolveProvince` |
| Rejected rows are counted and reported by reason, never silently dropped | `otop_meta.json.rejectReasons` |
| A resource that cannot be mapped is skipped **loudly**, with its columns printed | `build.js` |
| A fixture build is `degraded: true` with a reason, and the page says so | `otop_meta.json` → `ProvenanceBanner` |
| If the registry cannot load, the page shows **nothing** rather than a substitute | `lib/load.js` |
| `ไม่ผ่าน` (assessed, ungraded) is `0`; unrecorded is `null` | `parseStars` |
| Inferred categories are labelled as inferred in the table | `RecordRows` |

The sidecar-meta pattern is a direct consequence of `tasks/lessons.md` ·
2026-08-24: a fallback that changes the *shape* or *meaning* of data must declare
itself, because a silent one became the steady state for six days.

## The claim these numbers support

**They measure the registry, not the economy.** A province with an energetic
provincial office files more rows than a province with more producers and less
paperwork. Every aggregate is therefore framed as a property of the *record* —
completeness, vintage, cross-agency corroboration, concentration — and the
Method section on the page says so in as many words. Claims about production
volume are not supported by this data and are not made.

## Next

The registry is the spine. The **pulse** is the wellness project's live intake
layer pointed at OTOP seller channels — and the interesting finding is the delta
between them: which registrations are ghosts, and which thriving producers the
state has never recorded. That comparison is the paper; this is the instrument
that makes it measurable.
