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

bold "🐾 Starting OpenClaw…  (Ctrl+C to stop)"
exec node src/gateway.js
