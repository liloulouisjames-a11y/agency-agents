// Google Chat channel adapter. Runs an HTTP endpoint that your Google Chat app
// (configured with an "App URL" HTTP endpoint) posts events to. Replies are
// returned synchronously in the HTTP response.
//
// Setup (Google Workspace): Google Cloud Console → Google Chat API → configure
// app → Connection settings: "App URL" → point it at this endpoint (expose it
// with a tunnel like cloudflared/ngrok, or a public host). Add the same value
// to OPENCLAW_GCHAT_TOKEN as a `?token=` guard if you like.
//
// Note: Chat expects a response within ~30s, so very long agent runs may exceed
// the synchronous window. For long tasks, prefer the WhatsApp or webhook channel.

import http from 'node:http';
import config from '../config.js';
import log from '../logger.js';

function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

export default {
  name: 'googlechat',

  async start({ handleInbound }) {
    const { port, path: hookPath, token } = config.googlechat;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'POST' || url.pathname !== hookPath) {
        res.writeHead(req.method === 'GET' ? 200 : 404, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: req.method === 'GET', service: 'openclaw-googlechat' }));
      }
      if (token && url.searchParams.get('token') !== token) {
        res.writeHead(401);
        return res.end('unauthorized');
      }

      const event = await readJson(req);
      const send = (text) => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ text: String(text ?? '') }));
      };

      // Respond to lifecycle events.
      if (!event || event.type === 'ADDED_TO_SPACE') {
        return send('🐾 OpenClaw connected. Send a message or /help to begin.');
      }
      if (event.type !== 'MESSAGE') {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({}));
      }

      const sender = event.message?.sender || {};
      const userId = sender.email || sender.name || 'unknown';
      const text = event.message?.text || '';

      let replied = false;
      await handleInbound({
        channel: 'googlechat',
        userId,
        text,
        media: null,
        canAck: false,
        reply: async (t) => {
          if (replied) return;
          replied = true;
          send(t);
        },
      });
      if (!replied) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({}));
      }
    });

    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(port, () => resolve());
    });
    log.ok(`[googlechat] ✅ listening on http://localhost:${port}${hookPath}`);
  },
};
