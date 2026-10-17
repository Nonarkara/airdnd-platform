#!/bin/bash
# Sabai Sabai — M3 Air local-AI setup (run ONCE on the always-on M3 Air).
# Installs Ollama, pulls the 16GB-safe model, keeps the daemon warm 24/7.
# The scraper (wherever it runs) then enriches listings for $0 via:
#   LOCAL_AI_URL=http://<this-m3>.local:11434
#   LOCAL_AI_MODEL=gemma3n:e4b
#   AI_ENRICHMENT_PER_CYCLE=10
# SECURITY: binds localhost by default. For LAN/Tailscale access set
# OLLAMA_HOST=0.0.0.0:11434 below — home LAN / tailnet only, NEVER port-forward.
set -euo pipefail

MODEL="${LOCAL_AI_MODEL:-gemma3n:e4b}"
OLLAMA_HOST_VALUE="${OLLAMA_HOST:-127.0.0.1:11434}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama..."
  brew install ollama
fi

# Daemon-wide context (Ollama serves 4096 regardless of model card otherwise).
launchctl setenv OLLAMA_CONTEXT_LENGTH 65536
launchctl setenv OLLAMA_KEEP_ALIVE 30m
echo "Context 65536 + 30m keep-alive set (survives until Ollama reinstall)."

# Keep `ollama serve` alive via launchd if nothing listens on 11434 yet.
if ! curl -sf -m 3 http://localhost:11434/api/version >/dev/null 2>&1; then
  echo "Installing com.sabai.ollama keep-alive..."
  mkdir -p ~/Library/LaunchAgents
  cat > ~/Library/LaunchAgents/com.sabai.ollama.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.sabai.ollama</string>
  <key>ProgramArguments</key>
  <array><string>$(command -v ollama)</string><string>serve</string></array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>OLLAMA_HOST</key><string>${OLLAMA_HOST_VALUE}</string>
    <key>OLLAMA_CONTEXT_LENGTH</key><string>65536</string>
    <key>OLLAMA_KEEP_ALIVE</key><string>30m</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/sabai-ollama.log</string>
  <key>StandardErrorPath</key><string>/tmp/sabai-ollama.log</string>
</dict>
</plist>
PLIST
  launchctl unload ~/Library/LaunchAgents/com.sabai.ollama.plist 2>/dev/null || true
  launchctl load ~/Library/LaunchAgents/com.sabai.ollama.plist
  sleep 3
fi

echo "Pulling ${MODEL}..."
ollama pull "${MODEL}"

echo "Warming the model (first call is slow, later ones are fast)..."
ollama run "${MODEL}" 'Reply with exactly: {"warm":true}' --verbose=false 2>/dev/null | head -c 200
echo ""

curl -sf -m 5 http://localhost:11434/api/version
echo ""
echo "OK — scraper .env on the intake machine:"
echo "  LOCAL_AI_URL=http://$(hostname -s).local:11434"
echo "  LOCAL_AI_MODEL=${MODEL}"
echo "  AI_ENRICHMENT_PER_CYCLE=10"
