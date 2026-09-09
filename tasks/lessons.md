# Sabai Sabai — Lessons Log

Read at the start of every session. The same mistake never happens twice.

---

## 2026-09-08 · A scoring band that ties two different states is a silent mis-ranking

- **What went wrong:** The OTOP fit score mapped OPC stars linearly to `stars / 5`. A verified 1-star producer then scored **0.2** — exactly the same as a producer that had *never been assessed*, which was also 0.2. Three genuinely different states (assessed-and-failed, never-assessed, assessed-and-passed) collapsed into two, and a buyer sorting by fit could not distinguish "graded lowest" from "no evidence either way".
- **Correct behaviour:** Decide the ordering *first*, then design the band to enforce it strictly. Here: `failure (0.1) < unknown (0.2) < any pass (0.44…1.0)`, achieved by banding passes above the unknown value (`0.3 + stars/5 * 0.7`) rather than letting them start from zero. A recorded pass is stronger evidence than no evidence; no evidence is better than a recorded failure.
- **How to recognise:** any scoring function that maps a nullable graded field with a bare ratio. Write the ordering as a test (`failed < unknown < lowest pass`) before writing the formula — that test is what caught this, and a plausible-looking formula is exactly the kind of thing that never gets checked otherwise.

## 2026-09-08 · Feeding a map the filtered set drew an empty map above a full table

- **What went wrong:** The supply map was passed `sourcingBasins(matches)`, which defaults to `minDepth: 2`. At any scale where matching producers are spread one-per-province, that returns an empty array — so the map rendered blank while six matching producers sat in the table directly below it. A reader would reasonably conclude there was no supply anywhere, which is the opposite of the truth.
- **Correct behaviour:** the map answers "where is there any matching supply?" and the basin cards answer "where is it deep enough to source from". Two different questions over the same rollup: `minDepth: 1, top: 77` for the map, the default for the cards. Also: an empty state must say what IS true ("6 provinces hold matching producers, but none holds two or more") rather than only what is absent — "no basins" next to a populated table reads as "no supply".
- **How to recognise:** any visualisation fed the output of a *filtered* aggregate rather than the full one. Check the empty case against the non-empty component beside it: if they disagree about whether anything exists, the visualisation is being fed the wrong set.

## 2026-09-08 · Shard at every scale, or ship a load path that was never exercised

- **What went right:** The published OTOP data is sharded one file per province behind a small index — and the sharding runs at fixture scale (6 records) exactly as it will at national scale. The alternative, sharding only above some record threshold, would mean the production load path never runs in development until the day it matters.
- **Also:** the aggregate step reads the corpus back *out of the shards* and refuses to write if the total disagrees with the index. Two artefacts written by the same pass agreeing with each other proves nothing; reading one back through the path the browser will use is what actually verifies it. Deliberately corrupting a shard to confirm the check fires took ten seconds and is the only reason it is known to work.
- **The rule:** a code path that only activates above a data threshold is untested by construction. Make the threshold change the *volume*, never the *path*.

## 2026-09-08 · Draw the resolution the data has, not the one the reader wants

- **The decision:** the OTOP registry records **no producer coordinates at all**. The tempting move is to geocode a hundred thousand Thai village addresses and drop pins. A pin is read as a verified location; these would be inferred to a precision the source never had, and wrong pins on a sourcing map cost a buyer a wasted trip.
- **What was drawn instead:** one circle per province at the provincial capital, sized by matching supply depth, with a caption stating plainly that circles represent provinces and not producer locations. This is the resolution the data supports — and it happens to be the resolution a sourcing decision is actually made at: choose a province to visit, then a producer.
- **The rule this generalises to:** when a visualisation implies more precision than the source carries, change the mark, not the caveat. A footnote does not undo a pin.

---

## 2026-09-08 · A ranked identity key is a trap; entity resolution needs a union of signals

