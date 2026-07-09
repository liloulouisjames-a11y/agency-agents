// pm2 process definition for OpenClaw. Run it 24/7 with:
//   npm install -g pm2
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup     # survive reboots
//
// Handy commands:  pm2 logs openclaw | pm2 restart openclaw | pm2 stop openclaw
module.exports = {
  apps: [
    {
      name: 'openclaw',
      script: 'src/gateway.js',
      cwd: __dirname,
      // WhatsApp keeps a single linked session; never run more than one.
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      // Give the headless browser room before assuming a crash loop.
      min_uptime: '30s',
      restart_delay: 5000,
      max_memory_restart: '800M',
      time: true, // prefix logs with timestamps
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
