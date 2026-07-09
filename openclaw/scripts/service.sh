#!/usr/bin/env bash
# Install OpenClaw as an always-on background service so it keeps running after
# you close the terminal.
#
#   ./scripts/service.sh pm2       # use pm2 (simplest, cross-platform)
#   ./scripts/service.sh systemd   # use a systemd --user service (Linux/WSL2)
#   ./scripts/service.sh status    # show status
#   ./scripts/service.sh stop      # stop it
#
# IMPORTANT: link WhatsApp once interactively first (./scripts/openclaw.sh and
# scan the QR). After that the saved session lets the service start headlessly.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok() { printf "\033[32m✓ %s\033[0m\n" "$1"; }
warn() { printf "\033[33m! %s\033[0m\n" "$1"; }
die() { printf "\033[31m✗ %s\033[0m\n" "$1"; exit 1; }

ACTION="${1:-}"

ensure_linked() {
  if [ ! -d .wwebjs_auth ]; then
    warn "WhatsApp isn't linked yet."
    warn "Run ./scripts/openclaw.sh once and scan the QR, then re-run this."
    die "No saved WhatsApp session found (.wwebjs_auth missing)."
  fi
}

case "$ACTION" in
  pm2)
    ensure_linked
    command -v pm2 >/dev/null 2>&1 || { bold "Installing pm2…"; npm install -g pm2; }
    pm2 start ecosystem.config.cjs
    pm2 save
    ok "OpenClaw is running under pm2."
    echo "  Survive reboots:  pm2 startup   (run the command it prints)"
    echo "  Logs:             pm2 logs openclaw"
    echo "  Stop:             pm2 stop openclaw"
    ;;

  systemd)
    ensure_linked
    command -v systemctl >/dev/null 2>&1 || die "systemd not available on this system. Use: ./scripts/service.sh pm2"
    NODE_BIN="$(command -v node)" || die "node not found on PATH"
    UNIT_DIR="$HOME/.config/systemd/user"
    mkdir -p "$UNIT_DIR"
    sed -e "s|__OPENCLAW_DIR__|$HERE|g" \
        -e "s|__NODE_BIN__|$NODE_BIN|g" \
        -e "s|__PATH__|$PATH|g" \
        scripts/openclaw.service.template > "$UNIT_DIR/openclaw.service"
    systemctl --user daemon-reload
    systemctl --user enable --now openclaw.service
    # Keep the service alive even when you're logged out (WSL2/Linux).
    command -v loginctl >/dev/null 2>&1 && loginctl enable-linger "$USER" >/dev/null 2>&1 || true
    ok "OpenClaw installed as a systemd --user service."
    echo "  Status:  systemctl --user status openclaw"
    echo "  Logs:    journalctl --user -u openclaw -f"
    echo "  Stop:    systemctl --user stop openclaw"
    ;;

  status)
    if command -v pm2 >/dev/null 2>&1 && pm2 describe openclaw >/dev/null 2>&1; then
      pm2 status openclaw
    elif command -v systemctl >/dev/null 2>&1; then
      systemctl --user status openclaw --no-pager || warn "Not running under systemd."
    else
      warn "No pm2/systemd service found."
    fi
    ;;

  stop)
    command -v pm2 >/dev/null 2>&1 && pm2 delete openclaw >/dev/null 2>&1 && ok "Stopped pm2 service." || true
    if command -v systemctl >/dev/null 2>&1; then
      systemctl --user disable --now openclaw.service >/dev/null 2>&1 && ok "Stopped systemd service." || true
    fi
    ;;

  *)
    bold "OpenClaw service installer"
    echo "Usage: ./scripts/service.sh {pm2|systemd|status|stop}"
    echo
    echo "  pm2      Run under pm2 (simplest, works on WSL/Linux/macOS)"
    echo "  systemd  Run as a systemd --user service (Linux/WSL2 with systemd)"
    echo "  status   Show current status"
    echo "  stop     Stop and remove the service"
    exit 1
    ;;
esac