- **What went wrong:** The OTOP ingest first keyed each record on its strongest available identifier (tax ID → registration number → phone → name+area). One agency's export carried `PRODUCT_ID = "P-002"` — a row number inside that single spreadsheet — which outranked the telephone number and *blocked* the genuine cross-agency match. The same producer appeared twice and the national count inflated. This is the 2026-08-04 Maps-vs-phone bug in a new costume: a locally-unique identifier is not a global identity, and ranking it above a weaker-but-portable signal loses records.
- **Correct behaviour:** Every record emits **every** identity signal it can support; records sharing any signal are unioned (disjoint-set). This resolves transitively — A shares a tax ID with B, B shares a phone with C, all three are one entity — which no ranked key can do. Source-local identifiers are namespaced by dataset (`reg:<datasetId>:<id>`) so they de-duplicate within one export and can never join across agencies. `otop/core/record.js`.
- **The opposite failure, and its guard:** Union-find's own failure mode is one shared contact number swallowing the country — a district office line on 200 rows collapses 200 producers into one. The guard must be *administrative, not statistical*: a phone appearing in **more than one province** is a switchboard, not an identity, and is withdrawn. A tax ID is never withdrawn — one legal entity legitimately spans provinces. Withdrawn signals are recorded per record so the decision stays auditable.
- **How to recognise:** merged-record count barely below accepted-row count while obvious cross-source duplicates survive (ranked-key failure); or one record with an absurd `mergedFrom` spanning many provinces (over-merge). Test the *basis*: report which signal joined each group, and never report a singleton's strongest available signal as if it were a merge basis — that inflates apparent corroboration.

## 2026-09-08 · Thai government CSVs are frequently not UTF-8, and the failure is silent

- **What went wrong (anticipated, guarded before it shipped):** Excel on a Thai Windows locale writes TIS-620 / windows-874. A naive UTF-8 decode turns every Thai column *header* into replacement characters, so field discovery matches nothing and the ingest reports "0 usable rows" for a perfectly good file — indistinguishable from a file that was never fetched.
- **Correct behaviour:** Decode by evidence, not assumption. Strip the BOM, try UTF-8, and fall back to TIS-620 when the UTF-8 result carries replacement characters *and* the buffer has bytes in 0xA1–0xFB. The whole Thai block maps with one constant offset (+0x0D60), so the decoder is ~10 lines and needs no dependency. Report the encoding actually used in the build manifest. `otop/core/text_decode.js`.
- **The off-by-one that hid it:** the fallback originally required `thaiChars > replacementChars`. A buffer that is *entirely* Thai produces exactly as many of one as the other, so the purest case failed the test. Use `>=`.
- **How to recognise:** a resource whose row count is healthy but whose mapped-field count is zero; or column names rendering as `??????` in the manifest.

## 2026-09-08 · Separate the network stage from the transform stage

- **What went right:** `data.go.th` is 403-blocked by the sandbox egress policy, which would have blocked the whole OTOP build if fetching and transforming were one script. Splitting them — `otop:fetch` writes an untouched raw cache, `otop:build` is a pure function of files on disk — meant only the first stage was blocked, and everything downstream was developed, tested and rendered against a labelled fixture.
- **Why it is right independent of the block:** stage 2 becomes reproducible (same files in, byte-identical out) so a reviewer can rerun and get the same numbers; CI never has to reach a government portal; and the raw cache is an *archive* — if a publisher silently rewrites a dataset, the version analysed still exists and the finding stays defensible.
- **The rule this generalises to:** never let a network dependency sit in the middle of a transform. Fetch to disk, transform from disk.

---

## 2026-08-04 · Maps-first identity undercounted the parlour inventory

