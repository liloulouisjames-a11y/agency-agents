# OpenClaw — Full Setup Guide (WSL + WhatsApp)

This walks you from a fresh Windows + WSL machine to texting your agents. Linux
and macOS users can skip the WSL-specific bits — the gateway steps are identical.

---

## 1. Get WSL ready (Windows only)

If you don't already have WSL:

```powershell
# In an admin PowerShell
wsl --install
```

Reboot if prompted. This installs Ubuntu by default. Open **Ubuntu** from the
Start menu to get a Linux shell.

> Already on WSL? Just open your distro.

---

## 2. Install Node.js 18+ (inside WSL)

The recommended way is `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
# restart the shell, then:
nvm install --lts
node -v   # should print v18+ or newer
```

Quick alternative (system packages):

```bash
sudo apt update && sudo apt install -y nodejs npm
```

---

## 3. Install & log in to Claude Code

OpenClaw drives the Claude Code CLI, which is what makes your agents "free"
(they use your existing Claude plan).

```bash
npm install -g @anthropic-ai/claude-code
claude            # run once; follow the login prompt, then exit
```

Confirm it works:

```bash
claude --version
```

---

## 4. Get the Agency repo

```bash
cd ~
git clone https://github.com/msitarzewski/agency-agents.git
cd agency-agents/openclaw
```

> Using your own fork? Clone that instead. The path you land in is what you'll
> put in `openclaw.bat` later.

---

## 5. Run setup

```bash
./scripts/setup.sh
```

This will:

- check Node,
- warn about any missing Chromium libraries (WhatsApp uses a headless browser),
- run `npm install`,
- create `.env` from the template,
- optionally copy all Agency agents into `~/.claude/agents/`.

If it warns about missing libraries, install them:

```bash
sudo apt-get update && sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpangocairo-1.0-0
```

---

## 6. Configure `.env`

```bash
nano .env
```

At minimum set your number (international format, **digits only**):

```env
OPENCLAW_ALLOWED_NUMBERS=14155550123
```

Optional but useful:

```env
# Where agents do their work. Point at a real project to get things built.
OPENCLAW_WORKDIR=/home/you/projects/my-app

# Let agents act autonomously in that folder (no per-action approval).
# Powerful + risky — only with a workdir you trust.
OPENCLAW_PERMISSION_MODE=bypass

# Start every chat with a specialist already active.
OPENCLAW_DEFAULT_AGENT=frontend-developer
```

---

## 7. Verify

```bash
npm run doctor
```

Fix anything it flags, then re-run until everything is ✓.

---

## 8. Launch and link

```bash
./scripts/openclaw.sh
```

A QR code prints in the terminal. On your phone:

**WhatsApp → Settings → Linked devices → Link a device → scan the QR.**

You'll see `✅ OpenClaw is live`. Text yourself `/help`.

The WhatsApp session is saved in `.wwebjs_auth/`, so next time it starts
without a QR.

---

## 9. One-click launch on Windows (optional)

Back in Windows, edit `openclaw.bat` if your repo isn't at `~/agency-agents`:

```bat
set "OPENCLAW_DIR=~/agency-agents/openclaw"
```

Then double-click `openclaw.bat` any time to open WSL and start the gateway.
Make a desktop shortcut to it for true one-click access.

---

## 9b. Enable voice notes (optional)

Images work with no extra setup. To accept **voice notes**, OpenClaw needs a
transcriber. The simplest free option is OpenAI Whisper:

```bash
# needs Python 3 + ffmpeg
sudo apt-get install -y ffmpeg
pip install -U openai-whisper
```

OpenClaw detects `whisper` automatically. Pick model size in `.env`
(`OPENCLAW_WHISPER_MODEL=tiny|base|small|medium|large`; bigger = more accurate,
slower). Prefer a different engine (whisper.cpp, a local ASR server)? Set:

```env
OPENCLAW_TRANSCRIBE_CMD=whisper-cpp -f {file} -nt
```

`{file}` is replaced with the audio path; the command must print the transcript
to stdout. Run `npm run doctor` to confirm transcription is wired up.

---

## 10. Keep it running 24/7

First link WhatsApp **once interactively** so the session is saved:

```bash
./scripts/openclaw.sh     # scan the QR, confirm "OpenClaw is live", Ctrl+C
```

Then install it as a background service with the helper script:

```bash
# Option A — pm2 (simplest, works on WSL/Linux/macOS)
./scripts/service.sh pm2
pm2 startup               # run the command it prints, to survive reboots

# Option B — systemd --user service (Linux / WSL2 with systemd)
./scripts/service.sh systemd

# Manage it
./scripts/service.sh status
./scripts/service.sh stop
```

Logs:

```bash
pm2 logs openclaw                       # pm2
journalctl --user -u openclaw -f        # systemd
```

> WSL note: WSL stops when Windows sleeps/shuts down. The `systemd` option
> enables *lingering* so OpenClaw keeps running when you log out, but for true
> always-on use an always-on machine or a small Linux VM is more reliable than a
> laptop on WSL.

---

That's it. You now have a free, private, remote-controllable agency in your
pocket. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if anything misbehaves.
