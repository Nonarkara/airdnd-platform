# Supabase exit — audit and runbook

*Audited 2026-09-28/29 against the live project (`fehdtfncbutesgadjsxp`, "AirDnD"). Code on branch `claude/otop-database-research-zsg9yj`.*

## 1. What Supabase is still doing

| Where | What | After this branch |
|---|---|---|
| **Browser** | 2nd-tier listing fetch + a realtime websocket to `companions` | **Removed.** Browser reads Firestore → `data.json`. The supabase-js client no longer ships in the bundle. |
| **Scraper** (`telegram_scraper.js` → `listing_pipeline.js`, `photo_storage.js`) | Writes listings, raw messages, photo metadata; uploads every photo to the bucket | Unchanged until you set `LOCAL_DB=1` (opt-in local SQLite store). |
| **Heartbeat** (launchd) + its jobs `refresh_feed_snapshot`, `compute_patterns`; **integrity check** | Read Supabase | Follow the same `LOCAL_DB=1` switch. |
| **GitHub Actions** `.github/workflows/scraper.yml` | Runs the scraper **every 30 minutes** in the cloud with Supabase secrets — in parallel with the Mac daemon | Still on. See step 4. |
| **render.yaml** worker | Configured to run the scraper on Render | Check whether it is deployed (step 4). |
| ~25 analysis scripts (`compute_*`, `audit_*`, `cleanup_*`, `backfill_*`, …) | Read Supabase directly | Run manually; they stop working after cutover until pointed at the local store. Nothing runs them automatically. |
| Display copy | `Methodology.jsx`, `FAQ.jsx`, `Paper.jsx`, `Insights.jsx`, `translations.js` describe "Supabase … real-time subscriptions" | Still true until cutover; update at step 7. |

## 2. Why it costs money

| | Size | Free tier |
|---|---|---|
| Database (all tables) | 241 MB | 500 MB — fits |
| **Photo bucket `listing-photos`** | **7.6 GB · 59,246 files** | **1 GB** |

The rows are cheap; **the photos force the paid plan.** Growth is ~1.2 GB/month.

The organisation holds **three** active projects — `AirDnD`, `Thailand Geopolitical Watch`, `Ops Monitoring`. The free plan allows two active projects. Decide what happens to the other two before downgrading the plan (step 8); nothing here touches them.

## 3. The finding that sets the order of operations

`photo_archive` has **0 of 57,968 photos with a Google Drive copy.** The Drive photo backup has never run. Every photo exists in exactly two places — the Mac's disk and the Supabase bucket — and they do not match:

- 59,246 objects in the bucket, but only 56,424 archive rows point at one;
- 1,544 archive rows have no cloud copy at all.

**Anything that exists only in the bucket is gone the moment the project is deleted.** So: export and reconcile first, verify, and only then switch anything off.

## 4. Runbook

Every step before step 8 is reversible. Run commands in Terminal from the project folder:

```
cd ~/Projects/air-dnd
git pull
npm install
```

### Step 1 — Deploy the website fix (no risk, do it today)

Merge the branch, then deploy as usual (CLAUDE.md → "Deploying to Cloudflare Pages"). The site stops talking to Supabase, the map shows only honest pins, and "Maps" buttons open each shop's own link.

### Step 2 — Re-place every listing from real evidence (5 minutes)

On the Mac (it can reach Google Maps; the cloud sandbox cannot):

```
npm run geo:relocate
```

This is a dry run. Read the report: every listing whose coordinate changes, by how much, and why. If it looks right:

```
npm run geo:relocate -- --apply
```

### Step 3 — Export everything and reconcile the photos (~1–2 hours, mostly download)

Plug in an external drive (the export is ~8 GB). Replace `Backup` with your drive's name:

```
npm run exit:export -- --out /Volumes/Backup/sabai-supabase-export --local-archive public/images
```

It ends with one word. **Only `COMPLETE` counts.** If it says `INCOMPLETE`, run the same command again — it resumes and retries only what failed. The last lines tell you how many photos existed only in Supabase (now saved on the drive) and how many only on the Mac.

Also download Supabase's own database backup as a second copy: Supabase dashboard → project AirDnD → Database → Backups → download the latest.