- **What went wrong:** `buildCanonicalKey` preferred Google Maps short-links over phone numbers. Distinct booking phones that reused a Maps URL (or a channel Maps pin) were merged into one card — venues vanished from the public count. Live Firestore fetch also capped at 1,200 of ~4,011 persona-posts, so some phones never reached the merge step. Hero "Named faces" counted only card titles, not rolled-up aliases.
- **Correct behaviour:** Phone-first identity (`phone:` before `maps:`). Fetch/merge the full companions archive before gating quality. Count named faces across `name + aliasNames`, skipping `isBadPublicName`. Hero **Venues** = unique phones (minister-defensible); directory cards = quality-gated merged set. Never trust a stored `canonical_key` that predates phone-first.
- **How to recognise:** Firestore phone count ≫ public `data.json` phone count; LOUISSPA/Yesika/กุหลาบ missing while their Maps link sits on another shop; hero faces ≈ card count instead of ≫ venues.

---

## 2026-08-03 · Methodology section grid trapped content in the 4rem gutter

- **What went wrong:** `.meth-section` is `display:grid` with columns `4rem | 1fr`. Only a hard-coded list of tags (`h2`, `p`, …) had `grid-column: 2`. The §14 principles/resources `<div>`s auto-placed into the 4rem number column, so CONSENT/CONDOMS text spilled over the resource list.
- **Correct behaviour:** `.meth-section > *:not(.meth-num) { grid-column: 2; min-width: 0; }`. Never leave unclassed blocks as naked section children without that rule. Prefer named classes (`.meth-principles`, `.meth-resources`).
- **How to recognise:** Amber labels from a “sidebar” overlapping body copy on Methodology; inspect computed grid-column on the overlapping node — if it is 1 and width ~4rem, this is the bug.

- **What went wrong:** Secondary pages showed `กลับไปยังไดเรกทอรี` / “Back to Directory” next to the real browser chrome. Fake back buttons fight the history stack and look amateur when the header already has Inventory.
- **Correct behaviour:** Never add an in-page back-to-directory control. Inventory / Live / Map push real routes (`/`, `/?view=feed`, `/map`) so **browser Back** restores the prior page and view. Secondary papers keep only their section label in the page chrome.
- **How to recognise:** Grep for `backToDirectory`, `an-back`, `meth-back` pointing at `/`, or Thai `กลับไปยังไดเรกทอรี`. Remove them; wire navigation through `navigate()` / `<Link>`.

- **What went wrong:** Sticky header showed `sabai·sabai` directly above the hero title `sabai·sabai`. Two identical wordmarks stacked in one viewport. Reads unfinished — like a template that forgot the logo already lived in the masthead.
- **Correct behaviour:** Brand appears once per first viewport. On pages with a branded hero (`HeroSection` / `PageBanner`), the header is **nav + status only**. Never reintroduce `.brand` in `Header.jsx` beside a hero wordmark. If a page has no hero brand, a compact header mark may return — but never both.
- **How to recognise:** Screenshot the top 200px. If you can read the product name twice without scrolling, delete one. Prefer deleting the header mark; heroes earn the brand.
- **Hardwired in:** `Header.jsx` comment, `.brand { display: none }` in `index.css`, `AGENTS.md` Design Philosophy.

---

## 2026-06-06 · Airtight audit — AI-fraud, concurrent-session hazards

- **AI-generated "VISUAL EVIDENCE" is the worst regression class.** A concurrent session added three AI images to the research-paper page, stamped "VISUAL EVIDENCE" and captioned as real field photographs. This violates §0 (no AI imagery, ever), §11.4 (no fabricated content), and would disqualify the research outright. **Catch:** audit every new image asset — is it a real curated photo or AI-generated? Grep new `public/**/*.png|jpg` against the components that reference them; read the captions. Remove on sight unless Dr Non asked in-session. Keep the legitimate siblings (a hand-coded SVG diagram, real prose) — surgical, not scorched-earth (§11.1).
- **Two sessions on one repo = silent architectural drift.** While I worked, a parallel session migrated the whole app Supabase→Firebase (committed, authored as Dr Non), truncated then refactored Analytics, and added an `award-pass.css`. Don't assume the tree you left is the tree you return to. **First move every session: `git log --oneline -15` + `git status` + `npx vite build && npm test` to establish ground truth before editing.**
- **The classic concurrent bugs to grep for:** an effect dependency that's a freshly-built array/object every render (→ infinite fetch loop; here PopularListings burned Firestore quota) → use a stable string key; a child component called without a required `mode`/variant prop (→ silent wrong-shape filler; InsightNarrative defaulted to 'spatial' on global data); dead imports left after a migration; orphaned components no longer rendered (delete them, §9); a compound Firestore `orderBy` that needs a composite index (→ silent fallback to the static snapshot) — match the realtime query's single orderBy.
- **A `200` on a missing static asset can be the SPA fallback, not the file.** With `_redirects: /* /index.html 200`, any path returns index.html. To check whether a file truly exists on prod, look at `content-type` — `text/html` means it's the SPA shell (file is gone), an image/* content-type means it's really there. Don't trust the status code alone.

