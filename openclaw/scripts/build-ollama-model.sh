#!/usr/bin/env bash
# Build the local "openclaw" Ollama model from ollama/Modelfile.
#   ./scripts/build-ollama-model.sh [base-model]
# Optionally pass a base model (default: whatever the Modelfile's FROM says).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

ok() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
die() { printf "\033[31m✗ %s\033[0m\n" "$1"; exit 1; }

command -v ollama >/dev/null 2>&1 || die "Ollama not found. Install it: https://ollama.com"

MODELFILE="ollama/Modelfile"
[ -f "$MODELFILE" ] || die "Missing $MODELFILE"

BASE="${1:-}"
if [ -n "$BASE" ]; then
  # Render a temp Modelfile with the requested base.
  TMP="$(mktemp)"
  sed -E "s|^FROM .*|FROM ${BASE}|" "$MODELFILE" > "$TMP"
  MODELFILE="$TMP"
  echo "Using base model: $BASE"
fi

BASE_PULL="$(grep -E '^FROM ' "$MODELFILE" | head -1 | awk '{print $2}')"
echo "Pulling base model: $BASE_PULL"
ollama pull "$BASE_PULL"

echo "Creating model: openclaw"
ollama create openclaw -f "$MODELFILE"

[ -n "${BASE:-}" ] && rm -f "$MODELFILE"

ok "Built 'openclaw'. Test it:  echo 'hi' | ollama run openclaw"
echo "Then set in .env:  OPENCLAW_BACKEND=ollama  and  OPENCLAW_OLLAMA_MODEL=openclaw"
