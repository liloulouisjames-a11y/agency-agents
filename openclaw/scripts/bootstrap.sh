#!/usr/bin/env bash
# OpenClaw one-command bootstrap: deps → (optional) Ollama model → interactive
# .env → doctor → launch. The goal: from a fresh WSL/Linux/mac shell to scanning
# the WhatsApp QR with a single command.
#
#   cd openclaw && ./scripts/bootstrap.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "\033[32m✓ %s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }
ask()  { local p="$1" d="${2:-}" a; read -r -p "$p${d:+ [$d]}: " a || true; printf '%s' "${a:-$d}"; }

bold "🐾 OpenClaw bootstrap"
echo

# 1. Base setup (Node check, npm install, .env scaffold, agents → Claude Code) --
bash scripts/setup.sh < /dev/null || true   # non-interactive; ignore its prompt
[ -f .env ] || cp .env.example .env

# 2. Pick the engine ----------------------------------------------------------
echo
bold "Which engine should run your agents?"
echo "  1) Ollama  — local model, fully free (recommended for 'order from my phone')"
echo "  2) Claude Code — uses your Claude subscription"
ENGINE="$(ask 'Choose 1 or 2' '1')"

BACKEND="cli"
if [ "$ENGINE" = "1" ]; then
  BACKEND="ollama"
  if command -v ollama >/dev/null 2>&1; then
    MODEL="$(ask 'Ollama model name to use/build' 'openclaw')"
    if ! ollama list 2>/dev/null | awk '{print $1}' | grep -q "^${MODEL}\(:.*\)\?$"; then
      echo
      if [ "$(ask "Model '$MODEL' not found. Build it now from ollama/Modelfile? (y/n)" 'y')" = "y" ]; then
        ./scripts/build-ollama-model.sh || warn "Model build failed — you can run ./scripts/build-ollama-model.sh later."
      fi
    else
      ok "Ollama model '$MODEL' already present"
    fi
  else
    warn "Ollama isn't installed (https://ollama.com). Falling back to Claude Code."
    warn "Install Ollama later, then set OPENCLAW_BACKEND=ollama in .env."
    BACKEND="cli"
  fi
fi

# 3. Collect your WhatsApp number --------------------------------------------
echo
NUMBER="$(ask 'Your WhatsApp number (digits only, full international, no +)')"
NUMBER="$(printf '%s' "$NUMBER" | tr -cd '0-9')"
[ -n "$NUMBER" ] || { warn "No number entered — you must add OPENCLAW_ALLOWED_NUMBERS to .env before it will respond."; }

CHANNELS="$(ask 'Channels to enable' 'whatsapp')"

# 4. Write the chosen values into .env (idempotent upsert) --------------------
set_env() {
  local key="$1" val="$2"
  if grep -qE "^${key}=" .env; then
    # portable in-place edit
    tmp="$(mktemp)"; sed "s|^${key}=.*|${key}=${val}|" .env > "$tmp" && mv "$tmp" .env
  else
    printf '\n%s=%s\n' "$key" "$val" >> .env
  fi
}
set_env OPENCLAW_BACKEND "$BACKEND"
[ "$BACKEND" = "ollama" ] && set_env OPENCLAW_OLLAMA_MODEL "${MODEL:-openclaw}"
set_env OPENCLAW_CHANNELS "$CHANNELS"
[ -n "$NUMBER" ] && set_env OPENCLAW_ALLOWED_NUMBERS "$NUMBER"
ok "Wrote settings to .env (backend=$BACKEND, channels=$CHANNELS)"

# 5. Doctor -------------------------------------------------------------------
echo
bold "Running doctor…"
node src/doctor.js || warn "Doctor flagged items above — review them, but we'll still try to launch."

# 6. Launch -------------------------------------------------------------------
echo
bold "Starting OpenClaw — scan the QR with WhatsApp → Settings → Linked devices."
echo "(Ctrl+C to stop. Next time, just run ./scripts/openclaw.sh)"
echo
exec ./scripts/openclaw.sh
