@echo off
REM ============================================================================
REM  OpenClaw — one-click WSL launcher for Windows.
REM
REM  Double-click this file (or run it from a shortcut) to open your WSL
REM  distro and start the OpenClaw gateway. No need to remember WSL commands.
REM
REM  Setup once:
REM    1. Clone agency-agents inside WSL, e.g.  ~/agency-agents
REM    2. If your repo lives elsewhere, edit OPENCLAW_DIR below.
REM ============================================================================

REM Path to the openclaw folder *inside WSL* (Linux-style path).
set "OPENCLAW_DIR=~/agency-agents/openclaw"

echo.
echo   Opening WSL and starting OpenClaw...
echo   (Scan the QR code that appears with WhatsApp - Linked devices)
echo.

REM -lic = login + interactive so PATH (node, claude) is loaded from your profile.
wsl.exe -e bash -lic "cd %OPENCLAW_DIR% && ./scripts/openclaw.sh"

echo.
echo   OpenClaw stopped. Press any key to close.
pause >nul
