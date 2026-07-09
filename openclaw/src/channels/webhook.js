// Generic HTTP webhook channel — the universal bridge. Anything that can POST
// JSON can drive your agents: an SMS forwarder app (so Phone Link / your phone's
// texts reach OpenClaw), Tasker, Shortcuts, a custom script, etc.
//
// Inbound:  POST {path}  with JSON { user, text }  (aliases: from/number, message/body)
//           optional media: { media: { kind:'image'|'audio', data:<base64>, mimetype } }
//           auth: header `x-openclaw-token` (or body.token) must equal OPENCLAW_WEBHOOK_TOKEN
//
// Reply:    - if OPENCLAW_WEBHOOK_REPLY_URL is set → OpenClaw POSTs { user, text } there
//             (async; good for SMS senders) and acks the inbound request immediately.
//           - otherwise → the reply is returned in the inbound HTTP response as { reply }.

import http from 'node:http';
import config from '../config.js';
import log from '../logger.js';

function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 25 * 1024 * 1024) req.destroy(); // 25MB guard
    });
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

async function postReply(url, user, text) {
  const payload = JSON.stringify({ user, text });
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
  }).catch((e) => log.error('[webhook] reply POST failed:', e.message));
}

export default {
  name: 'webhook',

  async start({ handleInbound }) {
    const { port, path: hookPath, token, replyUrl } = config.webhook;

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost`);

      if (req.method === 'GET' && url.pathname === hookPath) {
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: true, service: 'openclaw-webhook' }));
      }
      if (req.method !== 'POST' || url.pathname !== hookPath) {
        res.writeHead(404);
        return res.end('not found');
      }

      const body = await readJson(req);
      if (!body) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'invalid JSON' }));
      }

      // Auth
      const provided = req.headers['x-openclaw-token'] || body.token || url.searchParams.get('token');
      if (token && provided !== token) {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }

      const user = String(body.user ?? body.from ?? body.number ?? '').trim();
      const text = String(body.text ?? body.message ?? body.body ?? '');
      const m = body.media;
      const media =
        m && m.data
          ? { kind: m.kind || 'image', download: async () => ({ data: m.data, mimetype: m.mimetype }) }
          : null;

      if (!user) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'missing user/from' }));
      }

      if (replyUrl) {
        // Async mode: ack now, deliver via replyUrl.
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, mode: 'async' }));
        handleInbound({
          channel: 'webhook',
          userId: user,
          text,
          media,
          canAck: true,
          reply: (t) => postReply(replyUrl, user, t),
        });
        return;
      }

      // Synchronous mode: hold the request open and return the reply in the response.
      let replied = false;
      await handleInbound({
        channel: 'webhook',
        userId: user,
        text,
        media,
        canAck: false,
        reply: async (t) => {
          if (replied) return;
          replied = true;
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ reply: String(t ?? '') }));
        },
      });
      if (!replied) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ignored: true }));
      }
    });

    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(port, () => resolve());
    });
    log.ok(`[webhook] ✅ listening on http://localhost:${port}${hookPath}`);
    if (!token) log.warn('[webhook] no OPENCLAW_WEBHOOK_TOKEN set — anyone who can reach the port can post.');
  },
};
