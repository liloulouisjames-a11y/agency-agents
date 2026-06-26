// OpenClaw-runtime backend: routes a message to the external `openclaw` CLI
// instead of Claude Code. Because OpenClaw's exact command surface varies by
// version, this adapter is configurable — set OPENCLAW_CLI_CMD to your runtime's
// invocation, or rely on the documented default arg builder below.

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import config from './config.js';
import log from './logger.js';

// chatId -> { sessionId }
const sessions = new Map();

export function resetSession(chatId) {
  sessions.delete(chatId);
}

function sessionFor(chatId) {
  let s = sessions.get(chatId);
  if (!s) {
    s = { sessionId: crypto.randomUUID() };
    sessions.set(chatId, s);
  }
  return s;
}

export async function runAgent({ chatId, prompt, systemPrompt, agent }) {
  const { sessionId } = sessionFor(chatId);
  const agentId = agent?.slug || agent?.shortSlug || '';

  // OpenClaw runs its own registered agents, but to honour the Agency
  // personality even when an agent isn't registered, optionally inline it.
  const input =
    config.inlinePersona && systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt;

  if (config.openclawCmd) {
    return spawnShell(config.openclawCmd, { agentId, sessionId, prompt: input });
  }

  // Default best-guess interface: `openclaw <subcommand> [--agent X] [--session Y]`
  // with the message on stdin. Override via OPENCLAW_CLI_CMD if yours differs.
  const args = [config.openclawSubcommand];
  if (agentId) args.push('--agent', agentId);
  if (sessionId) args.push('--session', sessionId);
  return spawnArgs(config.openclawBin, args, input, sessionId);
}

function finish(stdout, stderr, code, sessionId) {
  const text = stdout.trim() || stderr.trim();
  if (code !== 0 && !text) {
    throw new Error(stderr.trim() || `openclaw exited with code ${code}`);
  }
  return { text: text || '(no output)', sessionId };
}

function spawnArgs(bin, args, stdinText, sessionId) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: config.workdir, env: process.env });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`OpenClaw run timed out after ${config.timeoutSeconds}s`));
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
            `Could not launch "${bin}". Install the OpenClaw CLI and make sure it's on PATH, ` +
              `or set OPENCLAW_CLI_BIN / OPENCLAW_CLI_CMD. See docs/SETUP.md.`,
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
      try {
        resolve(finish(stdout, stderr, code, sessionId));
      } catch (e) {
        reject(e);
      }
    });

    child.stdin.write(stdinText);
    child.stdin.end();
  });
}

function spawnShell(template, { agentId, sessionId, prompt }) {
  // Substitute placeholders; {prompt} is shell-quoted, others too. The message
  // is also piped on stdin so templates can use either.
  const cmd = template
    .replace(/\{agent\}/g, shellQuote(agentId))
    .replace(/\{session\}/g, shellQuote(sessionId))
    .replace(/\{prompt\}/g, shellQuote(prompt));
  return spawnArgs('sh', ['-c', cmd], prompt, sessionId);
}

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export default { runAgent, resetSession };
