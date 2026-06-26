#!/usr/bin/env node
// OpenClaw gateway: links a WhatsApp account (free, via QR) and forwards your
// messages to the Agency agents through Claude Code. Reply comes straight back
// to your phone. Run with:  node src/gateway.js  (or ./scripts/openclaw.sh)

import qrcode from 'qrcode-terminal';
import waweb from 'whatsapp-web.js';
import path from 'node:path';

import config from './config.js';
import log from './logger.js';
import { loadAgents } from './agents.js';
import { handleMessage } from './commands.js';

const { Client, LocalAuth } = waweb;

const MAX_CHUNK = 3500; // WhatsApp-friendly message size

function banner() {
  log.plain('');
  log.plain('  ┌────────────────────────────────────────────┐');
  log.plain('  │   🐾  OpenClaw — your Agency on WhatsApp     │');
  log.plain('  └────────────────────────────────────────────┘');
  log.plain('');
}

function preflight() {
  const agents = loadAgents();
  log.ok(`Loaded ${agents.length} Agency specialists from ${config.agentsDir}`);
  log.info(`Backend: ${config.backend} | workdir: ${config.workdir} | perms: ${config.permissionMode}`);

  if (config.backend !== 'cli') {
    log.warn(`Backend "${config.backend}" is not supported yet; only "cli" works. Using cli.`);
  }
  if (!config.allowedNumbers.length && !config.allowAll) {
    log.warn('No OPENCLAW_ALLOWED_NUMBERS set. OpenClaw will refuse every message.');
    log.warn('Edit openclaw/.env and add your WhatsApp number (digits only).');
  }
  if (config.allowAll) {
    log.warn('OPENCLAW_ALLOW_ALL=true — ANYONE messaging this number can drive your agents!');
  }
  if (config.permissionMode.toLowerCase().startsWith('bypass')) {
    log.warn('Permission mode "bypass" — agents run commands WITHOUT asking. Make sure workdir is trusted.');
  }
}

function isAllowed(number) {
  if (config.allowAll) return true;
  return config.allowedNumbers.includes(number);
}

async function sendChunked(msg, text) {
  const safe = String(text ?? '').trim() || '(empty reply)';
  for (let i = 0; i < safe.length; i += MAX_CHUNK) {
    // eslint-disable-next-line no-await-in-loop
    await msg.reply(safe.slice(i, i + MAX_CHUNK));
  }
}

async function main() {
  banner();
  preflight();

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(config.rootDir, '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      // These flags make Chromium happy inside WSL / containers.
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', (qr) => {
    log.plain('');
    log.info('Scan this QR code with WhatsApp → Settings → Linked devices → Link a device:');
    log.plain('');
    qrcode.generate(qr, { small: true });
    log.plain('');
  });

  client.on('authenticated', () => log.ok('WhatsApp authenticated. Session saved — no QR needed next time.'));
  client.on('auth_failure', (m) => log.error('Auth failure:', m));
  client.on('disconnected', (reason) => log.warn('Disconnected:', reason));

  client.on('ready', () => {
    log.ok('✅ OpenClaw is live. Message your linked number to put your agents to work.');
    if (config.allowedNumbers.length) {
      log.info(`Authorized numbers: ${config.allowedNumbers.join(', ')}`);
    }
    log.info('Send "/help" from your phone to get started.');
  });

  client.on('message', async (msg) => {
    try {
      // Ignore status broadcasts and groups for safety.
      if (msg.from === 'status@broadcast' || msg.from.endsWith('@g.us')) return;
      if (msg.type !== 'chat') return; // text only

      const number = msg.from.split('@')[0];
      if (!isAllowed(number)) {
        log.warn(`Ignored message from unauthorized number ${number}`);
        return;
      }

      const text = (msg.body || '').trim();
      if (!text) return;
      log.info(`← ${number}: ${text.slice(0, 120)}`);

      const chat = await msg.getChat();
      const result = await handleMessage({ chatId: msg.from, text });

      // Immediate reply (command response) with no agent run.
      if (result.reply !== undefined && !result.run) {
        await sendChunked(msg, result.reply);
        return;
      }

      // Agent run: acknowledge, show typing, then deliver the result.
      if (result.working) await msg.reply(result.working);
      await chat.sendStateTyping();

      try {
        const reply = await result.run();
        await sendChunked(msg, reply);
        log.ok(`→ ${number}: replied (${reply.length} chars)`);
      } catch (err) {
        log.error('Agent run failed:', err.message);
        await msg.reply(`⚠️ Agent error: ${err.message}`);
      } finally {
        await chat.clearState();
      }
    } catch (err) {
      log.error('Message handler crashed:', err.message);
    }
  });

  await client.initialize();
}

main().catch((err) => {
  log.error('Fatal:', err);
  process.exit(1);
});
