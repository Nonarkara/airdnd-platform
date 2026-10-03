# Running Sabai on the M3 — one machine, always on

*Written 2026-10-03. Goes with `tasks/supabase-exit.md` (the Supabase switch-off); this file is about the machine.*

The M3 becomes the whole back office: it collects, extracts, categorises, places, stores, backs up and publishes. Five workers run under macOS's own process manager (launchd), each restarted if it dies, each writing its own log:

| Worker | When | What it does | Log |
|---|---|---|---|
| **collector** | always | Reads the Telegram channels every 30 s; extracts, deduplicates, categorises, saves to the local database, syncs Firestore (what the live site reads) | `logs/collector.log` |
| **bot** | always (if `TELEGRAM_BOT_TOKEN` is set) | Your own bot: posts and photos forwarded to it become listings | `logs/bot.log` |
| **heartbeat** | every 30 min | Rebuilds the snapshot, feed, patterns and share cards; checks everything; sends you alerts; rotates logs | `logs/heartbeat.log` |
| **backup** | 03:17 nightly | Verified copy of the database and the collector's position in each channel → `BACKUP_DIR`; keeps 7 daily + 4 weekly | `logs/backup.log` |
| **photos** | 04:07 nightly (once R2 is set up) | Publishes new unique, screened photos; removes any that a later flag withheld | `logs/photos.log` |

Three commands are all you need day to day:

```
npm run ops:status     # is each worker running?
npm run ops:doctor     # full check, with the fix for anything wrong
npm run ops:test-alert # does an alert reach my phone?
```

If something looks wrong, run `npm run ops:doctor` and send me what it prints.

---

## Part A — Stop the M5 first (never let both run)

Both Macs use the same Telegram session. Two machines on one session get it revoked (`AUTH_KEY_DUPLICATED`), and then nothing collects until you log in again by hand. The M3 refuses to start a second collector **on the same Mac**, but it cannot see the M5. So stop the M5 yourself, first.

On the **M5**, open Terminal and paste these lines one at a time:

```
launchctl bootout gui/$(id -u)/com.sabai.scraper
launchctl bootout gui/$(id -u)/com.sabai.heartbeat
pkill -f scripts/daemon.sh
pkill -f scripts/telegram_scraper.js
pkill -f scripts/telegram_bot.js
```

Some lines may say "No such process" or "Could not find service": that only means that part was already stopped. Check:

```
pgrep -fl telegram_scraper
```

It must print **nothing**. Then, so it can never come back after a restart:

```
mkdir -p ~/Library/LaunchAgents/sabai-retired
mv ~/Library/LaunchAgents/com.sabai.*.plist ~/Library/LaunchAgents/sabai-retired/ 2>/dev/null
```

Two more places a collector could be running:
- **Render.** Log in to dashboard.render.com. If a service called `airdnd-live-intake` is running, open it, then Settings → **Suspend**.
- **GitHub.** This update makes the cloud job manual-only. It hasn't run since 17 June, so there's nothing to do.

## Part B — Bring over what the M3 needs

Some files hold things the code doesn't: your secrets, how far each channel has been read, and the photos. Copy them from the M5's project folder into the M3's, using AirDrop or a USB drive. Never use email or a cloud folder for `.env`.

| File or folder | Why it matters |
|---|---|
| `.env` | The Telegram session and every key. Without it nothing runs |
| `.sabai-scraper-state.json` | Where each channel was read up to. Without it the collector starts from scratch |
| `credentials.json`, `token.json` | Google access (Sheets backup), if you use it |
| `.maps_cache.json`, `.geocoder_cache.json` | Saves re-resolving every Maps link |
| `public/images/` | The photo archive (several GB) |
| `data/` | The photo ledger and map, and the database if you already built one |

The project folder must **not** be inside Desktop, Documents, Downloads or iCloud Drive. iCloud can move files away mid-write, and macOS blocks background jobs from those folders. Use `~/Projects/air-dnd`. `ops:doctor` checks this.

Then, on the **M3**, in Terminal:

```
cd ~/Projects/air-dnd
git pull
npm install
```

## Part C — The database (finishing what you're doing now)

1. Let the export finish. It must end with the word `COMPLETE`. If it says `INCOMPLETE`, run the same command again; it resumes.
   ```
   npm run exit:export -- --out /Volumes/<drive>/sabai-supabase-export --local-archive public/images
   ```
