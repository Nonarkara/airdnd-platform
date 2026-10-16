#!/bin/bash
# Sabai Sabai — persistent scraper + bot daemon
# Restarts automatically if either process crashes.
# Run with: tmux new -s sabai './scripts/daemon.sh'

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

SCRAPER_LOG="$DIR/logs/sabai-scraper.log"
BOT_LOG="$DIR/logs/sabai-bot.log"
BOT_PID_FILE="/tmp/sabai-bot.pid"
MAX_LOG_BYTES=10485760  # 10MB
BACKOFF=10
MAX_BACKOFF=300
RESTART_COUNT=0

cleanup() {
  echo "[$(date)] Stopping Sabai services..."
  [ -f "$BOT_PID_FILE" ] && kill "$(cat "$BOT_PID_FILE")" 2>/dev/null && rm -f "$BOT_PID_FILE"
  exit 0
}
trap cleanup SIGINT SIGTERM

rotate_log() {
  local logfile="$1"
  if [ -f "$logfile" ]; then
    local size
    size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null || echo 0)
    if [ "$size" -gt "$MAX_LOG_BYTES" ]; then
      mv "$logfile" "${logfile}.old"
      echo "[$(date)] Log rotated: $logfile ($size bytes)" > "$logfile"
    fi
  fi
}

start_bot() {
  if [ -f "$BOT_PID_FILE" ] && kill -0 "$(cat "$BOT_PID_FILE")" 2>/dev/null; then
    return  # Already running
  fi
  node scripts/telegram_bot.js >> "$BOT_LOG" 2>&1 &
  echo $! > "$BOT_PID_FILE"
  echo "[$(date)] Bot started (PID: $(cat "$BOT_PID_FILE"))"
}

echo "=== Sabai Sabai Daemon ==="
echo "Directory: $DIR"
echo "Started at: $(date)"

start_bot

# Main loop: keep the scraper running forever
while true; do
  rotate_log "$SCRAPER_LOG"
  rotate_log "$BOT_LOG"

  echo "[$(date)] Starting scraper in watch mode (backoff: ${BACKOFF}s)..."
  node scripts/telegram_scraper.js --watch >> "$SCRAPER_LOG" 2>&1
  EXIT_CODE=$?

  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "[$(date)] Scraper exited (code $EXIT_CODE, restart #$RESTART_COUNT). Waiting ${BACKOFF}s..."

  # Backoff: double on crash, reset on clean exit
  if [ "$EXIT_CODE" -eq 0 ]; then
    BACKOFF=10
    RESTART_COUNT=0
  else
    BACKOFF=$((BACKOFF * 2))
    [ "$BACKOFF" -gt "$MAX_BACKOFF" ] && BACKOFF=$MAX_BACKOFF
  fi

  # Safety: if 10+ restarts in a row, pause for 10 minutes
  if [ "$RESTART_COUNT" -ge 10 ]; then
    echo "[$(date)] Too many restarts ($RESTART_COUNT). Pausing for 10 minutes..."
    sleep 600
    RESTART_COUNT=0
    BACKOFF=10
  fi

  sleep "$BACKOFF"
  start_bot  # Restart bot if it died
done
