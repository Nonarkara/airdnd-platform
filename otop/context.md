# one³ — OTOP registry intelligence · context

Case study #2 of the community-intelligence platform. `otop.nonarkara.org`.
Case study #1 mines unstructured chatter; OTOP is the mirror: data already
structured, official, published — and stale, scattered, duplicated, thin.
The value here is **reconciliation, entity resolution, and honesty about
condition**. Separate app, build, deploy, audience from #1. Full runbook:
`otop/README.md`.

## Pipeline (2 stages, never mixed)

```
npm run otop:fetch   # ① network — CKAN 2.9 on data.go.th → otop/data/raw/ (resumable)
npm run otop:build   # ② pure — cache → records → merge → shards + aggregates (reproducible)
npm run otop:dev     # ③ localhost:5180 · npm run otop:site → dist-otop/ → otop.pages.dev
```

`otop:build` = `build.js` (orchestrator) + `standards` + `revenue` +
`insights` + `champions` + `anchors` + `graph` + `briefs` + `province-faces` +
`datasets` (Data Bank inventory → `otop_datasets.json`).
`build.js` itself is split: `scripts/otop/build/` holds `read_cache`,
`process_resources`, `certificate`, `tambon`, `shards`, `index`, `meta`.
`npm run otop:verify` smoke-tests the live deploy (15 checks).

## Non-negotiable laws (each earned by a shipped failure)

- **Degraded sidecar.** A fixture build is `degraded: true` with a plain-words
  reason in `otop_meta.json`; the frontend reads the sidecar. Never present
  fixture rows as national open data.
- **No silent substitution.** A failed shard load clears the previous
  province's rows — never show old records under a new heading. Nothing shown
  beats something substituted.
- **Shard at every scale, including fixture.** Same load path in dev and prod.
- **Provenance on every record.** Merged entities keep every attesting source;
  cross-agency agreement is measured, not assumed.
- **Counts measure the registry, not the economy.** Filing volume tracks
  office energy, not production.
- **Identity, ranked.** tax ID > phone > source-scoped registration >
  name-in-area. A phone spanning 2+ provinces is a switchboard: withdrawn.
  Tax ID is never withdrawn. Registration numbers never merge across datasets.
- **Quality gate returns reasons** (`no_name`, `no_area`, …), never a silent drop.

## Frontend shell (`otop/src/App.jsx`, ~656 lines)

State + routing + view shells only. Leaves live elsewhere: 15+ components in
`components/` (Atlas, ProvinceDossier, Briefs, ProvinceMap lazy-split),
`lib/` holds `shards`, `insights`, `requirement` (URL round-trip),
`completeness` (condition-of-record rollup); `components/Bi.jsx` holds the
bilingual chip + hero gauge. Every tab opens with a `ViewHero` (the question,
the striking fact, the stake) reusing sec-h/sec-t/sec-n — zero new CSS.
Views: match, atlas, province, matchmaker, briefs, tides, champions, story
(+ public-voices chapter: producer pain, airport curation, tourist love,
discovery gap, grade trust — all sourced), history, crossrefs, **bank**
(Data Bank: 726 datasets on 7 shelves, 1/3 list + 2/3 detail).
Bilingual EN/TH throughout; `lang="th"` on Thai spans (screen-reader
pronunciation). One wordmark per viewport (header = nav + status only).
Shared province links open phone-first on the dossier. Design tokens:
workspace `AGENTS.md` §3 (one amber accent, zero radius/gradient/shadow);
this file adds project fact, never loosens that law.

## Data (national pull, reconciled)

154,050 producers · 77 provinces · ~1M raw rows (64% dedup) · 68.7%
corroborated · 11.2% certified · 74.8% unclassified. Per-tap headlines:
producer listings (5.7% contactable; 7,089 hidden champions); standards
(textile 125.7 products/standard vs beverage 6.0); revenue (Bangkok reports
zero; 4.7% median table gap); certification (5 buyer-ready); geography
(7,383/7,436 tambons covered).

## Working state (2026-09-20)

- Guardrails: 34 core tests (`test/otop_core.test.js`: over-merge, ranked-key
  trap, provenance, grade rejects) + 151 total, all green.
- **Perf fix (21a286d):** default-view payload 2.7 MB → ~547 KB. Served
  `otop_meta.json` is 1.2 KB (per-resource reports live in
  `otop/data/meta-resources.json`, build-time only); `otop_insights.json` no
  longer inlines the 1,489-standard list (`otop_standards.json` is the one
  copy; ProvinceDossier + Champions fetch it on demand). Dead `lib/load.js`
  deleted.
- `test/heartbeat.test.js` removed (Supabase-env contamination of OTOP suite).
- Known, not introduced today: 2 pre-existing eslint `react-hooks/refs`
  errors in `App.jsx` state init; `npm audit` transitives (brace-expansion,
  ip-address highs via tooling; `node-telegram-bot-api` → grammy migration
  already tracked in root `tasks/todo.md`).
- Stashes on `fix/timezone-and-silent-alerting` and
  `cursor/public-works-economy-map` belong to other branches — do not touch.
- Live deploy: `otop.pages.dev` via `npm run otop:ship` (site → wrangler →
  verify). Done = on the live URL, not in `dist-otop/`.
