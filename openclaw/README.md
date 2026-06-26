# 🐾 OpenClaw — Your Agency, on WhatsApp

> Message your phone. Your AI agents do the work. **Run anywhere, free.**

OpenClaw is a small, self-hosted gateway that links a WhatsApp account to
[The Agency](../README.md)'s 50+ specialist agents through **Claude Code**.
You text a job to your own WhatsApp number; the right specialist picks it up on
your WSL/Linux/Mac machine and texts the result back. Because it drives the
Claude Code CLI you already use, your agents are effectively **free remote
labour** — no paid WhatsApp Business API, no extra subscription.

```
 📱  You (WhatsApp)  ⇄  🐾 OpenClaw gateway (WSL)  ⇄  🤖 Claude Code + Agency agents  ⇄  💻 Your files
```

---

## ✨ What you get

- **Remote control of your agents** — kick off and steer work from your phone,
  anywhere.
- **All 58 Agency specialists** — `/use frontend`, `/use growth-hacker`,
  `/use backend-architect`, … or `@agent` for a one-off.
- **Text, images & voice notes** — send a screenshot for the agent to analyze,
  or dictate a task as a voice note and it's transcribed and acted on.
- **Free & private** — runs on your machine, links WhatsApp by QR (like
  WhatsApp Web). Your messages never touch a third-party bot service.
- **Conversation memory** — each chat keeps a resumable Claude session.
- **Locked to you** — only numbers you allow-list can command your agents.
- **One-click open on Windows** — double-click `openclaw.bat` to launch the
  WSL gateway.
- **Run 24/7** — one command to install it as a pm2 or systemd service.

---

## 🚀 Quick start (WSL / Linux / macOS)

From inside WSL (or any Linux/Mac shell):

```bash
# 1. Get the repo (if you haven't already) and enter the gateway
cd ~/agency-agents/openclaw

# 2. One-time setup: installs deps, creates .env, optionally installs the
#    agents into Claude Code
./scripts/setup.sh

# 3. Tell OpenClaw who's allowed to drive it
nano .env          # set OPENCLAW_ALLOWED_NUMBERS=<your number, digits only>

# 4. Make sure Claude Code is installed and logged in
claude             # log in once if prompted, then quit

# 5. Sanity check
npm run doctor

# 6. Open the gateway
./scripts/openclaw.sh
```

A QR code appears in the terminal. On your phone:
**WhatsApp → Settings → Linked devices → Link a device → scan it.**

Now text yourself `/help` and you're off. 🎉

> **Windows users:** after the one-time WSL setup above, you can just
> double-click **`openclaw.bat`** to open WSL and start the gateway. Edit the
> `OPENCLAW_DIR` line in that file if your repo isn't at `~/agency-agents`.

---

## 💬 Using it from WhatsApp

| Command | What it does |
|---|---|
| `/help` | Show the command list |
| `/agents` | List all specialists you can call |
| `/agents engineering` | List one category |
| `/use frontend` | Switch the active specialist |
| `/whoami` | Show the active specialist |
| `/reset` | Clear conversation memory & active agent |
| `/status` | Show current settings |
| `@growth-hacker give me 5 launch ideas` | Use a specialist for one message only |
| _send an image_ | The agent reads/analyzes it (add a caption to direct it) |
| _send a voice note_ | Transcribed, then run as a task |
| _anything else_ | Send the task to your active agent |

**Example session**

```
You:  /use backend-architect
Bot:  ✅ Switched to Backend Architect.
You:  design a REST API for a todo app with auth, draft the route table
Bot:  🐾 Backend Architect is on it…
Bot:  Here's the route table… (full answer)
You:  now scaffold it in the ~/todo project
Bot:  …
```

---

## ⚙️ Configuration (`.env`)

Copy `.env.example` to `.env` and edit. Key settings:

| Variable | Meaning |
|---|---|
| `OPENCLAW_ALLOWED_NUMBERS` | **Required.** Comma-separated allow-list, digits only (`14155550123`). |
| `OPENCLAW_BACKEND` | `cli` (Claude Code, default) or `openclaw` (the external OpenClaw runtime). |
| `OPENCLAW_WORKDIR` | Folder your agents read/write in. Point it at a project to get real work done. |
| `OPENCLAW_PERMISSION_MODE` | `acceptEdits` (default, safe-ish) · `bypass` (fully autonomous) · `default`. |
| `OPENCLAW_DEFAULT_AGENT` | Agent slug to use when you haven't picked one. |
| `OPENCLAW_TIMEOUT_SECONDS` | Max seconds per agent run (default 600). |
| `OPENCLAW_CLAUDE_BIN` | Path to the `claude` binary if not on PATH. |

