# Sabai Sabai — Lessons Log

Read at the start of every session. The same mistake never happens twice.

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
