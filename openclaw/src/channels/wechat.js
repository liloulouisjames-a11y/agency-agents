// WeChat channel adapter via Wechaty (optional dependency).
//
// IMPORTANT: personal WeChat has no free official API. Wechaty needs a "puppet":
//   - wechaty-puppet-wechat (web protocol) is free but Tencent blocks most
//     accounts, especially newer ones — it may simply fail to log in.
//   - wechaty-puppet-padlocal / -wechat4u / -service are more reliable but need
//     a (often paid) token.
// Install what you choose, e.g.:  npm i wechaty wechaty-puppet-wechat
// Configure with OPENCLAW_WECHAT_PUPPET and OPENCLAW_WECHAT_TOKEN.

import qrcode from 'qrcode-terminal';
import config from '../config.js';
import log from '../logger.js';

export default {
  name: 'wechat',

  async start({ handleInbound }) {
    let WechatyBuilder;
    try {
      ({ WechatyBuilder } = await import('wechaty'));
    } catch {
      log.error('[wechat] Wechaty is not installed. Run: npm i wechaty ' + config.wechat.puppet);
      log.error('[wechat] Skipping WeChat channel.');
      return;
    }

    const options = { name: 'openclaw', puppet: config.wechat.puppet };
    if (config.wechat.puppetToken) options.puppetOptions = { token: config.wechat.puppetToken };

    const bot = WechatyBuilder.build(options);

    bot.on('scan', (qrUrl, status) => {
      // status 2 = waiting for scan
      log.info(`[wechat] Scan to log in (status ${status}):`);
      qrcode.generate(qrUrl, { small: true });
    });
    bot.on('login', (user) => log.ok(`[wechat] ✅ logged in as ${user}`));
    bot.on('logout', (user) => log.warn(`[wechat] logged out: ${user}`));
    bot.on('error', (e) => log.error('[wechat] error:', e?.message || e));

    bot.on('message', async (message) => {
      try {
        if (message.self()) return;
        if (message.room()) return; // 1:1 only

        const talker = message.talker();
        const userId = talker?.id || talker?.name?.() || 'unknown';
        const text = message.text() || '';

        // Best-effort media: non-text messages usually have empty text + a filebox.
        let media = null;
        if (!text && typeof message.toFileBox === 'function') {
          media = {
            kind: 'image',
            download: async () => {
              const fb = await message.toFileBox();
              const mimetype = fb.mediaType || fb.mimeType || 'application/octet-stream';
              const data = await fb.toBase64();
              return { data, mimetype };
            },
          };
        }

        log.info(`[wechat] message from ${talker?.name?.() || userId} (${userId})`);
        await handleInbound({
          channel: 'wechat',
          userId,
          text,
          media,
          canAck: true,
          reply: async (t) => {
            await message.say(String(t ?? ''));
          },
        });
      } catch (err) {
        log.error('[wechat] message handler failed:', err.message);
      }
    });

    await bot.start();
    log.ok('[wechat] started.');
  },
};
