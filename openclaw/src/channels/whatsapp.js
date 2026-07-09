// WhatsApp channel adapter (free, QR-linked via whatsapp-web.js).

import path from 'node:path';
import qrcode from 'qrcode-terminal';
import config from '../config.js';
import log from '../logger.js';

const MAX_CHUNK = 3500;

function mediaKind(type, mimetype) {
  if (type === 'image' || (mimetype || '').startsWith('image/')) return 'image';
  if (type === 'ptt' || type === 'audio' || (mimetype || '').startsWith('audio/')) return 'audio';
  return null;
}

export default {
  name: 'whatsapp',

  async start({ handleInbound }) {
    // Imported lazily so the other channels work even if this heavy dep
    // (puppeteer/Chromium) isn't installed.
    const waweb = (await import('whatsapp-web.js')).default;
    const { Client, LocalAuth } = waweb;

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(config.rootDir, '.wwebjs_auth') }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      },
    });

    client.on('qr', (qr) => {
      log.plain('');
      log.info('[whatsapp] Scan with WhatsApp → Settings → Linked devices → Link a device:');
      log.plain('');
      qrcode.generate(qr, { small: true });
      log.plain('');
    });
    client.on('authenticated', () => log.ok('[whatsapp] authenticated (session saved).'));
    client.on('auth_failure', (m) => log.error('[whatsapp] auth failure:', m));
    client.on('disconnected', (r) => log.warn('[whatsapp] disconnected:', r));
    client.on('ready', () => log.ok('[whatsapp] ✅ ready.'));

    client.on('message', async (msg) => {
      if (msg.from === 'status@broadcast' || msg.from.endsWith('@g.us')) return;

      const kind = msg.hasMedia ? mediaKind(msg.type, msg._data?.mimetype) : null;
      if (!msg.hasMedia && msg.type !== 'chat') return;

      const chat = await msg.getChat();
      await handleInbound({
        channel: 'whatsapp',
        userId: msg.from.split('@')[0],
        text: msg.body || '',
        media: kind
          ? {
              kind,
              download: async () => {
                const m = await msg.downloadMedia();
                return { data: m?.data, mimetype: m?.mimetype };
              },
            }
          : null,
        canAck: true,
        reply: async (text) => {
          const safe = String(text ?? '').trim() || '(empty reply)';
          for (let i = 0; i < safe.length; i += MAX_CHUNK) {
            // eslint-disable-next-line no-await-in-loop
            await msg.reply(safe.slice(i, i + MAX_CHUNK));
          }
        },
        typing: async () => {
          await chat.sendStateTyping();
        },
      });
      await chat.clearState().catch(() => {});
    });

    await client.initialize();
  },
};
