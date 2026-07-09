// Loads OpenClaw configuration from environment variables (and a .env file if
// present). No external dependency — we parse .env ourselves to keep the
// install footprint tiny.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function num(name, fallback) {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

function list(name) {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.replace(/[^\d]/g, '')) // keep digits only
    .filter(Boolean);
}

export const config = {
  rootDir,
  // The Agency lives one directory up from openclaw/.
  agentsDir: path.resolve(rootDir, '..'),

  allowedNumbers: list('OPENCLAW_ALLOWED_NUMBERS'),
  // Generic allow-list for non-phone channels (Google Chat emails, WeChat ids,
  // webhook user ids…). Raw strings, not digit-stripped. Comma-separated.
  allowedIds: (process.env.OPENCLAW_ALLOWED_USERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowAll: bool('OPENCLAW_ALLOW_ALL', false),

  // Which channel adapters to start. Comma list: whatsapp, webhook, googlechat, wechat.
  channels: (process.env.OPENCLAW_CHANNELS || 'whatsapp')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  // Generic webhook channel (covers Phone Link / SMS forwarders / custom bridges)
  webhook: {
    port: num('OPENCLAW_WEBHOOK_PORT', 8765),
    path: process.env.OPENCLAW_WEBHOOK_PATH || '/openclaw',
    // Shared secret required in the `x-openclaw-token` header (recommended).
    token: (process.env.OPENCLAW_WEBHOOK_TOKEN || '').trim(),
    // Optional: POST replies here instead of returning them in the HTTP response
    // (for async senders). {text} and {user} placeholders are substituted.
    replyUrl: (process.env.OPENCLAW_WEBHOOK_REPLY_URL || '').trim(),
  },

  // Google Chat app endpoint
  googlechat: {
    port: num('OPENCLAW_GCHAT_PORT', 8766),
    path: process.env.OPENCLAW_GCHAT_PATH || '/googlechat',
    // Optional shared token (verify a `?token=` query param) for a light guard.
    token: (process.env.OPENCLAW_GCHAT_TOKEN || '').trim(),
  },

  // WeChat via Wechaty (optional dependency)
  wechat: {
    puppet: process.env.OPENCLAW_WECHAT_PUPPET || 'wechaty-puppet-wechat',
    puppetToken: (process.env.OPENCLAW_WECHAT_TOKEN || '').trim(),
  },

  backend: (process.env.OPENCLAW_BACKEND || 'cli').toLowerCase(),
  claudeBin: process.env.OPENCLAW_CLAUDE_BIN || 'claude',

  // OpenClaw-runtime backend (used when OPENCLAW_BACKEND=openclaw)
  openclawBin: process.env.OPENCLAW_CLI_BIN || 'openclaw',
  openclawSubcommand: process.env.OPENCLAW_CLI_SUBCOMMAND || 'run',
  // Full shell command template; placeholders {agent} {session} {prompt}.
  openclawCmd: (process.env.OPENCLAW_CLI_CMD || '').trim(),
  // Prepend the chosen Agency agent's personality to the message (so it's
  // honoured even if the agent isn't registered inside OpenClaw).
  inlinePersona: bool('OPENCLAW_INLINE_PERSONA', true),

  // Ollama backend (OPENCLAW_BACKEND=ollama): run a local model as your free
  // agents. Reuses the openclaw adapter via a derived `ollama run <model>` cmd.
  ollamaBin: process.env.OPENCLAW_OLLAMA_BIN || 'ollama',
  ollamaModel: process.env.OPENCLAW_OLLAMA_MODEL || 'openclaw',

  // Optional command run by scripts/openclaw.sh before the gateway starts —
  // handy for warming up Ollama / your runtime (e.g. "ollama serve &").
  launchCmd: (process.env.OPENCLAW_LAUNCH_CMD || '').trim(),
  workdir: process.env.OPENCLAW_WORKDIR || os.homedir(),
  permissionMode: process.env.OPENCLAW_PERMISSION_MODE || 'acceptEdits',
  timeoutSeconds: num('OPENCLAW_TIMEOUT_SECONDS', 600),
  defaultAgent: (process.env.OPENCLAW_DEFAULT_AGENT || '').trim(),

  // Media (images + voice notes)
  enableMedia: bool('OPENCLAW_ENABLE_MEDIA', true),
  mediaDir:
    process.env.OPENCLAW_MEDIA_DIR ||
    path.join(process.env.OPENCLAW_WORKDIR || os.homedir(), '.openclaw-media'),
  // Shell command template to transcribe a voice note. Use {file} as the audio
  // path placeholder; the command must print the transcript to stdout.
  transcribeCmd: (process.env.OPENCLAW_TRANSCRIBE_CMD || '').trim(),
  // Whisper model used by the built-in fallback when the `whisper` CLI exists.
  whisperModel: (process.env.OPENCLAW_WHISPER_MODEL || 'base').trim(),
};

// The ollama backend is the openclaw adapter with a derived command, unless the
// user supplied an explicit OPENCLAW_CLI_CMD. `ollama run <model>` reads the
// message on stdin and prints the completion — exactly the one-shot shape we need.
if (config.backend === 'ollama' && !config.openclawCmd) {
  config.openclawCmd = `${config.ollamaBin} run ${config.ollamaModel}`;
}

export default config;
