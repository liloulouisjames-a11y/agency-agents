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
