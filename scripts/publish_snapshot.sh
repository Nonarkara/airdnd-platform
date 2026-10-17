#!/bin/bash
# publish_snapshot.sh — keep https://sabaisabai-airdnd.pages.dev within minutes
# of the Telegram intake, at $0.
#
# Run every few minutes by the M3 LaunchAgent org.nonarkara.airdnd-publish
# (see scripts/launchd/). Each run:
#   1. fast-forwards the deploy checkout to origin/main (code changes ship too)
#   2. rebuilds public/data.json + feed.json from local Postgres
#      (+ the Firestore delta while the cloud intake still writes there)
#   3. exits quietly if the listings/feed content did not change
#   4. publishes newly referenced photos to airdnd-media (pruning any it cannot serve)
#   5. builds behind guard:no-supabase and deploys with wrangler (Direct Upload)
# Deploys are spaced at least MIN_DEPLOY_INTERVAL seconds apart (default 600).
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

REPO="${AIRDND_DEPLOY_DIR:-/Volumes/Data/AirDnD/deploy/airdnd-platform}"
STATE_DIR="${AIRDND_STATE_DIR:-/Volumes/Data/AirDnD/state}"
LOG_DIR="${AIRDND_LOG_DIR:-/Volumes/Data/AirDnD/logs}"
MIN_DEPLOY_INTERVAL="${MIN_DEPLOY_INTERVAL:-600}"
SITE_URL="https://sabaisabai-airdnd.pages.dev"
mkdir -p "$STATE_DIR" "$LOG_DIR"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %z')] $*"; }

LOCK="$STATE_DIR/publish.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then rm -rf "$LOCK"; mkdir "$LOCK"; else exit 0; fi
fi
trap 'rm -rf "$LOCK"' EXIT

now=$(date +%s)
last=$(cat "$STATE_DIR/last_deploy_epoch" 2>/dev/null || echo 0)
if [ $((now - last)) -lt "$MIN_DEPLOY_INTERVAL" ]; then exit 0; fi

cd "$REPO" || { log "deploy dir missing: $REPO"; exit 1; }
git checkout -q -- public/data.json public/feed.json public/feed_meta.json public/funnel.json public/data/place_photos public/data/place_photos_index.json 2>/dev/null
git clean -fdq -- public/data/place_photos 2>/dev/null
before=$(git rev-parse HEAD)
git fetch -q origin main && git merge -q --ff-only origin/main || log "warn: could not fast-forward to origin/main"
after=$(git rev-parse HEAD)
# Reinstall only when dependencies changed (npm ci is slow on this link).
if [ ! -d node_modules ] || ! git diff --quiet "$before" "$after" -- package-lock.json; then
  log "code changed ($before -> $after) — npm ci"
  npm ci --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 || { log "npm ci failed"; exit 1; }
fi

node scripts/refresh_public_snapshot.js > "$LOG_DIR/publish-refresh.log" 2>&1 || { log "snapshot refresh failed (see publish-refresh.log)"; exit 1; }
node scripts/refresh_feed_snapshot.js >> "$LOG_DIR/publish-refresh.log" 2>&1 || log "warn: feed refresh failed — keeping previous feed.json"
if ! node scripts/build_place_photos.js >> "$LOG_DIR/publish-refresh.log" 2>&1 \
  || node -e "process.exit(require('./public/data/place_photos_index.json').meta?.degraded ? 0 : 1)"; then
  log "warn: place galleries failed — keeping committed shards"
  git clean -fdq -- public/data/place_photos 2>/dev/null
  git checkout -q -- public/data/place_photos public/data/place_photos_index.json
fi

content_hash=$( (cat public/data.json; node -e "const f=require('./public/feed.json');const g=require('./public/data/place_photos_index.json');delete g.meta.generatedAt;process.stdout.write(JSON.stringify([f,g]))" ) | shasum -a 256 | cut -d' ' -f1)
if [ "$content_hash" = "$(cat "$STATE_DIR/last_content_hash" 2>/dev/null)" ] && [ "$before" = "$after" ]; then
  exit 0
fi
latest=$(node -e "const d=require('./public/data.json');console.log(d.map(x=>x.postedAt||x.updatedAt||'').sort().pop())")
log "new content (latest listing $latest) — publishing"

node scripts/sync_media.js --prune-snapshots >> "$LOG_DIR/publish-media.log" 2>&1 || { log "media sync failed (see publish-media.log)"; exit 1; }
npm run build > "$LOG_DIR/publish-build.log" 2>&1 || { log "build failed (see publish-build.log)"; exit 1; }
node scripts/guard_no_supabase.js --dist >> "$LOG_DIR/publish-build.log" 2>&1 || { log "guard refused dist"; exit 1; }
npx wrangler pages deploy dist --project-name sabaisabai-airdnd --branch main \
  --commit-hash "$after" --commit-message "auto snapshot $latest" >> "$LOG_DIR/publish-deploy.log" 2>&1 \
  || { log "wrangler deploy failed (see publish-deploy.log)"; exit 1; }

echo "$now" > "$STATE_DIR/last_deploy_epoch"
echo "$content_hash" > "$STATE_DIR/last_content_hash"
sleep 20
live_latest=$(curl -s "$SITE_URL/data.json?ts=$now" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const d=JSON.parse(s);console.log(d.map(x=>x.postedAt||x.updatedAt||'').sort().pop())})")
log "deployed · live latest listing $live_latest"
