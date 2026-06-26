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

## 10. Keep it running (optional)

To keep OpenClaw alive after closing the terminal, run it under a process
manager inside WSL:

```bash
# with pm2
npm install -g pm2
pm2 start src/gateway.js --name openclaw
pm2 save

# or with tmux
tmux new -s openclaw './scripts/openclaw.sh'   # detach with Ctrl+b, d
```

> Note: WSL itself stops when Windows sleeps/reboots unless you enable
> background mode. For 24/7 use, a small Linux VM or always-on machine is more
> reliable than a laptop on WSL.

---

That's it. You now have a free, private, remote-controllable agency in your
pocket. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if anything misbehaves.
