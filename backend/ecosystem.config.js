// PM2 Ecosystem Configuration
// Usage: pm2 start ecosystem.config.js
module.exports = {
  apps: [{
    name: 'bentabet-api',
    script: 'server.js',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
    },
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
    kill_timeout: 10000,
    listen_timeout: 8000,
  }],
};