---

## 2026-06-01 · Health checks must test the product contract, not just the port

- **What matters:** a production monitor that only checks whether Express responds can miss the failures this project actually suffers from: missing `dist/index.html`, empty mutable snapshots, and heartbeat stalls from the scraper pipeline.
- **Correct behaviour:** `GET /health` should be a product health contract. It returns `200` only when the SPA shell is present, `public/data.json` and `public/feed.json` are parseable non-empty arrays, and `logs/heartbeat.stall` is absent with no stale/error heartbeat. It returns `503` with structured JSON when any critical condition degrades.
- **Operator habit:** after `npm run build` and `npm run start`, fetch `/health` before declaring the deploy healthy. Add the external monitor URL to `_reference/monitoring-urls.md` so the monitoring surface is part of project history, not an oral tradition.

---

## 2026-05-31 · Sabai Sabai 2.0 design overhaul

**What went wrong — fixed-viewport shell vs. page-scroll design:**
- Dropped the new hero into the directory view; the page collapsed (docHeight 454px, hero 1421px overflowing a 12px-tall `.main-content`, footer overlapping the hero).
- Root cause: `.app-shell` was `height:100dvh; overflow:hidden` with `.main-content { flex:1; overflow-y:auto }` — a *fixed-viewport* app built for the old directory/map/feed tab interface, where an internal pane scrolls inside a locked screen. The new design is a *scrolling hub* (hero → KPIs → listings → footer), which needs natural document flow.
- **Correct behaviour:** when injecting tall page content, first check whether the app shell is fixed-viewport (`height:100vh/100dvh` + `overflow:hidden`) or natural-flow. If fixed, convert: `min-height:100dvh`, drop `overflow:hidden`, change the scroll pane from `flex:1; overflow-y:auto` to `flex:1 0 auto`, and give any map/fill view an explicit height.
- **How to recognise:** symptoms = `document.documentElement.scrollHeight` far smaller than a child's height; a section's `getBoundingClientRect().height` huge while its parent's is ~0; footer `top` overlapping earlier sections. `preview_eval` reading section tops/heights diagnoses it in one call.

## 2026-05-31 · A background deploy can exit 0 yet upload nothing

- **What went wrong:** ran `wrangler pages deploy` with `run_in_background`. It exited 0 but produced no "Deployment complete" line and uploaded nothing — production silently stayed on the previous build. Reported the work as live; the user (correctly) saw the old version.
- **Correct behaviour:** never trust a deploy's exit code. **Verify the artifact on production**, not the process: fetch the live `index.html`, extract the hashed asset name, fetch that asset, and grep for a token you just changed (e.g. `--r-xs:0`). If prod's asset hash ≠ your local `dist/` hash, the deploy didn't land. Prefer deploying in the **foreground** and confirming the "✨ Deployment complete" line + a unique deployment URL.
- **How to recognise:** user says "looks the same as before." First check: `curl -s "$PROD/?cb=$(date +%s)" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.css'` vs the hash in local `dist/index.html`. Mismatch = stale prod (failed deploy OR you deployed before building). Match but user still sees old = their browser cached `index.html` → hard refresh.
- **Also:** commit BEFORE deploying, so the Cloudflare deployment's "Source" commit matches the files actually shipped. Deploying first labels the deployment with the prior commit and muddies forensics.

