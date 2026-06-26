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
import { handleMessage, buildTask } from './commands.js';
import { saveMedia, transcribe, isImageType, isAudioType } from './media.js';

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

  if (config.backend === 'ollama') {
    log.info(`Backend: Ollama (${config.openclawCmd || `${config.ollamaBin} run ${config.ollamaModel}`})`);
  } else if (config.backend === 'openclaw') {
    log.info(`Backend: OpenClaw CLI (${config.openclawCmd || `${config.openclawBin} ${config.openclawSubcommand} …`})`);
  } else if (!['cli', 'claude'].includes(config.backend)) {
    log.warn(`Unknown backend "${config.backend}"; falling back to Claude Code.`);
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
  if (config.enableMedia) {
    const stt = config.transcribeCmd ? 'custom command' : 'whisper (if installed)';
    log.info(`Media: images ✓ | voice notes via ${stt}`);
  } else {
    log.info('Media: disabled');
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

// Downloads an image or voice note and returns a { working, run } task, or null
// if it was unsupported / already answered with an error reply.
async function processMedia(msg, number) {
  let media;
  try {
    media = await msg.downloadMedia();
  } catch (err) {
    log.error('Media download failed:', err.message);
  }
  if (!media || !media.data) {
    await msg.reply('⚠️ Could not download that attachment. Please try again.');
    return null;
  }

  const caption = (msg.body || '').trim();

  // Images: save and have the agent read the file.
  if (isImageType(msg.type, media.mimetype)) {
    const file = saveMedia(media, 'image');
    log.info(`← ${number}: [image] ${caption.slice(0, 80)}`);
    const instruction = caption || 'Look at this image and help me with it.';
    const prompt =
      `${instruction}\n\n` +
      `[The user sent an image over WhatsApp. It is saved locally at: ${file}\n` +
      `Open and analyze it with the Read tool before you respond.]`;
    return buildTask({ chatId: msg.from, prompt });
  }

  // Voice notes / audio: transcribe to text, then treat as a normal task.
  if (isAudioType(msg.type, media.mimetype)) {
    const file = saveMedia(media, 'audio');
    log.info(`← ${number}: [voice note] transcribing…`);
    await msg.reply('🎧 Transcribing your voice note…');
    const { text, error } = await transcribe(file);
    if (error || !text) {
      await msg.reply(`⚠️ ${error || 'Could not transcribe that voice note.'}`);
      return null;
    }
    log.info(`← ${number}: [voice→text] ${text.slice(0, 120)}`);
    await msg.reply(`🗣️ _"${text}"_`);
    return buildTask({ chatId: msg.from, prompt: text });
  }

  await msg.reply('🐾 I can handle images and voice notes, but not that file type yet.');
  return null;
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

      const number = msg.from.split('@')[0];
      if (!isAllowed(number)) {
        log.warn(`Ignored message from unauthorized number ${number}`);
        return;
      }

      const chat = await msg.getChat();
      let result;

      if (msg.hasMedia && config.enableMedia) {
        // Image or voice note → turn it into a task for the active specialist.
        result = await processMedia(msg, number);
        if (!result) return; // unsupported type, or already replied with an error
      } else if (msg.hasMedia) {
        await msg.reply('🐾 Media support is disabled (set OPENCLAW_ENABLE_MEDIA=true).');
        return;
      } else if (msg.type === 'chat') {
        const text = (msg.body || '').trim();
        if (!text) return;
        log.info(`← ${number}: ${text.slice(0, 120)}`);
        result = await handleMessage({ chatId: msg.from, text });
      } else {
        await msg.reply('🐾 I can handle text, images, and voice notes right now.');
        return;
      }

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
