# Supabase exit — audit and runbook

*Audited 2026-09-28/29 against the live project (`fehdtfncbutesgadjsxp`, "AirDnD"). Code on branch `claude/otop-database-research-zsg9yj`.*

## 1. What Supabase is still doing

| Where | What | After this branch |
|---|---|---|
| **Browser** | 2nd-tier listing fetch + a realtime websocket to `companions` | **Removed.** Browser reads Firestore → `data.json`. The supabase-js client no longer ships in the bundle. |
| **Browser — photos** | Listing galleries and the Live feed show pictures straight from the Supabase bucket: **34,414 photo links** in the live Firestore data point at `…supabase.co/storage/…` | **Still true until step 6 is done.** Switch off before publishing the photos and every gallery on the site goes blank. `scripts/publish_photos.js` moves them; the listing export and the feed then point at the new copies. |
| **Scraper** (`telegram_scraper.js` → `listing_pipeline.js`, `photo_storage.js`) | Writes listings, raw messages, photo metadata; uploads every photo to the bucket | Unchanged until you set `LOCAL_DB=1` (opt-in local SQLite store). |
| **Heartbeat** (launchd) + its jobs `refresh_feed_snapshot`, `compute_patterns`; **integrity check** | Read Supabase | Follow the same `LOCAL_DB=1` switch. |
| **GitHub Actions** `.github/workflows/scraper.yml` | Ran the scraper every 30 minutes in the cloud with Supabase secrets, in parallel with the Mac | **Manual-only now** (last run 2026-06-17). See step 4. |
| **render.yaml** worker | Configured to run the scraper on Render | Check whether it is deployed (step 4). |
| ~25 analysis scripts (`compute_*`, `audit_*`, `cleanup_*`, `backfill_*`, …) | Read Supabase directly | Run manually; they stop working after cutover until pointed at the local store. Nothing runs them automatically. |
| Display copy | `Methodology.jsx`, `FAQ.jsx`, `Paper.jsx`, `Insights.jsx`, `translations.js` describe "Supabase … real-time subscriptions" | Still true until cutover; update at step 7. |

## 2. Why it costs money

| | Size | Free tier |
|---|---|---|
| Database (all tables) | 241 MB | 500 MB — fits |
| **Photo bucket `listing-photos`** | **7.6 GB · 59,246 files** (29 Sep) → **9.3 GB · 68,734 files** (5 Oct) | **1 GB** |

The rows are cheap (the whole database is 285 MB); **the photos force the paid plan.** Measured intake, 21 Sep – 4 Oct: ~190 MB of photos a day, **≈ 5.6 GB a month** (an earlier estimate of 1.2 GB/month was wrong).

The organisation holds **three** active projects, and on the Pro plan each extra project adds ~$10/month of compute on top of the $25 plan (Supabase's own example for three projects: ~$45/month):

| Project | Database | Stored files | Fits free tier? |
|---|---|---|---|
| AirDnD | 241 MB | 7.6 GB | **No** — storage 7.6× over |
| Thailand Geopolitical Watch | 34 MB | none | Yes |
| Ops Monitoring | 32 MB | none | Yes |

So once AirDnD's photos are out, the whole organisation can drop to the free plan (two active projects allowed; paused projects don't count) — **$0/month.**

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

Two clients on one Telegram session get it revoked (`AUTH_KEY_DUPLICATED`). Handled:

- The GitHub Actions schedule is removed (manual-only); it had not run since 2026-06-17.
- On the old Mac, stop everything: `tasks/m3-operations.md`, Part A.
- Render dashboard: if an `airdnd-live-intake` worker is running, suspend it.
- On the M3 itself a second collector refuses to start (`data/collector.lock`).

### Step 5 — Build the local database and switch to it (1 day of watching)

```
npm run exit:import -- --from /Volumes/Backup/sabai-supabase-export
```

