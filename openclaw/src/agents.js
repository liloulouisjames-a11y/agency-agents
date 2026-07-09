// Discovers The Agency's agent personalities (the .md files in the category
// folders one level up) and exposes a small registry so OpenClaw can route a
// WhatsApp message to a chosen specialist.

import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

// Category folders that hold agent markdown files.
const CATEGORIES = [
  'engineering',
  'design',
  'marketing',
  'product',
  'project-management',
  'testing',
  'support',
  'spatial-computing',
  'specialized',
  'strategy',
];

function parseFrontmatter(text) {
  // Very small YAML-frontmatter reader: grabs simple "key: value" pairs from a
  // leading --- ... --- block. Good enough for name/description/color.
  const meta = {};
  if (!text.startsWith('---')) return meta;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return meta;
  const block = text.slice(3, end);
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    meta[m[1].toLowerCase()] = value;
  }
  return meta;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let cache = null;

export function loadAgents() {
  if (cache) return cache;
  const registry = [];
  for (const category of CATEGORIES) {
    const dir = path.join(config.agentsDir, category);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue;
      const fullPath = path.join(dir, file);
      const text = fs.readFileSync(fullPath, 'utf8');
      const meta = parseFrontmatter(text);
      const baseSlug = slugify(file.replace(/\.md$/, ''));
      const name = meta.name || file.replace(/\.md$/, '');
      registry.push({
        slug: baseSlug,
        // shortSlug strips the category prefix for nicer commands, e.g.
        // "engineering-frontend-developer" -> "frontend-developer".
        shortSlug: slugify(name) || baseSlug,
        name,
        description: meta.description || '',
        category,
        path: fullPath,
      });
    }
  }
  registry.sort((a, b) => a.slug.localeCompare(b.slug));
  cache = registry;
  return registry;
}

// Find an agent by slug, short slug, or fuzzy name match.
export function resolveAgent(query) {
  if (!query) return null;
  const q = slugify(query);
  const agents = loadAgents();
  return (
    agents.find((a) => a.slug === q) ||
    agents.find((a) => a.shortSlug === q) ||
    agents.find((a) => a.slug.includes(q) || a.shortSlug.includes(q)) ||
    agents.find((a) => slugify(a.name).includes(q)) ||
    null
  );
}

// Returns the full markdown body of an agent, used as the system prompt that
// gives the headless run that specialist's personality and workflow.
export function readAgentPrompt(agent) {
  if (!agent) return null;
  return fs.readFileSync(agent.path, 'utf8');
}

export default { loadAgents, resolveAgent, readAgentPrompt };
