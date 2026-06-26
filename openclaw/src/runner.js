// Backend dispatcher: picks the engine that runs your agents based on
// OPENCLAW_BACKEND. "cli"/"claude" → Claude Code; "openclaw" → the OpenClaw CLI;
// "ollama" → a local Ollama model (via the same adapter, derived command).
// Every backend exposes the same runAgent()/resetSession() interface.

import config from './config.js';
import * as claude from './claude-runner.js';
import * as openclaw from './openclaw-runner.js';

const COMMAND_BACKENDS = new Set(['openclaw', 'ollama']);
const backend = COMMAND_BACKENDS.has(config.backend) ? openclaw : claude;

export const runAgent = (...args) => backend.runAgent(...args);
export const resetSession = (...args) => backend.resetSession(...args);

export default { runAgent, resetSession };
