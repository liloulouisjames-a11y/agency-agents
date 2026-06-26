#!/usr/bin/env node
// `npm run doctor` — checks that OpenClaw can actually run on this machine
// before you try to link WhatsApp. Reports what's missing and how to fix it.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import config from './config.js';
import { loadAgents } from './agents.js';
import log from './logger.js';

const exec = promisify(execFile);
let problems = 0;

function pass(msg) {
  log.ok(`✓ ${msg}`);
}
function fail(msg, fix) {
  problems += 1;
  log.error(`✗ ${msg}`);
  if (fix) log.plain(`    → ${fix}`);
}

async function tryVersion(bin, args = ['--version']) {
  const { stdout } = await exec(bin, args, { timeout: 15000 });
  return stdout.trim();
}

async function main() {
  log.plain('\nOpenClaw doctor 🩺\n');

  // Node version
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) pass(`Node.js ${process.version}`);
  else fail(`Node.js ${process.version} is too old`, 'Install Node 18+ (nvm install --lts).');

  // Backend engine
  if (config.backend === 'ollama') {
    try {
      await tryVersion(config.ollamaBin);
      pass(`Backend: Ollama CLI found ("${config.ollamaBin}")`);
      try {
        const { stdout } = await exec(config.ollamaBin, ['list'], { timeout: 15000 });
        if (stdout.split('\n').some((l) => l.split(/\s+/)[0]?.split(':')[0] === config.ollamaModel)) {
          pass(`Ollama model "${config.ollamaModel}" is available`);
        } else {
          log.warn(`! Ollama model "${config.ollamaModel}" not pulled. Run: ${config.ollamaBin} pull ${config.ollamaModel}`);
        }
      } catch {
        log.warn('! Could not list Ollama models (is the Ollama server running?).');
      }
    } catch {
      fail(
        `Ollama CLI "${config.ollamaBin}" not found`,
        'Install Ollama (https://ollama.com), or set OPENCLAW_OLLAMA_BIN to its path.',
      );
    }
  } else if (config.backend === 'openclaw') {
    if (config.openclawCmd) {
      pass(`Backend: OpenClaw via custom command template`);
    } else {
      try {
        const v = await tryVersion(config.openclawBin);
        pass(`Backend: OpenClaw CLI found: ${v}`);
      } catch {
        fail(
          `OpenClaw CLI "${config.openclawBin}" not found`,
          'Install the OpenClaw runtime, or set OPENCLAW_CLI_BIN / OPENCLAW_CLI_CMD to match your setup.',
        );
      }
    }
  } else {
    try {
      const v = await tryVersion(config.claudeBin);
      pass(`Backend: Claude Code CLI found: ${v}`);
    } catch {
      fail(
        `Claude Code CLI "${config.claudeBin}" not found or not logged in`,
        'Install it (npm i -g @anthropic-ai/claude-code) and run `claude` once to log in.',
      );
    }
  }

  // node_modules / whatsapp-web.js
  const wwjs = path.join(config.rootDir, 'node_modules', 'whatsapp-web.js');
  if (fs.existsSync(wwjs)) pass('whatsapp-web.js installed');
  else fail('whatsapp-web.js not installed', 'Run: npm install (inside openclaw/).');

  // Agents discovered
  const agents = loadAgents();
  if (agents.length) pass(`${agents.length} Agency specialists discovered`);
  else fail('No agents found', `Expected agent .md files under ${config.agentsDir}.`);

  // .env present & allowlist
  if (fs.existsSync(path.join(config.rootDir, '.env'))) pass('.env present');
  else fail('.env missing', 'Run: cp .env.example .env  (then add your number).');

  if (config.allowedNumbers.length || config.allowAll) {
    pass(config.allowAll ? 'Allowlist: ALLOW_ALL (open)' : `Allowlist: ${config.allowedNumbers.length} number(s)`);
  } else {
    fail('No authorized numbers', 'Set OPENCLAW_ALLOWED_NUMBERS in .env (digits only).');
  }

  // Workdir
  if (fs.existsSync(config.workdir)) pass(`Working dir exists: ${config.workdir}`);
  else log.warn(`Working dir ${config.workdir} will be created on first run`);

  // Media + voice transcription (optional — never fails the doctor)
  if (config.enableMedia) {
    pass('Media enabled (images supported)');
    if (config.transcribeCmd) {
      pass('Voice notes: custom OPENCLAW_TRANSCRIBE_CMD set');
    } else {
      try {
        await exec('whisper', ['--help'], { timeout: 10000 });
        pass(`Voice notes: whisper CLI found (model "${config.whisperModel}")`);
      } catch {
        log.warn(
          '! Voice notes: no transcriber. Install openai-whisper (pip install -U openai-whisper) ' +
            'or set OPENCLAW_TRANSCRIBE_CMD. Images still work.',
        );
      }
    }
  } else {
    log.warn('! Media disabled (OPENCLAW_ENABLE_MEDIA=false)');
  }

  log.plain('');
  if (problems === 0) {
    log.ok('All good — start OpenClaw with: ./scripts/openclaw.sh');
  } else {
    log.error(`${problems} problem(s) found. Fix the items above, then re-run: npm run doctor`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  log.error('doctor crashed:', e.message);
  process.exit(1);
});