2. Import it into the M3's database (on the internal disk, which is fast and always there):
   ```
   npm run exit:import -- --from /Volumes/<drive>/sabai-supabase-export
   ```
   It must end with `COMPLETE — every exported row is in the local store.`
3. Open `.env` (`open -e .env`) and add at the bottom (replace `<drive>`; a second drive is better for backups than the export drive):
   ```
   LOCAL_DB=1
   BACKUP_DIR=/Volumes/<drive>/sabai-backups
   PHOTO_ARCHIVE_DIRS=/Volumes/<drive>/sabai-supabase-export/storage/listing-photos
   ```
   `TELEGRAM_BOT_TOKEN` and `TELEGRAM_NOTIFY_CHAT_ID` are probably already there: they are what sends you new-listing notifications. Alerts use the same two.

## Part D — Make the M3 an always-on machine

In Terminal (it asks for your Mac password; nothing appears as you type it):

```
sudo pmset -a sleep 0 disksleep 0 autorestart 1 womp 1
```

That stops sleep, switches the Mac back on after a power cut, and lets the network wake it. On a MacBook, keep it on power.

Also, in System Settings:
- **General → Software Update → Automatic Updates**: turn off **Install macOS updates**. Keep "Download new updates" on. An overnight update restarts the Mac, and see the next point for why that matters.
- **FileVault** (Privacy & Security). If it's on, then after any restart the Mac waits for your password, and the workers start only once you log in. Keep it on: the database holds phone numbers. The outside alarm below tells you when the Mac needs you.

**Outside alarm (free, 5 minutes).** Alerts come *from* the M3, so they can't tell you the M3 itself is off. Sign up at healthchecks.io, then:
1. Create a check. Period: 30 minutes. Grace: 30 minutes.
2. Copy its ping URL.
3. Add `HEALTHCHECK_URL=<that URL>` to `.env`.

The heartbeat pings it every 30 minutes, and healthchecks.io emails you when the pings stop.

## Part E — Start the workers

```
npm run ops:install
```

This:
1. retires the old setup (the `com.sabai.scraper` job and any hand-started copies);
2. writes the five workers for *this* Mac's folder and Node;
3. starts them. Workers whose keys are missing from `.env` are skipped, and it tells you which.

Wait two minutes, then:

```
npm run ops:status
npm run ops:doctor
npm run ops:test-alert
```

You should see `collector running`, a doctor report with nothing marked ✗, and a test message on your phone. Run `npm run ops:backup` once to make the first backup now, rather than waiting for 03:17.

## Day to day

- **Pause everything** (for example before restoring a backup): `npm run ops:stop`, then `npm run ops:start`.
- **After changing `.env`** or moving the folder: `npm run ops:install` again. It's safe to repeat.
- **Logs** are in `logs/`. Each worker has `<name>.log` (normal output) and `<name>.err` (errors). They rotate at 20 MB, keeping 3.
- **Alerts** arrive when something breaks, again every 6 hours while it stays broken, and once when it recovers. Every alert is also written to `logs/alerts.jsonl`.

### Restoring the database from a backup

```
npm run ops:stop
mv data/sabai.db data/sabai.db.broken
rm -f data/sabai.db-wal data/sabai.db-shm
cp /Volumes/<drive>/sabai-backups/sabai-<date>.db data/sabai.db
cp /Volumes/<drive>/sabai-backups/state-<date>/.sabai-scraper-state.json .sabai-scraper-state.json
npm run ops:start
```

Restoring the channel positions from the same night makes the collector re-read everything posted since, so nothing in between is lost. Duplicates are merged as usual.

## What still lives in the cloud

| Service | Role | Cost |
|---|---|---|
| Telegram | Source channels; your bot | Free |
| Gemini | Extraction and enrichment | Free tier |
| Firestore | What the live site reads; the collector syncs it every cycle | Free tier. Watch the quota (supabase-exit.md §5) |
| Cloudflare Pages + R2 | The site; the published photos | Free / ≈ $0.11 a month |
| healthchecks.io | Outside alarm | Free |
| **Supabase** | **Nothing**, once `LOCAL_DB=1` is on and supabase-exit.md step 6 says `SAFE` | **$0** after step 8 |