See **[docs/SETUP.md](docs/SETUP.md)** for the full walkthrough and
**[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** when something misbehaves.

---

## 🖼️ Images & 🎙️ voice notes

- **Images** work out of the box. Send a screenshot/photo (optionally with a
  caption like "what's wrong with this UI?") and the agent reads the file and
  responds.
- **Voice notes** need a transcriber. Easiest: `pip install -U openai-whisper`
  and OpenClaw uses it automatically. Prefer another engine? Point
  `OPENCLAW_TRANSCRIBE_CMD` at any command that takes `{file}` and prints the
  transcript (e.g. whisper.cpp, a local ASR server). Disable all media with
  `OPENCLAW_ENABLE_MEDIA=false`.

---

## ♾️ Run it 24/7

Link WhatsApp once interactively (`./scripts/openclaw.sh`, scan the QR), then
install it as a background service:

```bash
./scripts/service.sh pm2        # simplest, cross-platform
#   or
./scripts/service.sh systemd    # systemd --user service (Linux/WSL2)

./scripts/service.sh status     # check it
./scripts/service.sh stop       # remove it
```

`pm2` users: run `pm2 startup` once (and the command it prints) so it survives
reboots. On WSL2, `systemd` mode enables lingering so it keeps running when
you're logged out. See [docs/SETUP.md](docs/SETUP.md#10-keep-it-running-247).

---

## 🔒 Security — read this

OpenClaw lets a phone message run AI agents **on your computer**. Treat it like
remote shell access:

- **Always set `OPENCLAW_ALLOWED_NUMBERS`.** Never run with `OPENCLAW_ALLOW_ALL=true`
  unless you fully understand the risk.
- **`bypass` permission mode runs commands without asking.** Only use it with an
  `OPENCLAW_WORKDIR` you're happy for an agent to act in (ideally a dedicated
  project folder, not your home directory).
- Secrets live in `.env` and the WhatsApp session in `.wwebjs_auth/` — both are
  git-ignored. Don't commit them.
- WhatsApp linking uses the same trust model as WhatsApp Web. Unlink the device
  from your phone to instantly revoke access.

---

## 🔁 Backends: Claude Code or the OpenClaw runtime

OpenClaw Gateway can drive either engine — switch with `OPENCLAW_BACKEND`:

- **`cli` (default)** — runs your agents through the **Claude Code** CLI, using
  your existing Claude subscription. Zero extra setup beyond logging into Claude.
- **`openclaw`** — routes messages to the external **OpenClaw runtime/CLI**
  instead. Because OpenClaw's command surface varies by version, the adapter is
  configurable:

  ```env
  OPENCLAW_BACKEND=openclaw
  # Easiest — give the exact command your runtime uses
  # ({agent} {session} {prompt} are substituted; the message is also on stdin):
  OPENCLAW_CLI_CMD=openclaw run --agent {agent} --session {session}
  # …or rely on the default:  <bin> <subcommand> [--agent X] [--session Y]
  OPENCLAW_CLI_BIN=openclaw
  OPENCLAW_CLI_SUBCOMMAND=run
  ```

  The active Agency specialist is passed as `{agent}`, and (by default) its
  personality is prepended to the message so it's honoured even if that agent
  isn't registered inside your OpenClaw runtime. Run `npm run doctor` to confirm
  the CLI is reachable.

> Either way, the WhatsApp side, commands, allow-list, media, and 24/7 service
> all work identically — only the engine that fulfils the task changes.

---

## 🧩 How it works

1. `whatsapp-web.js` links a WhatsApp account over QR and streams your messages.
2. `commands.js` parses each message (slash-command or task) and picks the
   active specialist.
3. `agents.js` loads the chosen agent's Markdown personality from the Agency.
4. `claude-runner.js` runs `claude -p` headlessly with that personality as the
   system prompt, resuming a per-chat session for memory.
5. The reply is chunked and texted back to you.

No application servers, no inbound ports — it's an outbound client, so it works
from behind home NAT/WSL with zero networking setup.

---

MIT licensed, like the rest of The Agency.
