require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = require('./app');
const { sequelize } = require('./models');
const { PORT, DB } = require('./config/constants');
const seedDefaults = require('./seeders/defaults.seeder');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const createPreSyncBackup = async () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = path.join(BACKUP_DIR, `presync_bentabet_${ts}.sql`);
    const cmd = `mysqldump -u ${DB.USER} -p${DB.PASSWORD} --single-transaction --quick --routines --triggers bentabet_db > "${filename}"`;
    execSync(cmd, { shell: 'cmd.exe', timeout: 60000, stdio: 'pipe' });
    const size = fs.statSync(filename).size;
    console.log(`[BACKUP] Pre-sync backup saved: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    return true;
  } catch (err) {
    console.error('[BACKUP] Pre-sync backup failed:', err.message);
    return false;
  }
};

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

require('./sockets/ticket.socket')(io);

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] MySQL connection established');

    if (process.env.NODE_ENV === 'development') {
      const force = process.env.DB_FORCE_SYNC === 'true';
      if (force) {
        console.log('[DB] WARNING: Force sync enabled — this will DROP ALL TABLES');
        console.log('[DB] Creating pre-sync backup...');
        const backupOk = await createPreSyncBackup();
        if (!backupOk) {
          console.error('[DB] Pre-sync backup FAILED. Aborting to prevent data loss.');
          console.error('[DB] Set DB_FORCE_SYNC=false or fix backup path, then retry.');
          process.exit(1);
        }
        console.log('[DB] Pre-sync backup saved. Proceeding with force sync...');
      }
      try {
        await sequelize.sync({ alter: !force, force });
      } catch (err) {
        console.error('[DB] Sync/alter failed:', err.message);
        console.error('[DB] ABORTING — would have fallen back to force sync (data loss).');
        console.error('[DB] Fix the schema issue manually, then restart.');
        process.exit(1);
      }
      console.log('[DB] Models synced' + (force ? ' (tables recreated)' : ''));
    } else if (process.env.NODE_ENV === 'production') {
      // PRODUCTION: Only create missing tables, NEVER alter or drop
      await sequelize.sync();
      console.log('[DB] Production mode: new tables created, existing ones untouched');
    }

    await seedDefaults();

    require('./jobs/scheduler');

    server.listen(PORT, () => {
      console.log(`[SERVER] Bentabet API running on port ${PORT}`);
      console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[STARTUP] Failed:', err.message);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n[SERVER] ${signal} received — shutting down gracefully`);
  server.close(async () => {
    try {
      await sequelize.close();
      console.log('[DB] Connection closed');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN] Error:', err.message);
      process.exit(1);
    }
  });
  setTimeout(() => {
    console.error('[SHUTDOWN] Force exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) =>
  console.error('[UNHANDLED REJECTION]', reason)
);

start();