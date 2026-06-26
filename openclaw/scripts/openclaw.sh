#!/usr/bin/env bash
# Start the OpenClaw gateway. This is the "easy open" entry point — it makes
# sure things are set up, then launches the WhatsApp <-> agents bridge.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }

# Auto-setup on first run.
if [ ! -d node_modules ]; then
  warn "Dependencies not installed yet — running setup first."
  bash scripts/setup.sh
fi

if [ ! -f .env ]; then
  cp .env.example .env
  warn "Created .env — edit it to add your WhatsApp number, then re-run."
  exit 1
fi

# Optional launch hook (e.g. warm up Ollama / your runtime). Set
# OPENCLAW_LAUNCH_CMD in .env. Run in the background so a server command
# (e.g. "ollama serve") doesn't block the gateway from starting.
LAUNCH_CMD="$(grep -E '^OPENCLAW_LAUNCH_CMD=' .env 2>/dev/null | head -1 | cut -d= -f2-)"
LAUNCH_CMD="${LAUNCH_CMD%\"}"; LAUNCH_CMD="${LAUNCH_CMD#\"}"
LAUNCH_CMD="${LAUNCH_CMD%\'}"; LAUNCH_CMD="${LAUNCH_CMD#\'}"
if [ -n "$LAUNCH_CMD" ]; then
  bold "Launch hook: $LAUNCH_CMD"
  nohup bash -lc "$LAUNCH_CMD" >/tmp/openclaw-launch.log 2>&1 &
  sleep 1
fi

bold "🐾 Starting OpenClaw…  (Ctrl+C to stop)"
exec node src/gateway.js
