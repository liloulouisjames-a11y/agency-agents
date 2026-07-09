// Handles WhatsApp media: saves attachments to disk so agents can read them,
// and transcribes voice notes to text so they become normal tasks.

import { exec, execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import config from './config.js';
import log from './logger.js';

const pexec = promisify(exec);
const pexecFile = promisify(execFile);

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

function extFor(mimetype, fallback) {
  const base = (mimetype || '').split(';')[0].trim();
  return EXT_BY_MIME[mimetype] || EXT_BY_MIME[base] || fallback;
}

// Persist a base64 WhatsApp attachment to the media dir. Returns the file path.
export function saveMedia({ data, mimetype }, kind) {
  fs.mkdirSync(config.mediaDir, { recursive: true });
  const ext = extFor(mimetype, kind === 'audio' ? 'ogg' : 'bin');
  const file = path.join(config.mediaDir, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
}

// Lazily detect whisper once.
let whisperAvailable = null;
async function hasWhisper() {
  if (whisperAvailable !== null) return whisperAvailable;
  try {
    await pexecFile('whisper', ['--help'], { timeout: 10000 });
    whisperAvailable = true;
  } catch {
    whisperAvailable = false;
  }
  return whisperAvailable;
}

// Transcribe an audio file to text. Returns { text } or { error }.
export async function transcribe(filePath) {
  const timeout = config.timeoutSeconds * 1000;

  // 1) User-provided command template wins.
  if (config.transcribeCmd) {
    const cmd = config.transcribeCmd.replace(/\{file\}/g, shellQuote(filePath));
    try {
      const { stdout } = await pexec(cmd, { timeout, maxBuffer: 10 * 1024 * 1024 });
      const text = stdout.trim();
      return text ? { text } : { error: 'Transcription command returned no text.' };
    } catch (e) {
      return { error: `Transcription command failed: ${e.message}` };
    }
  }

  // 2) Fallback: openai-whisper CLI if installed.
  if (await hasWhisper()) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-stt-'));
    try {
      await pexecFile(
        'whisper',
        [filePath, '--model', config.whisperModel, '--output_format', 'txt', '--output_dir', outDir, '--fp16', 'False'],
        { timeout },
      );
      const base = path.basename(filePath, path.extname(filePath));
      const txtPath = path.join(outDir, `${base}.txt`);
      if (fs.existsSync(txtPath)) {
        const text = fs.readFileSync(txtPath, 'utf8').trim();
        return text ? { text } : { error: 'Whisper produced an empty transcript.' };
      }
      return { error: 'Whisper did not produce a transcript file.' };
    } catch (e) {
      return { error: `Whisper failed: ${e.message}` };
    } finally {
      try {
        fs.rmSync(outDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  return {
    error:
      'No transcriber configured. Set OPENCLAW_TRANSCRIBE_CMD in .env, or install ' +
      'openai-whisper (`pip install -U openai-whisper`). See docs/SETUP.md.',
  };
}

function shellQuote(p) {
  // Single-quote and escape for POSIX sh; good enough for file paths.
  return `'${String(p).replace(/'/g, `'\\''`)}'`;
}

export function isImageType(msgType, mimetype) {
  return msgType === 'image' || (mimetype || '').startsWith('image/');
}

export function isAudioType(msgType, mimetype) {
  return msgType === 'ptt' || msgType === 'audio' || (mimetype || '').startsWith('audio/');
}

export default { saveMedia, transcribe, isImageType, isAudioType };
