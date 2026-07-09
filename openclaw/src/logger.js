// Minimal timestamped logger so OpenClaw's terminal output is readable.

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export const log = {
  info: (...a) => console.log(`\x1b[36m[${ts()}]\x1b[0m`, ...a),
  ok: (...a) => console.log(`\x1b[32m[${ts()}]\x1b[0m`, ...a),
  warn: (...a) => console.warn(`\x1b[33m[${ts()}]\x1b[0m`, ...a),
  error: (...a) => console.error(`\x1b[31m[${ts()}]\x1b[0m`, ...a),
  plain: (...a) => console.log(...a),
};

export default log;
