// Parses incoming WhatsApp text into either a slash-command or an agent task,
// and produces the reply. Keeps lightweight per-chat state (which specialist is
// active) so you can say "/use frontend" once and keep chatting.

import { loadAgents, resolveAgent, readAgentPrompt } from './agents.js';
import { runAgent, resetSession } from './runner.js';
import config from './config.js';

// chatId -> { agentSlug }
const chatState = new Map();

function stateFor(chatId) {
  let s = chatState.get(chatId);
  if (!s) {
    s = { agentSlug: config.defaultAgent || null };
    chatState.set(chatId, s);
  }
  return s;
}

function helpText() {
  return [
    '🐾 *OpenClaw* — your Agency, on WhatsApp.',
    '',
    'Just send a message and your active agent gets to work.',
    '',
    '*Commands*',
    '/agents — list available specialists',
    '/agents <category> — filter (e.g. /agents engineering)',
    '/use <agent> — switch specialist (e.g. /use frontend)',
    '/whoami — show the active specialist',
    '/reset — clear the conversation memory & agent',
    '/status — show OpenClaw settings',
    '/help — this message',
    '',
    'Tip: prefix one message with @agent to use a specialist just once,',
    'e.g. "@growth-hacker give me 5 launch ideas".',
  ].join('\n');
}

function listAgents(category) {
  const agents = loadAgents().filter(
    (a) => !category || a.category.includes(category.toLowerCase()),
  );
  if (!agents.length) return `No agents found${category ? ` in "${category}"` : ''}.`;

  const byCat = {};
  for (const a of agents) (byCat[a.category] ??= []).push(a);

  const lines = ['*Available specialists* (use `/use <name>`):', ''];
  for (const cat of Object.keys(byCat).sort()) {
    lines.push(`*${cat}*`);
    for (const a of byCat[cat]) lines.push(`  • ${a.shortSlug} — ${a.name}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function statusText(chatId) {
  const s = stateFor(chatId);
  const active = s.agentSlug ? resolveAgent(s.agentSlug) : null;
  return [
    '*OpenClaw status*',
    `Backend: ${config.backend}`,
    `Active agent: ${active ? active.name : '(general assistant)'}`,
    `Working dir: ${config.workdir}`,
    `Permission mode: ${config.permissionMode}`,
    `Agents loaded: ${loadAgents().length}`,
  ].join('\n');
}

// Handle a message. Returns { reply, working } where `working` is an optional
// "I'm on it" acknowledgement to send before the agent finishes.
export async function handleMessage({ chatId, text }) {
  const body = text.trim();

  // ── Slash commands ────────────────────────────────────────────────────────
  if (body.startsWith('/')) {
    const [cmd, ...rest] = body.slice(1).split(/\s+/);
    const arg = rest.join(' ').trim();
    switch (cmd.toLowerCase()) {
      case 'help':
      case 'start':
        return { reply: helpText() };
      case 'agents':
      case 'list':
        return { reply: listAgents(arg) };
      case 'use':
      case 'agent': {
        if (!arg) return { reply: 'Usage: /use <agent>. Try /agents for the list.' };
        const found = resolveAgent(arg);
        if (!found) return { reply: `No agent matches "${arg}". Try /agents.` };
        stateFor(chatId).agentSlug = found.slug;
        return { reply: `✅ Switched to *${found.name}*.\n${found.description || ''}`.trim() };
      }
      case 'whoami': {
        const a = stateFor(chatId).agentSlug ? resolveAgent(stateFor(chatId).agentSlug) : null;
        return { reply: a ? `Active agent: *${a.name}*` : 'No specialist active (general assistant).' };
      }
      case 'reset':
        resetSession(chatId);
        stateFor(chatId).agentSlug = config.defaultAgent || null;
        return { reply: '🧹 Conversation memory cleared and agent reset.' };
      case 'status':
        return { reply: statusText(chatId) };
      default:
        return { reply: `Unknown command "/${cmd}". Send /help.` };
    }
  }

  // ── One-off @agent prefix ────────────────────────────────────────────────
  let oneOffAgent = null;
  let prompt = body;
  const at = body.match(/^@([\w-]+)\s+([\s\S]+)/);
  if (at) {
    const found = resolveAgent(at[1]);
    if (found) {
      oneOffAgent = found;
      prompt = at[2];
    }
  }

  // ── Run the active (or one-off) specialist ───────────────────────────────
  return buildTask({ chatId, prompt, oneOffAgent });
}

// Builds the { working, run } pair for any free-form task — shared by text
// messages and media (images/voice) so they all route to the active specialist.
export function buildTask({ chatId, prompt, oneOffAgent = null }) {
  const s = stateFor(chatId);
  const agent = oneOffAgent || (s.agentSlug ? resolveAgent(s.agentSlug) : null);
  const systemPrompt = agent ? buildSystemPrompt(agent) : null;

  const working = agent ? `🐾 ${agent.name} is on it…` : '🐾 On it…';

  const run = async () => {
    const { text: reply } = await runAgent({ chatId, prompt, systemPrompt, agent });
    return reply || '(the agent returned nothing)';
  };

  return { working, run, agent };
}

function buildSystemPrompt(agent) {
  const body = readAgentPrompt(agent);
  return [
    'You are operating as the following Agency specialist. Fully adopt this',
    'identity, voice, and workflow for the rest of the conversation. You are',
    'being driven remotely over WhatsApp, so keep replies focused and mobile-',
    'friendly: lead with the answer/result, use short paragraphs, and only',
    'include code or long output when it is the deliverable.',
    '',
    '─────────────────────────────────────────',
    body,
  ].join('\n');
}

export default { handleMessage };