It must end with `COMPLETE — every exported row is in the local store.` The copy is faithful: original ids, every column (including each message's full original Telegram JSON), nothing re-deduplicated. Keep the database on the M3's internal disk (the default, `data/sabai.db`); put backups on the external drive.

Then add `LOCAL_DB=1` and `BACKUP_DIR=/Volumes/<drive>/sabai-backups` to `.env` and run `npm run ops:install` (details: `tasks/m3-operations.md`, Parts C–E). Every worker switches together: collector, bot, heartbeat and its jobs, integrity check, snapshot refresh. Watch for a day:

- `npm run ops:doctor` shows nothing marked ✗;
- the site's listings keep updating (the collector still syncs Firestore every cycle);
- `node scripts/integrity_check.js` passes.

To roll back at any point: remove `LOCAL_DB=1` from `.env` and run `npm run ops:install` again.

### Step 6 — Publish the photos to Cloudflare R2 (the site needs this; ~1 hour setup, then three commands)

The website shows its photos from the Supabase bucket today, so this step is not optional: it is what keeps the galleries alive after step 8. It also gives the photos their second home (the Drive backup never worked).

**What gets published.** Every picture, once. The script fingerprints all ~58,000 files twice — exact bytes (SHA-256) and what the picture looks like (a 64-bit perceptual hash that survives Telegram's re-compression and resizing) — and keeps the largest copy of each picture. Then it applies the site's safety rule to each *picture*, not each file:

| A picture that appears on … | Goes |
|---|---|
| at least one listing or feed card shown with photos, and no screened-out one | **published** |
| any listing flagged `is_safe_image = false` | **withheld** — stays in the archive |
| no listing or feed card at all (nothing has ever screened it) | **archive only** |

Cost: the bucket holds 9.3 GB of files (5 Oct); unique, screened pictures are fewer, and only those are published. R2's free 10 GB is per account and shared with your 12 other buckets, so expect to pay $0.015/GB-month beyond it — about $0.15/month per 10 GB. Intake adds ≈ 5.6 GB of raw files a month before deduplication. Viewing is free (no egress fees).

**One-time setup (Cloudflare dashboard, logged in as you; checked against Cloudflare's docs 2026-09-29):**

1. Left menu → **R2 object storage** → **Create bucket**. Name: `sabai-photos-apac` (not `sabai-photos`: that name was briefly created in Eastern North America on 2026-09-29 and deleted, and R2 would reuse that location for the same name). Under **Location**, choose **Asia-Pacific (APAC)** from the list. (A bucket's location can never be changed later; APAC keeps uncached photos close to Thai visitors.) → **Create bucket**. Check: bucket → **Settings** → *Bucket details* should say APAC.
2. In the bucket → **Settings** → under **Custom Domains** → **Add** → type `photos.nonarkara.org` → **Continue** → review the DNS record → **Connect Domain**. Status goes from *Initializing* to *Active* in a few minutes (refresh the page). Leave **Public Development URL** disabled. (If `nonarkara.org` is not accepted, the domain lives in a different Cloudflare account from R2 — tell me.)
3. Back to the **R2 object storage** overview → section **Account Details** → **Manage** next to **API Tokens** → **Create Account API token**. Name it `sabai-photos-publisher`. Permissions: **Object Read & Write**. Scope: **Apply to specific buckets only** → `sabai-photos-apac`. → **Create Account API token**. The next page shows **Access Key ID** and **Secret Access Key** once — keep it open. Your **Account ID** is also under Account Details on the overview page.
4. On the Mac, open `.env` in the project folder (`open -e .env`) and add at the bottom, pasting your values:

```
R2_ACCOUNT_ID=<Account ID>
R2_ACCESS_KEY_ID=<Access Key ID>
R2_SECRET_ACCESS_KEY=<Secret Access Key>
R2_BUCKET=sabai-photos-apac
PHOTO_PUBLIC_BASE_URL=https://photos.nonarkara.org
```

Save and close.

**Run it (Terminal, project folder, with the export drive from step 3 plugged in):**

```
node scripts/publish_photos.js --archive /Volumes/Backup/sabai-supabase-export/storage/listing-photos
```

That is a dry run: it fingerprints everything (the first time takes a while; it remembers, so reruns are fast) and prints how many files, how many unique pictures, and how many will be published / withheld / archived. Nothing is uploaded. If the numbers look sane:

```
node scripts/publish_photos.js --archive /Volumes/Backup/sabai-supabase-export/storage/listing-photos --upload
```

It ends in `COMPLETE` or `INCOMPLETE`; rerun until `COMPLETE` (already-uploaded pictures are skipped). It writes `data/photo_map.json` — the list of old file name → new link.

**Put the new links on the site.** The live site reads its listings from Firestore; the running scraper re-points the listings in its snapshot on its next cycle by itself (it notices the new `data/photo_map.json`, no restart). To reach *every* listing in Firestore, and to get a verdict:

```
node scripts/firestore_sync.js
```

A dry run. It prints how many photo links on the site still point at Supabase now, and how many would after re-pointing. Then:

```
node scripts/firestore_sync.js --apply
```

It changes only the two photo fields of each listing and ends with **SAFE** or **NOT YET SAFE** (with the count). Links left on screened-out listings are never shown, so they don't count against it. If it says NOT YET SAFE, don't switch off — send me the numbers.

Then refresh the two files the site ships and deploy as in step 1:

```
npm run snapshot:refresh
node scripts/refresh_feed_snapshot.js
```

Check by eye: open the live site, open any listing with photos, right-click a photo → *Copy Image Address* → it should begin `https://photos.nonarkara.org/photos/`. Do the same on a card in the LIVE tab. From then on, rerun the `--upload` command whenever new photos have arrived (weekly is enough); the scraper, heartbeat and feed apply the new map on their own.

Keep the export drive as the cold copy. R2 is the second.

### Step 7 — Update what the site says about itself

`src/components/Methodology.jsx`, `FAQ.jsx`, `Paper.jsx`, `Insights.jsx` and `src/translations.js` describe Supabase and real-time subscriptions. Rewrite to the new truth: local store → Firestore → Cloudflare Pages.

### Step 8 — Switch off (only after steps 3–7, and only once step 6 said SAFE)

Checked against Supabase's documentation (2026-09-29): **a project on a paid plan cannot be paused**, and downgrading an organisation that has more projects than the free plan allows **pauses all of its projects** — you then choose which to resume. For you that is exactly the right sequence:

1. Supabase dashboard → organisation → Billing → change plan to **Free**. All three projects pause.
2. Resume **Thailand Geopolitical Watch** and **Ops Monitoring** (dashboard → project → *Resume project*). Both fit the free tier.
3. Leave **AirDnD** paused. A paused project can be restored with one click for **90 days** — that is the safety net if anything was missed. It is not charged while paused.
4. After 30 quiet days: remove the Supabase variables from `.env` and the GitHub repository secrets, download the final backup from the paused project's page if you want a last copy, then delete it (Settings → General → Delete project). Deletion is permanent — database, backups and every stored file.

Unused time on the Pro plan is returned as Supabase credits, not refunded.

## 5. Risk to watch after the switch: Firestore quota

With Supabase gone, Firestore is the only live source for the website. Every open tab re-reads the **whole** `companions` collection every 30 seconds. On the free Spark plan (50,000 reads/day), a collection of N documents allows about 50,000 ÷ N page-refreshes per day across all visitors — and the sync only ever adds documents, never removes them. When the quota runs out, visitors silently get the older `data.json` snapshot.

Check: Firebase console → Firestore → Usage (reads/day) and the document count of `companions`. The durable fix is one live listener per tab (`onSnapshot`, which re-reads only changed documents) instead of a full re-read every 30 seconds.

## 6. Location precision — what changed

The same audit found stored coordinates that were fabricated, not approximate: 92 coordinates on only 42 distinct points; 14 businesses with 14 different Google Maps links on one point in north Bangkok (Google's page-chrome default); shops pinned 55–87 km from the province their own address names; one 745 km off. Cause: the Maps resolver read coordinates out of the fetched HTML page and cached them forever.

Now every listing is placed from evidence — its own Maps link, checked against its own address, resolved against the national gazetteer (928 districts, 7,436 subdistricts, CC BY 4.0, shared with the OTOP registry) — and carries `geoPrecision` (exact / tambon / district / province / none). The map draws exact points as dots, subdistrict and district placements as rings with their honest radius, and lists — rather than pins — any listing that names nothing finer than a province. On the live data: 28 exact, 29 subdistrict, 7 district, 39 province-only. Step 2 should move many of the last group to exact.
