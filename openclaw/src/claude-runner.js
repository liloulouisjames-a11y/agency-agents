// Bridges an incoming message to the Claude Code CLI running headlessly, so
// your existing Claude subscription powers the agents ("free agents"). Keeps a
// resumable session per WhatsApp chat so conversations have memory.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import config from './config.js';
import log from './logger.js';

// chatId -> { sessionId, started }
const sessions = new Map();

function permissionArgs() {
  const mode = (config.permissionMode || 'acceptEdits').toLowerCase();
  if (mode === 'bypass' || mode === 'bypasspermissions') {
    return ['--dangerously-skip-permissions'];
  }
  if (mode === 'acceptedits' || mode === 'accept-edits') {
    return ['--permission-mode', 'acceptEdits'];
  }
  return ['--permission-mode', 'default'];
}

function ensureWorkdir() {
  try {
    if (!fs.existsSync(config.workdir)) fs.mkdirSync(config.workdir, { recursive: true });
  } catch {
    /* fall through — spawn will surface a clear error */
  }
}

// Runs one prompt for a chat and returns { text, sessionId }.
export async function runAgent({ chatId, prompt, systemPrompt }) {
  ensureWorkdir();

  let state = sessions.get(chatId);
  if (!state) {
    state = { sessionId: crypto.randomUUID(), started: false };
    sessions.set(chatId, state);
  }

  const args = ['-p', '--output-format', 'json', ...permissionArgs()];

  if (state.started) {
    args.push('--resume', state.sessionId);
  } else {
    args.push('--session-id', state.sessionId);
  }

  if (systemPrompt) {
    args.push('--append-system-prompt', systemPrompt);
  }

  // Let agents read the Agency definitions even when working elsewhere.
  if (config.agentsDir && config.agentsDir !== config.workdir) {
    args.push('--add-dir', config.agentsDir);
  }

  const result = await spawnClaude(args, prompt);
  state.started = true;

  // If we captured a real session id from the CLI, keep it authoritative.
  if (result.sessionId) state.sessionId = result.sessionId;

  return { text: result.text, sessionId: state.sessionId };
}

export function resetSession(chatId) {
  sessions.delete(chatId);
}

function spawnClaude(args, stdinText) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.claudeBin, args, {
      cwd: config.workdir,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`Agent run timed out after ${config.timeoutSeconds}s`));
    }, config.timeoutSeconds * 1000);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(
          new Error(
            `Could not launch "${config.claudeBin}". Install Claude Code and run it once to log in. ` +
              `See openclaw/docs/SETUP.md.`,
          ),
        );
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr.trim() || `Claude exited with code ${code}`));
      }
      resolve(parseOutput(stdout, stderr));
    });

    // Feed the prompt via stdin to avoid argv length/escaping limits.
    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

function parseOutput(stdout, stderr) {
  const raw = stdout.trim();
  try {
    const parsed = JSON.parse(raw);
    // --output-format json returns a result object (or sometimes an array of events).
    const obj = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
    const text =
      obj.result ?? obj.text ?? obj.message?.content?.[0]?.text ?? raw;
    return { text: String(text).trim(), sessionId: obj.session_id || null };
  } catch {
    // Not JSON — return whatever we got (covers older CLI / text output).
    return { text: raw || stderr.trim() || '(no output)', sessionId: null };
  }
}

export default { runAgent, resetSession };
