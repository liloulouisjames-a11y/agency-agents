#!/usr/bin/env bash
# OpenClaw one-time setup for WSL / Linux / macOS.
# Installs dependencies, creates your .env, and (optionally) installs the
# Agency agents into Claude Code so the CLI can use them natively too.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$HERE/.." && pwd)"
cd "$HERE"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }

bold "🐾 OpenClaw setup"
echo

# 1. Node.js -----------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  warn "Node.js not found."
  echo "  Install it first, e.g.:"
  echo "    sudo apt update && sudo apt install -y nodejs npm   # quick"
  echo "    # or, recommended, use nvm: https://github.com/nvm-sh/nvm"
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  warn "Node $(node -v) is too old; OpenClaw needs Node 18+."
  exit 1
fi
ok "Node $(node -v)"

# 2. Chromium system libs (WSL/Ubuntu often misses these for puppeteer) ------
if command -v apt-get >/dev/null 2>&1; then
  MISSING=""
  for lib in libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
             libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0; do
    dpkg -s "$lib" >/dev/null 2>&1 || MISSING="$MISSING $lib"
  done
  if [ -n "$MISSING" ]; then
    warn "Some Chromium libraries are missing (needed by WhatsApp/puppeteer)."
    echo "  Install them with:"
    echo "    sudo apt-get update && sudo apt-get install -y$MISSING"
    echo "  (Setup will continue; install these if the gateway fails to start.)"
  else
    ok "Chromium system libraries present"
  fi
fi

# 3. npm install -------------------------------------------------------------
bold "Installing npm dependencies…"
npm install
ok "Dependencies installed"

# 4. .env --------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from template"
  warn "Edit .env and set OPENCLAW_ALLOWED_NUMBERS to your WhatsApp number (digits only)."
else
  ok ".env already exists (left untouched)"
fi

# 5. Install Agency agents into Claude Code (optional) -----------------------
CLAUDE_AGENTS_DIR="$HOME/.claude/agents"
echo
read -r -p "Install the Agency agents into Claude Code at $CLAUDE_AGENTS_DIR? [Y/n] " ans || ans="y"
case "${ans:-y}" in
  [nN]*) warn "Skipped installing agents into Claude Code." ;;
  *)
    mkdir -p "$CLAUDE_AGENTS_DIR"
    # Copy every category's agent markdown files.
    find "$REPO_ROOT" -maxdepth 2 -name '*.md' \
      -not -path "$HERE/*" -not -name 'README.md' -not -name 'CONTRIBUTING.md' \
      -exec cp {} "$CLAUDE_AGENTS_DIR/" \; 2>/dev/null || true
    COUNT="$(find "$CLAUDE_AGENTS_DIR" -name '*.md' | wc -l | tr -d ' ')"
    ok "Installed agents into Claude Code ($COUNT files)"
    ;;
esac

echo
bold "Next steps"
echo "  1. Make sure Claude Code is installed and logged in:  claude"
echo "  2. Check everything:                                  npm run doctor"
echo "  3. Start the gateway:                                 ./scripts/openclaw.sh"
echo "  4. Scan the QR code with WhatsApp → Linked devices."
echo
ok "Setup complete."
