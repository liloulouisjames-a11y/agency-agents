// Channel registry. Maps channel names to adapter modules and starts the ones
// enabled via OPENCLAW_CHANNELS.

import config from '../config.js';
import log from '../logger.js';
import whatsapp from './whatsapp.js';
import webhook from './webhook.js';
import googlechat from './googlechat.js';
import wechat from './wechat.js';

const REGISTRY = { whatsapp, webhook, googlechat, wechat };

export function availableChannels() {
  return Object.keys(REGISTRY);
}

// Start every enabled channel. Each runs independently — one failing to start
// doesn't stop the others. Returns the list of channels that started.
export async function startChannels({ handleInbound }) {
  const started = [];
  for (const name of config.channels) {
    const adapter = REGISTRY[name];
    if (!adapter) {
      log.warn(`Unknown channel "${name}" — skipping. Known: ${availableChannels().join(', ')}`);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await adapter.start({ handleInbound });
      started.push(name);
    } catch (err) {
      log.error(`Failed to start channel "${name}":`, err.message);
    }
  }
  return started;
}

export default { startChannels, availableChannels };
