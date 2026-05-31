# Sabai Sabai — Task List

Read this at the start of every session. Mark `- [x]` as work completes.

---

## Active

### Sabai Sabai 2.0 — "Intelligence Terminal" design overhaul (Dr Non's Claude Design handoff)

The user designed a warm-dark "intelligence terminal" in Claude Design and handed over the bundle. Mango `#FF6B3D` primary, Bricolage Grotesque + Hanken Grotesk + Instrument Serif + JetBrains Mono, film grain, editorial index rows, rounded radius. NOTE: this is Dr Non's own authored direction — it intentionally supersedes the prior zero-radius/amber house defaults for THIS project. Source: `/tool-results/design_extract/airdnd-sabai-sabai/`.

- [x] **Foundation** — port `ds.css` into `src/index.css` with backward-compat token aliases (old `--color-*` names → new warm-dark values) so all 40+ existing components inherit the palette/fonts/radius. Add new component classes (.btn .panel .kpi .barlist .lcard .index-row .topbar .site-header .gauge) + grain overlay.
- [x] **Header** — rebuild to topbar ticker + brand mark + nav + status pill + actions.
- [x] **Hero** — rebuild as "What operators post. Where they are. *What it means.*" with cumulative-growth chart card, wired to real metrics. Render it at top of directory view.
- [x] **CompanionCard** — rebuild to `.lcard` professional card (photo cover, name, area, rating, badges, price, source chip).
- [x] **Map coverage fix** — every listing gets a pin: fall back lat/lng → AREA pattern → city centroid → Bangkok centroid+offset. Fixes "map shows 1/100".
- [ ] **Overview landing page** — full hub (KPI strip, supply-by-district barlist, service-mix donut, supply-density map, live-intake feed, newest-in-index rows). Currently hero is injected into directory; build the standalone Overview route next.
- [ ] **Listing Detail page** — gallery grid, services/pricing table, location map, sticky contact sidecard, provenance panel (new design `Listing Detail.html`).
- [ ] **Analytics deep-dive** — port the new Analytics charts (price histogram, median-by-service, channel activity, intake-velocity stacked bars, photo-match gauge, pipeline funnel) + add the **proximity+budget finder**: "near Soi Ladprao 10, 1hr, <1000 THB" → nearest matches. Needs listing lat/lng + duration/price parse.
- [ ] **Real geocoding** — verify each listing's address against Google Maps coordinates and store lat/lng so the map is precise, not approximate. Backfill via `scripts/` geocoder.

- [ ] **Replace `node-telegram-bot-api` with `grammy` or `telegraf`** — eliminates the last 6 moderate CVEs (qs, uuid in the `@cypress/request` chain). `node-telegram-bot-api` is effectively unmaintained for this dep chain. `grammy` is the modern replacement. Affects: `scripts/telegram_bot.js`, `scripts/telegram_scraper.js`.

- [x] **Lazy-load Analytics route** — Already done. `App.jsx:41` has `const Analytics = lazy(() => import('./components/Analytics'))`. The 508KB main bundle is React+router+eagerly-loaded components; gzip is 156KB (acceptable). Vite warning threshold is just set too low for a modern React app.

- [ ] **Verify Supabase migrations applied to production** — `a521b59` added 4 migrations (`20260429_data_integrity_reset.sql`, `20260430_phone_dedup_uniqueness.sql`, `20260501_signals.sql`, `20260501_visitor_geo_fields.sql`). Confirm these ran against the live Supabase project, not just local schema. Run: `npx supabase db remote status`.

- [ ] **Classify and clean untracked files** — these sit in the working tree and pollute `git status`:
  - `AGENTS.md` — Codex-format mirror of CLAUDE.md. Commit if Codex is part of the workflow; delete if not.
  - `offline-packages/`, `restore_offline.sh`, `requirements_clean.txt`, `requirements_master.txt` — offline AI setup artifacts. Probably not part of this repo; consider moving to `Projects/_toolkit/offline-ai/`.
  - `research/`, `scripts/research/` — analysis scripts. Keep or move.
  - `PHASE_2_SUMMARY.md` — Kimi's scratch doc. Delete.

- [ ] **Drop stale git stash** — `git stash drop` to remove "runtime regens during deploy session" stash from May 24.

---

## Backlog

- [ ] **Expand test coverage** — `test/listing_contract.test.js` has 244 lines covering `listing_contract.js`. No tests for: `telegram_scraper.js`, `listing_pipeline.js`, dedup logic, geocoder cache. Add smoke tests for the pipeline.

- [ ] **Analytics.jsx decomposition** — 1,784 lines is too large for one file even after lazy-loading. Break into: `AnalyticsDashboard.jsx` (shell), `ChannelChart.jsx`, `PowerLawChart.jsx`, `TrendInsights.jsx`, `HeatmapGrid.jsx`. Each stays under 300 lines.

- [ ] **Bundle code-splitting** — after lazy-loading Analytics, run a proper `vite-bundle-visualizer` pass to find the next largest contributors in the 508KB main chunk.

- [ ] **Monitoring / alerting** — the scraper daemon runs via `launchd` but has no external health check. Add a `/health` endpoint to `server.js` and wire it to UptimeRobot (free tier). The `_reference/monitoring-urls.md` in the workspace is where this URL belongs.

---

## Completed

- [x] Design overhaul — Dieter Rams aesthetic, Space Grotesk / Inter / Space Mono, Sabai Sabai 2.0 (`640c345`)
- [x] gitignore tightened — tmp/, test-results/, scratch/, scraper state (`55a87a3`)
- [x] Geocoding hardened — Gemini retry logic, geocoder cache, isGoogleMapsUrl validation (`a521b59`)
- [x] Security: 3 critical + 5 high Vite CVEs patched; 2 critical form-data CVEs patched via overrides (`a190977`)
- [x] `tasks/` created — this file + `lessons.md` (`this commit`)
