# Air DnD Dashboard

Air DnD is a React + Vite dashboard for Bangkok-first listing intelligence. The app prefers live Supabase data, falls back to `public/data.json` when live data is unavailable, and finally uses bundled backup records if both live and snapshot inputs fail.

## Runtime modes

- `npm run dev`: local Vite development server
- `npm run build`: production build
- `npm run start`: serves the built frontend and static assets only
- `npm run bot`: runs the Telegram bot separately

The web server is intentionally decoupled from the Telegram bot so the UI can stay stable even if Telegram polling or Gemini extraction fails.

## Health checks

- `GET /health`: production health contract for external monitors such as UptimeRobot.
- Returns `200` with `status: "ok"` when the built SPA shell exists, `public/data.json` and `public/feed.json` are valid non-empty arrays, and the heartbeat has not raised `logs/heartbeat.stall`.
- Returns `503` with `status: "degraded"` when a critical check fails. The JSON response includes per-check details under `checks` so an operator can see whether the break is the build artifact, data snapshot, feed snapshot, or heartbeat.
- The response is `Cache-Control: no-store`; monitors should always hit the live server state.

## Data pipeline

- `npm run scrape`: parse `scripts/sample_data.txt`, normalize listings, write a fresh snapshot, and sync Supabase when the service role key is available
- `npm run scrape:live`: pull recent Telegram messages from the configured Telegram source targets, normalize listings, write a fresh snapshot, and sync Supabase when possible
- `npm run verify:snapshot`: confirm `public/data.json` exists and contains at least one listing
- `node scripts/seed_supabase.js`: backfill the current snapshot into Supabase without duplicating existing rows

Supported optional environment variables for the live scraper:

- `TELEGRAM_SOURCE_TARGETS`: comma-separated Telegram source tokens. Use `@username` for public channels and `dialog:<numeric_id>` for joined private channels.
- `TELEGRAM_SOURCE_CHANNEL`
- `TELEGRAM_SOURCE_CHANNELS`
- `TELEGRAM_FETCH_LIMIT`
- `TELEGRAM_POLL_INTERVAL_MS`
- `SNAPSHOT_LISTING_LIMIT`
- `GEMINI_PARSE_TIMEOUT_MS`
- `AI_ENRICHMENT_PER_CYCLE`

Default curated demo target set:

- `@relaxsociety2020`
- `dialog:2025289026`
- `@keawjaojormmassage`
- `dialog:2381945815`
- `dialog:2491020966`
- `@relaxsocietymassage`
- `dialog:2647876733`
- `@naarsom`
- `@chanelmassage`
- `@dreamgirlspav2`
- `dialog:3769808713`
- `@newmassagerama5`

## Launch checklist

1. Run `npm run scrape:live` to refresh the Telegram snapshot. If parsing fails, the previous snapshot is preserved.
2. Run `npm run verify:snapshot` to confirm the saved fallback dataset is non-empty.
3. If you want the dashboard to prefer current Supabase data, run `node scripts/seed_supabase.js`.
4. Run `npm run build`.
5. Run `npm run start` for the production web server.
6. Confirm `GET /health` returns `200` before pointing uptime monitoring at the deployment.
7. Open the dashboard and confirm the source badge shows `Live`, `Verified snapshot`, or `Verified backup`, and that listings render in the grid.

## Reliability rules

- The frontend checks Supabase first.
- If Supabase errors, times out, or returns no rows, the frontend loads `public/data.json`.
- If the snapshot is unavailable or empty, the frontend loads the bundled backup dataset.
- The scraper only overwrites `public/data.json` when at least one valid listing was extracted.

## Production: how sabaisabai-airdnd.pages.dev deploys (since 2026-10-17)

The public site is a **static Cloudflare Pages site with no Supabase dependency**
(Supabase restricted the project's org on 2026-10-18). Everything runs on the M3 at $0.

| Piece | Where |
|---|---|
| Site | Pages project `sabaisabai-airdnd` (Direct Upload via wrangler, **no** git integration) |
| Photos | Pages project `airdnd-media` → `https://airdnd-media.pages.dev/listing-photos/<key>` |
| Listings / feed data | M3 Postgres `airdnd` (`DATABASE_URL`, default `postgresql://localhost:5432/airdnd`) |
| Photo files | `/Volumes/Data/AirDnD/photos` (intake) + `/Volumes/Data/AirDnD/exports/storage-20261016-1121/objects` |

**Automatic publishing.** The LaunchAgent `org.nonarkara.airdnd-publish`
(`scripts/launchd/`) runs `scripts/publish_snapshot.sh` every 2 minutes from the
deploy checkout `/Volumes/Data/AirDnD/deploy/airdnd-platform`. It fast-forwards to
`origin/main`, rebuilds `public/data.json` + `public/feed.json` from Postgres (plus
the Firestore delta while the old cloud intake still writes there), and — only when
the content changed, and at most every 10 minutes — publishes new photos
(`npm run media:sync`), builds, and deploys. Logs: `/Volumes/Data/AirDnD/logs/publish*.log`.
So **merging to `main` is deploying**.

**Guard.** `npm run build` runs `scripts/guard_no_supabase.js` first and the publisher
runs it again on `dist/` (`--dist`). It refuses to build or deploy if `src/` imports
`@supabase/*` or contains a `*.supabase.co` URL, or if a snapshot or the bundle does.
Photos must point at `airdnd-media.pages.dev` (`src/lib/media.js` rewrites legacy URLs).

**Manual deploy** (from the M3): `npm run deploy` (guarded build + `wrangler pages deploy dist`),
or `npm run build:full` to refresh data + photos first. Never deploy from another branch.

**Intake.** `scripts/telegram_scraper.js`, `telegram_bot.js` and `photo_storage.js` write to the
local Postgres (`scripts/lib/local_db.js`) and photo files to `PHOTO_ROOT`. The M3 LaunchAgent
`org.nonarkara.airdnd-intake` is prepared but needs the Telegram credentials in
`/Volumes/Data/AirDnD/intake/airdnd-platform/.env`, and the Render worker must be stopped first
(one Telegram session can only run in one place).
