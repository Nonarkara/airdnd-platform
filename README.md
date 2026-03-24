# Air DnD Dashboard

Air DnD is a React + Vite dashboard for Bangkok-first listing intelligence. The app prefers live Supabase data, falls back to `public/data.json` when live data is unavailable, and finally uses bundled backup records if both live and snapshot inputs fail.

## Runtime modes

- `npm run dev`: local Vite development server
- `npm run build`: production build
- `npm run start`: serves the built frontend and static assets only
- `npm run bot`: runs the Telegram bot separately

The web server is intentionally decoupled from the Telegram bot so the UI can stay stable even if Telegram polling or Gemini extraction fails.

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
6. Open the dashboard and confirm the source badge shows `Live`, `Verified snapshot`, or `Verified backup`, and that listings render in the grid.

## Reliability rules

- The frontend checks Supabase first.
- If Supabase errors, times out, or returns no rows, the frontend loads `public/data.json`.
- If the snapshot is unavailable or empty, the frontend loads the bundled backup dataset.
- The scraper only overwrites `public/data.json` when at least one valid listing was extracted.