### Step 4 — One collector, not two

The GitHub Actions workflow and the Mac daemon both run the scraper against the same Telegram session — a known cause of `AUTH_KEY_DUPLICATED` — and after cutover the cloud runner cannot reach a database on the Mac.

1. Confirm the Mac daemon is the one collecting: `ps aux | grep telegram_scraper`.
2. Disable the schedule: in `.github/workflows/scraper.yml` delete the two lines `schedule:` and `- cron: '*/30 * * * *'` (keep `workflow_dispatch:`), commit, push.
3. Render dashboard: if an `airdnd-live-intake` worker is running, suspend it.

### Step 5 — Build the local database and run both side by side (1 day)

```
LOCAL_DB_PATH=/Volumes/Backup/sabai/sabai.db npm run exit:import -- --from /Volumes/Backup/sabai-supabase-export
```

It must end with `COMPLETE — every exported row is in the local store.` The copy is faithful: original ids, every column (including each message's full original Telegram JSON), nothing re-deduplicated.

Then add to `.env`:

```
LOCAL_DB=1
LOCAL_DB_PATH=/Volumes/Backup/sabai/sabai.db
```

and restart the daemon (`./scripts/daemon.sh`). The scraper, heartbeat, feed and patterns jobs and the integrity check all switch together. Watch for a day:

- heartbeat log shows fresh snapshots;
- the site's listings keep updating (Firestore sync is unchanged);
- `node scripts/integrity_check.js` passes.

To roll back at any point: remove the two lines from `.env` and restart.

### Step 6 — A second copy of the photos

The Drive backup never worked, so after cutover the photos would live on one disk. Pick one and set it up before step 8:

- **Cloudflare R2** (recommended): the website already lives on Cloudflare; 10 GB free, then ~$0.015/GB-month, no download fees; would also allow a public photo gallery later.
- **A second external drive**, copied weekly.
- **Fix the Drive upload** in `scripts/google_export.js` — note 7.5 GB exceeds free Drive (15 GB shared with Gmail) within months.

### Step 7 — Update what the site says about itself

`src/components/Methodology.jsx`, `FAQ.jsx`, `Paper.jsx`, `Insights.jsx` and `src/translations.js` describe Supabase and real-time subscriptions. Rewrite to the new truth: local store → Firestore → Cloudflare Pages.

### Step 8 — Switch off (only after steps 3–7)

1. Supabase dashboard → AirDnD → Settings → **Pause project**. Paused free-tier projects stay restorable for 90 days — this is the safety net.
2. Decide the other two projects, then downgrade the organisation plan.
3. After 30 quiet days: remove the Supabase variables from `.env` and the GitHub secrets, then delete the project.

## 5. Risk to watch after the switch: Firestore quota

With Supabase gone, Firestore is the only live source for the website. Every open tab re-reads the **whole** `companions` collection every 30 seconds. On the free Spark plan (50,000 reads/day), a collection of N documents allows about 50,000 ÷ N page-refreshes per day across all visitors — and the sync only ever adds documents, never removes them. When the quota runs out, visitors silently get the older `data.json` snapshot.

Check: Firebase console → Firestore → Usage (reads/day) and the document count of `companions`. The durable fix is one live listener per tab (`onSnapshot`, which re-reads only changed documents) instead of a full re-read every 30 seconds.

## 6. Location precision — what changed

The same audit found stored coordinates that were fabricated, not approximate: 92 coordinates on only 42 distinct points; 14 businesses with 14 different Google Maps links on one point in north Bangkok (Google's page-chrome default); shops pinned 55–87 km from the province their own address names; one 745 km off. Cause: the Maps resolver read coordinates out of the fetched HTML page and cached them forever.

Now every listing is placed from evidence — its own Maps link, checked against its own address, resolved against the national gazetteer (928 districts, 7,436 subdistricts, CC BY 4.0, shared with the OTOP registry) — and carries `geoPrecision` (exact / tambon / district / province / none). The map draws exact points as dots, subdistrict and district placements as rings with their honest radius, and lists — rather than pins — any listing that names nothing finer than a province. On the live data: 28 exact, 29 subdistrict, 7 district, 39 province-only. Step 2 should move many of the last group to exact.
