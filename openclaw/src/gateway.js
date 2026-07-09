#!/usr/bin/env node
// OpenClaw gateway: starts every enabled messaging channel (WhatsApp, webhook,
// Google Chat, WeChat) and routes all of them through one channel-agnostic core
// into your chosen agent backend (Claude Code, Ollama, or the OpenClaw runtime).
// Run with:  node src/gateway.js   (or ./scripts/openclaw.sh)

import config from './config.js';
import log from './logger.js';
import { loadAgents } from './agents.js';
import { handleInbound, hasAnyAllow } from './core.js';
import { startChannels, availableChannels } from './channels/index.js';

function banner() {
  log.plain('');
  log.plain('  ┌────────────────────────────────────────────┐');
  log.plain('  │   🐾  OpenClaw — your Agency, everywhere     │');
  log.plain('  └────────────────────────────────────────────┘');
  log.plain('');
}

function preflight() {
  const agents = loadAgents();
  log.ok(`Loaded ${agents.length} Agency specialists from ${config.agentsDir}`);
  log.info(`Channels: ${config.channels.join(', ') || '(none)'}  |  available: ${availableChannels().join(', ')}`);

  // Backend
  if (config.backend === 'ollama') {
    log.info(`Backend: Ollama (${config.openclawCmd || `${config.ollamaBin} run ${config.ollamaModel}`})`);
  } else if (config.backend === 'openclaw') {
    log.info(`Backend: OpenClaw CLI (${config.openclawCmd || `${config.openclawBin} ${config.openclawSubcommand} …`})`);
  } else if (['cli', 'claude'].includes(config.backend)) {
    log.info('Backend: Claude Code CLI');
  } else {
    log.warn(`Unknown backend "${config.backend}"; falling back to Claude Code.`);
  }
  log.info(`workdir: ${config.workdir} | perms: ${config.permissionMode}`);

  if (!hasAnyAllow()) {
    log.warn('No allow-list set. OpenClaw will refuse every message.');
    log.warn('Set OPENCLAW_ALLOWED_NUMBERS (phone/WhatsApp) and/or OPENCLAW_ALLOWED_USERS (other channels) in .env.');
  }
  if (config.allowAll) {
    log.warn('OPENCLAW_ALLOW_ALL=true — ANYONE who reaches a channel can drive your agents!');
  }
  if (config.permissionMode.toLowerCase().startsWith('bypass')) {
    log.warn('Permission mode "bypass" — agents run commands WITHOUT asking. Make sure workdir is trusted.');
  }
  log.info(config.enableMedia ? 'Media: images ✓ | voice via ' + (config.transcribeCmd ? 'custom command' : 'whisper (if installed)') : 'Media: disabled');
}

async function main() {
  banner();
  preflight();

  const started = await startChannels({ handleInbound });
  if (!started.length) {
    log.error('No channels started. Check OPENCLAW_CHANNELS and the errors above.');
    process.exit(1);
  }
  log.ok(`✅ OpenClaw is live on: ${started.join(', ')}. Send a message — try "/help".`);
}

main().catch((err) => {
  log.error('Fatal:', err);
  process.exit(1);
});
