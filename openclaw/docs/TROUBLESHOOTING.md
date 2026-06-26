# OpenClaw — Troubleshooting

Run `npm run doctor` first — it catches most issues automatically.

---

### The QR code never appears / gateway exits immediately

- **Missing Chromium libraries** (most common on WSL/Ubuntu). Install them:
  ```bash
  sudo apt-get update && sudo apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpangocairo-1.0-0
  ```
- **`.env` missing** — copy it: `cp .env.example .env`.

### QR code is unreadable in the terminal

Make the terminal window larger / reduce the font size so the whole code fits,
then restart the gateway. The code refreshes periodically.

### "Could not launch claude" / agent errors with ENOENT

Claude Code isn't installed or isn't on PATH in the shell that started OpenClaw.

```bash
npm install -g @anthropic-ai/claude-code
claude --version            # should print a version
claude                      # run once to log in
```

If `claude` lives somewhere unusual, set `OPENCLAW_CLAUDE_BIN=/full/path/to/claude`
in `.env`. The `openclaw.bat` launcher uses a **login** shell (`bash -lic`)
specifically so your PATH is loaded — if you start the gateway some other way,
make sure `claude` is on PATH.

### Messages are ignored / no reply

- Your number isn't in `OPENCLAW_ALLOWED_NUMBERS`. Use **digits only**, full
  international format, no `+`. The terminal logs
  `Ignored message from unauthorized number …` — copy that number into `.env`.
- **Group chats and status updates are ignored by design.** Message the linked
  number in a 1:1 chat.
- Only **text** messages are handled (no images/voice yet).

### Agent replies are slow

Each message launches a fresh `claude -p` run. Big tasks take time. OpenClaw
sends a "🐾 …is on it" ack and shows the typing indicator while it works. Raise
`OPENCLAW_TIMEOUT_SECONDS` for long jobs.

### Agent won't actually edit files / run commands

Increase the permission level in `.env`:

```env
OPENCLAW_PERMISSION_MODE=bypass     # fully autonomous (in OPENCLAW_WORKDIR)
```

…and make sure `OPENCLAW_WORKDIR` points at the project you want changed. Only
use `bypass` in a directory you trust an agent to act in.

### It forgot our earlier conversation

Each chat keeps a resumable session. `/reset` clears it. Restarting the gateway
keeps sessions only if the underlying Claude session store persists; if memory
seems lost after a restart, just continue — a new session starts cleanly.

### Voice notes aren't transcribed

OpenClaw replies "No transcriber configured" because no speech-to-text engine is
available. Fix either way:

```bash
# Option 1: install Whisper (auto-detected)
sudo apt-get install -y ffmpeg
pip install -U openai-whisper

# Option 2: point at your own engine in .env
OPENCLAW_TRANSCRIBE_CMD=whisper-cpp -f {file} -nt
```

If Whisper is slow, use a smaller model: `OPENCLAW_WHISPER_MODEL=tiny`. Confirm
with `npm run doctor`. Images don't need any of this.

### Images aren't analyzed

The agent must be allowed to read the saved file. Images land in
`<workdir>/.openclaw-media/`. If replies say it can't open the file, make sure
`OPENCLAW_PERMISSION_MODE` is at least `acceptEdits` (the default) so the Read
tool isn't blocked, and that the gateway has write access to the media dir.

### The 24/7 service won't start / starts then dies

- **Link WhatsApp interactively first.** A service can't scan a QR code. Run
  `./scripts/openclaw.sh` once, scan, then install the service.
- Check logs: `pm2 logs openclaw` or `journalctl --user -u openclaw -f`.
- `claude` not found from the service usually means PATH. The systemd template
  bakes in your PATH at install time — re-run `./scripts/service.sh systemd`
  after fixing your PATH, or set `OPENCLAW_CLAUDE_BIN` to the full path in `.env`.
- WSL2 + systemd: if it stops when you log out, ensure lingering is on:
  `loginctl enable-linger "$USER"`.

### Revoke access / unlink WhatsApp

On your phone: **WhatsApp → Linked devices → tap the device → Log out.** That
instantly cuts OpenClaw off. To re-link, restart the gateway and scan again.

### Reset everything

```bash
rm -rf .wwebjs_auth .wwebjs_cache   # forget the WhatsApp link
# .env stays; edit it if needed, then restart and re-scan the QR
```

---

Still stuck? Open an issue on the repo with the terminal output (redact your
phone number).
