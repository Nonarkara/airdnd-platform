# Sabai Sabai — Community Intelligence Platform

This is a **real-time community intelligence system** that mines information from Telegram channels, extracts structured data using AI, and presents it as a living dashboard. The massage/spa directory is the proof-of-concept case study. The real goal is a generalizable platform for **any domain where community-sourced information creates value** — citizen reporting, healthcare directories, job marketplaces, demand-supply matching.

---

## The Vision

The system demonstrates that one person, owning zero hardware, can build and operate a real-time data collection and intelligence platform using only AI services and free-tier cloud infrastructure. Citizens or community members send information through messaging platforms (Telegram in this case). The system automatically extracts, normalizes, deduplicates, and presents that information as actionable intelligence for decision-makers who need to mobilize resources — whether to solve problems, serve clients, or understand market dynamics.

The massage parlor case study was chosen because: easy to find data sources, high posting volume, rich structured information (names, locations, phone numbers, hours, photos), and provides a safe sandbox to develop content screening (spam, pornography, trolling) before applying the system to more consequential domains.

---

## Who Built This

**Dr Non Arkaraprasertkul** — PhD Anthropologist (Harvard), Architect (MIT), Modern Chinese Studies (Oxford). Senior Expert at Thailand's depa. Not a software engineer — relies entirely on Claude Code for development. Thinks architecturally, designs from first principles, evaluates on live deployed URLs.

---

## Architecture

### Data Pipeline (Backend)

```
Telegram Channels (12 sources)
    ↓ every 30 seconds
Telegram Scraper (scripts/telegram_scraper.js)
    ↓ clusters messages by sender + time
    ↓ downloads ALL photos
    ↓ deterministic text parser extracts: name, phone, hours, price, LINE, Maps, Telegram links
    ↓ Gemini AI enrichment adds: description, user ratings, service quality tags, feedback
    ↓ second-pass "sweeper" catches anything parser missed from raw text
    ↓ NSFW text screening flags unsafe clusters (is_safe_image = false)
    ↓ phone-based dedup (same phone = same business, regardless of post name)
    ↓ quality gate rejects spam, numeric names, short descriptions
    ↓
Supabase (PostgreSQL)                     Google Sheets (backup)
├── companions (listings)                 ├── Listings tab (all fields)
├── channel_messages (raw archive)        ├── Summary tab (BI stats)
├── photo_archive (metadata)              └── Auto-refreshes hourly via Apps Script
├── page_views (analytics)
└── Supabase Storage (photo files)        Google Drive (photo backup)

    ↓ Telegram Bot pushes notifications for new listings
    ↓ data.json snapshot for frontend fallback
    ↓
Frontend (React + Vite)
    ↓ Supabase real-time subscription (primary)
    ↓ data.json fallback (if Supabase times out)
    ↓
Cloudflare Pages (static deploy)
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/telegram_scraper.js` | Main data pipeline — polls Telegram, extracts, enriches, archives |
| `scripts/listing_pipeline.js` | Normalization, dedup (phone + name + fuzzy), quality gate, sweeper, Supabase insert |
| `scripts/photo_storage.js` | Photo download, structured local storage, Supabase Storage upload, metadata archive |
| `scripts/notify.js` | Push new listings to owner's Telegram |
| `scripts/google_export.js` | Upload photos to Drive, append rows to Sheets (uses OAuth token.json) |
| `scripts/daemon.sh` | Persistent process manager with log rotation and exponential backoff |
| `scripts/userbot.js` | Interactive Telegram session auth (handles AUTH_KEY_DUPLICATED) |
| `scripts/google_reauth.js` | Google OAuth re-auth flow (opens browser, catches redirect) |
| `scripts/google_apps_script.js` | Google Apps Script for the BI Dashboard sheet (runs hourly in Google) |
| `src/App.jsx` | Main frontend — routes, data loading, real-time subscription |
| `src/lib/listings.js` | Frontend normalization — city extraction, tag validation, field passthrough |
| `src/lib/tracker.js` | Page view tracking (probes table, disables if missing) |
| `src/components/CompanionCard.jsx` | Listing card — horizontal data row with photo strip |
| `src/components/CompanionModal.jsx` | Detail modal — escape key, focus trap, NSFW gate |
| `src/components/ListingMap.jsx` | Leaflet map with area-based pin placement |
| `src/components/Analytics.jsx` | Industry intelligence page (/analytics) |
| `src/components/Methodology.jsx` | Research paper page (/methodology) |

---

## Design Philosophy (for this project)

### Current Aesthetic: Dieter Rams — "Less But Better"

The design evolved through several phases: 1964 Olympics → Coen Brothers → Tesla → Dieter Rams. The current and final direction is radical reduction:

