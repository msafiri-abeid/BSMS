require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { sequelize } = require('./models');
const { PORT } = require('./config/constants');
const seedDefaults = require('./seeders/defaults.seeder');

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
      if (force) console.log('[DB] Force sync enabled — dropping all tables');
      try {
        await sequelize.sync({ alter: !force, force });
      } catch (err) {
        console.log('[DB] Alter failed, falling back to force sync...');
        await sequelize.sync({ force: true });
      }
      console.log('[DB] Models synced' + (force ? ' (tables recreated)' : ''));
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