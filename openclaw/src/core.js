// Channel-agnostic core: takes a normalized inbound message from any channel
// adapter, applies the allow-list, handles commands/media, runs the chosen
// backend, and sends the reply back through the channel.
//
// A channel adapter calls handleInbound(msg) where msg is:
//   {
//     channel:  'whatsapp' | 'webhook' | 'googlechat' | 'wechat',
//     userId:   string,                         // identity for the allow-list
//     text:     string,                         // message body ('' if media-only)
//     media:    null | { kind:'image'|'audio', download():Promise<{data,mimetype}> },
//     canAck:   boolean,                         // can the channel send >1 message?
//     reply:    (text) => Promise<void>,
//     typing?:  () => Promise<void>,
//   }

import config from './config.js';
import log from './logger.js';
import { handleMessage, buildTask } from './commands.js';
import { saveMedia, transcribe, isImageType, isAudioType } from './media.js';

// Phone-style channels match against OPENCLAW_ALLOWED_NUMBERS; everything else
// matches against OPENCLAW_ALLOWED_USERS. Either list (or allowAll) grants access.
const PHONE_CHANNELS = new Set(['whatsapp', 'sms', 'webhook']);

export function isAllowed(channel, userId) {
  if (config.allowAll) return true;
  const id = String(userId ?? '');
  if (config.allowedIds.includes(id)) return true;
  if (PHONE_CHANNELS.has(channel)) {
    const digits = id.replace(/[^\d]/g, '');
    if (digits && config.allowedNumbers.includes(digits)) return true;
  }
  return false;
}

export function hasAnyAllow() {
  return config.allowAll || config.allowedNumbers.length > 0 || config.allowedIds.length > 0;
}

// Turn an inbound media attachment into a { working, run } task.
async function mediaTask(msg, chatId) {
  let media;
  try {
    media = await msg.media.download();
  } catch (err) {
    log.error('Media download failed:', err.message);
  }
  if (!media || !media.data) {
    await msg.reply('⚠️ Could not download that attachment. Please try again.');
    return null;
  }

  const caption = (msg.text || '').trim();
  const kind = msg.media.kind;

  if (kind === 'image' || isImageType(kind, media.mimetype)) {
    const file = saveMedia(media, 'image');
    log.info(`← [${msg.channel}] ${msg.userId}: [image] ${caption.slice(0, 80)}`);
    const instruction = caption || 'Look at this image and help me with it.';
    const prompt =
      `${instruction}\n\n` +
      `[The user sent an image. It is saved locally at: ${file}\n` +
      `Open and analyze it with the Read tool before you respond.]`;
    return buildTask({ chatId, prompt });
  }

  if (kind === 'audio' || isAudioType(kind, media.mimetype)) {
    const file = saveMedia(media, 'audio');
    log.info(`← [${msg.channel}] ${msg.userId}: [voice] transcribing…`);
    if (msg.canAck) await msg.reply('🎧 Transcribing…');
    const { text, error } = await transcribe(file);
    if (error || !text) {
      await msg.reply(`⚠️ ${error || 'Could not transcribe that audio.'}`);
      return null;
    }
    log.info(`← [${msg.channel}] ${msg.userId}: [voice→text] ${text.slice(0, 120)}`);
    if (msg.canAck) await msg.reply(`🗣️ _"${text}"_`);
    return buildTask({ chatId, prompt: text });
  }

  await msg.reply('🐾 I can handle images and voice notes, but not that file type yet.');
  return null;
}

export async function handleInbound(msg) {
  try {
    if (!isAllowed(msg.channel, msg.userId)) {
      log.warn(`Ignored ${msg.channel} message from unauthorized "${msg.userId}"`);
      return;
    }

    const chatId = `${msg.channel}:${msg.userId}`;
    let result;

    if (msg.media && config.enableMedia) {
      result = await mediaTask(msg, chatId);
      if (!result) return;
    } else if (msg.media) {
      await msg.reply('🐾 Media support is disabled (set OPENCLAW_ENABLE_MEDIA=true).');
      return;
    } else {
      const text = (msg.text || '').trim();
      if (!text) return;
      log.info(`← [${msg.channel}] ${msg.userId}: ${text.slice(0, 120)}`);
      result = await handleMessage({ chatId, text });
    }

    // Command response with no agent run.
    if (result.reply !== undefined && !result.run) {
      await msg.reply(result.reply);
      return;
    }

    // Agent run: ack (only on channels that support multiple messages), then deliver.
    if (msg.canAck && result.working) await msg.reply(result.working);
    if (msg.typing) await msg.typing().catch(() => {});

    try {
      const reply = await result.run();
      await msg.reply(reply);
      log.ok(`→ [${msg.channel}] ${msg.userId}: replied (${reply.length} chars)`);
    } catch (err) {
      log.error('Agent run failed:', err.message);
      await msg.reply(`⚠️ Agent error: ${err.message}`);
    }
  } catch (err) {
    log.error('Inbound handler crashed:', err.message);
  }
}

export default { handleInbound, isAllowed, hasAnyAllow };
