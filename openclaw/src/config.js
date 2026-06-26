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
  allowAll: bool('OPENCLAW_ALLOW_ALL', false),

  backend: (process.env.OPENCLAW_BACKEND || 'cli').toLowerCase(),
  claudeBin: process.env.OPENCLAW_CLAUDE_BIN || 'claude',
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

export default config;
