# Sabai Sabai — Lessons Log

Read at the start of every session. The same mistake never happens twice.

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
