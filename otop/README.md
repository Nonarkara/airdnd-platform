# one·tambon — OTOP registry intelligence

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
npm run otop:build      # ② normalise → resolve → aggregate      (PURE)
npm run otop:dev        # ③ develop at http://localhost:5180
npm run otop:site       # ③ build to dist-otop/
npm test                # unit tests, including the entity-resolution traps
```

`npm run otop:discover` lists what stage ① *would* pull without pulling it.

### The two stages are separate on purpose

**Stage ① is the only thing that touches the network.** It writes untouched CKAN
responses into `otop/data/raw/` and transforms nothing. That buys two things:

1. **Stage ② is reproducible.** Same files in, byte-identical output — so a
   reviewer can rerun it and get your numbers, and CI can build without reaching
   a government portal that is frequently slow or down.
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
otop.json · otop_meta.json · otop_insights.json
```

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