## 2026-05-31 · Map "not loading" + preview-sandbox tiles

- **Leaflet in a tab that's `display:none` renders at 0×0 and never recovers** unless something re-measures it. The old code only called `invalidateSize()` on a `#map` hash that the new tab UI never fires → the map "didn't load." Fix: a `ResizeObserver` on the map container that calls `invalidateSize()` on every resize (fires when the tab goes none→visible) and runs a few settle passes + one fit on first real size. This is the canonical fix for any Leaflet/Mapbox map inside a tabbed/`display:none` panel.
- **A de-stack/jitter offset must never depend on live data (e.g. `group.length`).** My first version scaled the scatter radius by bucket size, so every 30s refresh shifted bucket sizes and moved every pin — the "bouncing." Make the offset a pure function of a stable per-item key (hash of id) so positions are deterministic across refreshes. Also fit with `animate:false`.
- **The preview sandbox aborts most external tile requests (`net::ERR_ABORTED`).** A map can show 1 tile in preview while requesting the full grid correctly — don't mistake this for a code bug. Diagnose with the network log (`preview_network` → grep the tile host): if the grid is *requested* (many GETs) but only one returns 200, it's the sandbox, not the code. Verify the real fix on the live Cloudflare deploy.

**What went right — the token-bridge force multiplier:**
- Rewrote `index.css` as the new design system but aliased every legacy `--color-*/--font-*/--radius-*` token onto the new warm-dark values. All 40+ untouched components adopted the new palette/fonts/radius instantly. One file, whole-app shift, near-zero regression risk. Reuse this pattern for future re-skins.
- `preview_eval` + `preview_screenshot` (launch.json with the CORRECT node path — `/opt/homebrew/bin/node`, not `/usr/local/bin/node`) caught the layout bug before deploy. Kill stray vite servers on the port first (another project's "CITY HUB" was holding 5174 and got screenshotted instead).

---

## 2026-05-24 · Kimi audit + deploy session

**What went right:**
- Kimi's design overhaul claims all verified by three parallel Explore agents. No anti-regression violations found. Legitimate refactor of App.css (70% reduction) because Login styles moved to Login.css — Login still works.
- Two-commit strategy (design overhaul + housekeeping) kept history readable.
- Selective staging (avoiding scratch files, runtime state) kept the repo clean.

**What went wrong — credits bug interrupted mid-session:**
- Anthropic credits issue forced a session restart mid-housekeeping-commit. The commit had been staged but not written when the session dropped. On reconnect, the staging area was lost and had to be reconstructed from memory.
- **Correct behaviour:** Before any multi-step git operation across session boundaries, commit what's ready rather than accumulating staged-but-uncommitted work.
- **How to recognise:** If you've run `git add` on files but haven't committed, any session interruption will reset the index. Commit in smaller atomic units.

**What went wrong — branch confusion:**
- After merging `codex/harden-intake-map-cache` to main and pushing, the local working tree on the codex branch had 30+ modified OG card PNGs (from active scraper). `git checkout main` blocked. Had to `git stash push -u` first.
- **Correct behaviour:** On any project with a running scraper (active `launchd` plist), always run `git stash push -u` before switching branches. The scraper continuously regenerates `public/og/*.png`, `public/data.json`, `public/feed.json`.
- **How to recognise:** If `ps aux | grep telegram_scraper` returns a process, the working tree is live. Always stash before branching.

**What went wrong — npm audit skipped before deploy:**
- Deployed twice (design overhaul + geocoding pass) without running `npm audit` first. Post-deploy audit found 20 vulnerabilities including 3 critical Vite CVEs.
- **Correct behaviour:** `npm audit` is part of the deploy checklist. Run it before every `wrangler pages deploy`. If critical/high vulns exist, fix them before the deploy or explicitly document the accepted risk.
- **How to recognise:** No npm audit in `build:full` script. Add it: `"build:full": "npm audit --audit-level=high && npm run snapshot:refresh && npm run og:cards && npm run build"`.

---

## 2026-05-22 · Initial deploy (Sabai Sabai 2.0)

**What went right:**
- Parallel Explore agents (3 at once) audited Kimi's work efficiently in ~2 minutes.
- Selective gitignore additions prevented runtime artifacts from polluting future sessions.

**What went wrong — dist/_redirects:**
- Deployed to Cloudflare Pages without `dist/_redirects`. SPA routing was broken until discovered in verification step.
- **Correct behaviour:** After every `vite build`, write `echo "/*    /index.html   200" > dist/_redirects` immediately. dist/ is gitignored, so this must be done manually before every deploy.
- **How to recognise:** If `curl -I https://[site].pages.dev/listings` returns 404 instead of 200, the redirect is missing.

**What went wrong — `~` directory:**
- An accidental `mkdir ~` created a literal directory named `~` inside the project. Not harmful but confusing in `git status`. Still unresolved.
- **Correct behaviour:** Delete it with `rm -rf '~/Projects/air-dnd/~'` (must quote to avoid shell expansion).

## 2026-08-19 · A green `vite build` does not prove a React component renders
- **What went wrong:** Refactored `ListingCard.jsx` to use `useMemo` but left the import line as `import { useState } from 'react'`. `npx vite build` succeeded, so it was committed (`c86428b`) and deployed to production. Every `ListingCard` then threw `ReferenceError: useMemo is not defined`; `ErrorBoundary` caught it and replaced the entire directory grid — the core product — with "Component Error". The site was broken live until `8fd4607`.
- **Correct behaviour:** A bundler resolves *module* imports, not *identifier* scope inside a function body. Missing named imports from an already-imported module are runtime errors it will never catch. After ANY edit that introduces a new hook or helper into an existing component, verify the component actually renders in a browser — not just that the build is green. CDPT's "T" means load the page and assert the changed thing is present, which is exactly what would have caught this.
- **How to recognise:** Whenever a diff adds `useMemo`/`useCallback`/`useRef`/`useEffect` to a file that previously used only some hooks, re-read line 1 of that file before committing. Symptom in the wild: an `ErrorBoundary` fallback where content should be, with a clean build log.

## 2026-08-24 · A silent fallback made the LIVE tab a copy of the directory
- **What went wrong:** `refresh_feed_snapshot.js` pulls per-message rows from Supabase and, on any error, rebuilds `feed.json` from `data.json` instead. That fallback changes the *shape* of the data — one card per business rather than one per post — but wrote to the same file with no marker. Supabase has been down since Aug 18, so the fallback became the steady state and the LIVE tab was byte-for-byte the directory (same 105 records, same 95 phones, same 96 names) while still claiming "every post that arrives".
- **Correct behaviour:** A fallback that changes the shape or meaning of data must declare itself. `feed_meta.json` now carries `{degraded, source, reason, builtAt}` and `FeedGrid` renders a notice when degraded. Sidecar file, so `feed.json` stays a bare array.
- **How to recognise:** Two views that should differ have identical counts. Test the identity key, not the length — normalise phones across both files and check set overlap. 100% overlap is duplication, not coincidence.

## 2026-08-24 · Amber accent fails contrast on the light health surface
- **What went wrong:** New `.health-copy h3` used `--accent` (#f59e0b) for text on the cream `#faf9f7` panel — measured **2.04:1**, far under §11.10's 4.5:1 floor. It looked fine at a glance, which is exactly the trap.
- **Correct behaviour:** On light surfaces the amber carries the *rule*, never the glyphs — `border-top: 2px solid var(--accent)` with `color: var(--ink-1)` measures 17:1 and keeps the one-accent identity intact.
- **How to recognise:** Any time `--accent` lands on `color:` rather than `border`/`background` on a light panel. Measure it in-browser before committing; don't eyeball it.

## 2026-09-09 · "136 vs 385" — a count carried in prose with no source
- **What went wrong:** A handoff note said "the 136-vs-385 economic-resource count needs the other auditor's methodology to reconcile." Neither number exists in the repo, git history, prior transcripts, memory, or the vault. A session was spent searching for two figures that were never produced by anything. Meanwhile the real defect sat unnamed: "economic aggregate" had no definition in code, so it was counted five ways (156 datasets / 146 fetch results / 228 title-matches / 211 skipped / 1 used), and 17 revenue-titled resources had leaked into the producer registry because field discovery mapped a money column (`รายได้จากผลิตภัณฑ์`, `ผลิตภัณฑ์(บาท)`, `Value Product_OTOP`) as the name.
- **Correct behaviour:** Every count in a handoff names the function or file that produces it. If it cannot, it is retired, not reconciled. The definition now lives in `classifyResource()` (`otop/core/field_map.js`); `otop_meta.json.counts.resourcesAggregateEconomic` prints it and the page reads it. `ร้านธงฟ้า` retail-outlet lists are excluded by title (Dr Non's scope call, `otop.config.json.excludeTitles`). Records 158,864 → 154,078.
- **How to recognise:** A number in prose that no `grep` in the repo returns. Also: a second session committing to the same worktree mid-task (ae77e47 landed at 22:26 with a `const` inside JSX — a parse error a green `node --test` cannot see). Re-run `eslint` and `vite build` on the *current* tree before shipping, not on the tree you read an hour ago.

## 2026-09-10 · Two tables from one department are two series, not one number

- **What went wrong (caught before it shipped):** the CDD publishes OTOP sales twice — a monthly province series and an annual province × category × channel table. The obvious move was to read the category split as the breakdown *of* the monthly totals. Reconciled per full province-year they differ for 143 of 151 (median gap 4.7%), and the annual table carries a conflicting duplicate row (Nakhon Nayok 2566 herbal twice, different values, food and beverage one row short — a mislabel nobody can resolve).
- **Correct behaviour:** publish both under their own resource id, measure the disagreement in the build (`reconciliation`) and print the live figure on the page; exclude a conflicting province-year and name it, never pick a row. A test pins that the two resource ids differ and that an excluded province-year is absent from the output.
- **How to recognise:** two datasets whose titles describe the same quantity from the same publisher. Sum one and compare it to the other before treating either as the breakdown of the other — the check is ten lines and the assumption is the whole finding.

## 2026-09-10 · A page of correct tables answers no one's question

- **What went wrong:** four sessions each appended an honest section to one Atlas view until it was 18 stacked tables, and nobody's question was answered in order. The fix was not a 19th section.
- **Correct behaviour:** give the data a unit of reading below the nation (one province, whole, at a shareable URL) and cut the national view into chapters that each answer one question, chart first, tables below, long ones behind `<details>`. Every existing section survived; each was moved, not deleted.
- **How to recognise:** the next contribution is "add a section" and the page already needs a sticky nav to be usable. Ask which question the reader arrived with, and which page unit answers it.

## 2026-09-10 · `force-cache` on an unhashed data URL pins a returning visitor to an old build

- **What went wrong:** province shards (`/p/46.json`) were fetched with `cache: 'force-cache'`. The URL never changes between builds, so a browser that had seen the site once kept serving its first shard forever — on the live dossier Kalasin showed "0 of 3,813 records name a product" while the served file held 3,431. Stale data under a fresh heading: the silent-substitute failure this project bans.
- **Correct behaviour:** unhashed data URLs use `cache: 'no-cache'` (revalidate against the edge ETag — a 304 when unchanged, new bytes after a rebuild), the same as the index already did. Only content-hashed asset URLs may be cached forever.
- **How to recognise:** a number on the live page disagrees with the artefact the live URL serves to `curl`. Compare `fetch(url, {cache:'force-cache'})` and `{cache:'reload'}` in the console before suspecting the build.