- **Zero border-radius** on any non-circular element. Sharp edges communicate precision.
- **Zero gradients**. Flat colors only. No cosmetic decoration.
- **Zero box-shadows** (except modal overlay which needs functional depth).
- **Lines only where they divide, direct, or communicate**. No decorative borders.
- **Typography and whitespace create hierarchy**, not boxes or backgrounds.
- **Color for meaning only**: orange (#ff7440) = action/accent, blue (#9fc2ff) = secondary data, green (#34d399) = status/success.

### Typography

- Display: **Space Grotesk** — geometric with distinctive numerals that feel like instrument panels
- Body: **Inter** — industry standard for UI text
- The Thai script mixed with the instrument-panel layout creates unexpected beauty

### The Singular Design Move

Horizontal data rows instead of photo cards. Each listing is a single scannable line — like a flight departure board, not Airbnb. This is the thing a Red Dot judge would remember. "This is intelligence, not a catalog."

---

## Content Screening

The system collects everything but displays only safe content:

- **All data saved** — photos, raw text, metadata all kept in Supabase for model training
- **`is_safe_image` flag** on each listing — defaults to `true`, set to `false` by:
  - Automated text-pattern detection (Thai + English explicit keywords)
  - Manual flagging via Supabase admin
- **Frontend gates** — CompanionCard, CompanionModal, and HeroSection all check `isSafeImage` before rendering any image
- **Flagged listings still show** — name, phone, hours, contact info all visible, only the photo is hidden

This screening system is a prototype for the larger goal: filtering trolling, spam, misinformation, and inappropriate content from citizen-reported data before it reaches decision-makers.

---

## Deduplication Strategy

Three-layer dedup, checked in order:

1. **Phone-based** (strongest signal) — same phone number = same business, regardless of post name. Catches cases like LOUISSPA posting under 18 different staff names.
2. **Exact name+location** — identical business name at identical location
3. **Fuzzy name** — normalized name comparison (strips Thai prefixes like ร้าน, requires 10+ char match for substring)

Phone-based dedup was the critical insight from analyzing the collected data. Without it, one business with phone 0838506969 created 18 separate entries.

---

## Deployment

| Platform | Use | Cost |
|----------|-----|------|
| **Cloudflare Pages** | Frontend static hosting | Free |
| **Supabase** | PostgreSQL + Storage + Realtime | Free tier |
| **Google Sheets** | Data backup (Apps Script hourly refresh) | Free |
| **Google Drive** | Photo backup | Free |
| **Telegram API** | Data source (scraper) + notifications (bot) | Free |
| **Google Gemini** | AI extraction and enrichment | Free tier |

Total monthly cost: **$0**

The daemon runs locally via macOS launchd (`~/Library/LaunchAgents/com.sabai.scraper.plist`). For production: deploy worker to Render (render.yaml configured).

### Deploying to Cloudflare Pages

```bash
# Refresh snapshot from Supabase
node -e "... (pull from companions table, write to public/data.json)"

# Build
npx vite build

# Add SPA redirect
echo "/*    /index.html   200" > dist/_redirects

# Deploy
npx wrangler pages deploy dist --project-name sabaisabai-airdnd
```

Live URL: `https://sabaisabai-airdnd.pages.dev`

### Deploying the scraper to Render

The `render.yaml` has two services:
- `airdnd-platform` (web) — serves the built frontend
- `airdnd-live-intake` (worker) — runs `npm run scrape:watch` continuously

---

## Database Schema (Supabase)

### companions (listings)
Core fields: `id`, `name`, `location`, `city`, `price`, `description`, `image_url`, `tags`, `metrics`
Contact: `phone`, `hours`, `line_url`, `telegram_url`, `maps_url`
BI: `raw_text`, `source_message_ids`, `photo_urls`, `drive_photo_urls`, `user_rating`, `service_tags`, `discussion_notes`
Meta: `source_channel`, `mention_count`, `is_safe_image`, `latitude`, `longitude`, `created_at`, `updated_at`

### channel_messages (raw archive)
Every Telegram message stored regardless of listing extraction. Classified by `message_type`: listing, discussion, feedback, admin, spam, unknown.

### photo_archive (photo metadata)
Every photo with: `original_filename`, `stored_filename`, `supabase_url`, `local_path`, `file_size_bytes`, `media_type`

### page_views (visitor tracking)
Session-based analytics with geolocation.

---

## Environment Variables (.env)

```
TELEGRAM_BOT_TOKEN=...
GEMINI_API_KEY=...
TELEGRAM_API_ID=...
TELEGRAM_API_HASH=...
TELEGRAM_SESSION=... (from userbot.js interactive auth)
TELEGRAM_NOTIFY_CHAT_ID=... (owner's Telegram user ID for push notifications)
VITE_SUPABASE_URL=https://fehdtfncbutesgadjsxp.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_SHEET_ID=...
```

Google OAuth: `credentials.json` + `token.json` (refresh via `node scripts/google_reauth.js`)
Supabase Management API: token via `npx supabase login`

---

## How To Resume Work

1. **Check scraper**: `ps aux | grep telegram_scraper` — if not running, start with `./scripts/daemon.sh`
2. **Check data freshness**: compare Supabase timestamps vs `public/data.json`
3. **Refresh snapshot**: pull from Supabase → write to `data.json` → build → deploy
4. **Re-auth Telegram**: if AUTH_KEY_DUPLICATED, run `node scripts/userbot.js`
5. **Re-auth Google**: if token expired, run `node scripts/google_reauth.js`

---

## What This System Can Become

The massage directory is Case Study #1. The same architecture applies to:

- **Citizen Reporting Platform** — citizens send reports (potholes, flooding, safety issues) via Telegram → AI extracts location, severity, category → dashboard shows where to mobilize resources
- **Healthcare Directory** — community health groups share clinic info → structured directory with contact details, hours, specializations
- **Job Marketplace** — workers and employers post in industry channels → matched listings with skills, locations, pay rates
- **Restaurant/Food Discovery** — food community groups share recommendations → real-time directory with photos, prices, locations
- **Any community that talks about supply can be turned into a platform that connects demand**

The key insight: the AI extraction pipeline (Telegram → Gemini → structured data) is domain-agnostic. Change the source channels, adjust the extraction prompt, and the same system mines intelligence from any community.

---

## Red Dot Design Award

This project is being submitted to Red Dot Award: Brands & Communication Design 2026 (digital interfaces category). Entry deadline: May 8, 2026. The narrative: "Community intelligence at zero marginal cost."

What judges should notice:
- The horizontal data rows (no one does this for a directory)
- Space Grotesk numerals on instrument-panel dark background
- Thai script mixed with Western typographic precision
- The `/methodology` page explaining the AI-as-a-Service concept
- Zero decoration — every pixel earns its place
