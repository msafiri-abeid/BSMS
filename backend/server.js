// server.js
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { sequelize } = require('./models');
const { PORT } = require('./config/constants');
const settingsService = require('./services/settings.service');

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});

// Register socket handlers
require('./sockets/ticket.socket')(io);

// Start server
const start = async () => {
  try {
    await sequelize.authenticate();
    console.log('[DB] MySQL connection established');

    // Sync models (alter:false in prod — use migrations)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('[DB] Models synced');
    }

    // Seed default settings and roles
    await seedDefaults();

    // Start cron jobs
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

const seedDefaults = async () => {
  const { Role, Permission, User } = require('./models');
  const bcrypt = require('bcryptjs');
  const { ROLES, MODULES, ACTIONS, BCRYPT_ROUNDS } = require('./config/constants');

  // Seed roles
  for (const name of ROLES) {
    const [role] = await Role.findOrCreate({ where: { name }, defaults: { name, is_system: true } });

    // Give Admin full permissions
    if (name === 'Admin') {
      for (const module of MODULES) {
        for (const action of ACTIONS) {
          await Permission.findOrCreate({ where: { role_id: role.id, module, action } });
        }
      }
    }

    // Collector: read collections + own data
    if (name === 'Collector') {
      for (const mod of ['collections', 'tickets']) {
        for (const act of ['read', 'write']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Finance: finance module full + reports read
    if (name === 'Finance') {
      for (const act of ACTIONS) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'reports', action: 'read' } });
    }

    // Operations Manager
    if (name === 'Operations Manager') {
      for (const mod of ['machines', 'shops', 'collections', 'tickets', 'inventory', 'reports']) {
        for (const act of ['read', 'write']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Director: read everything
    if (name === 'Director') {
      for (const mod of ['partners', 'shops', 'machines', 'collections', 'finance', 'reports', 'staff']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: 'read' } });
      }
    }

    // General Manager: read/write most modules
    if (name === 'General Manager') {
      for (const mod of MODULES.filter(m => m !== 'settings')) {
        for (const act of ['read', 'write', 'approve']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Technician: tickets only
    if (name === 'Technician') {
      for (const act of ['read', 'write']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
    }

    // Sales
    if (name === 'Sales') {
      for (const mod of ['partners', 'shops', 'reports']) {
        for (const act of ['read', 'write']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }
  }

  // Seed default admin user
  const adminRole = await Role.findOne({ where: { name: 'Admin' } });
  if (adminRole) {
    const existing = await User.findOne({ where: { email: 'admin@bentabet.co.tz' } });
    if (!existing) {
      const password_hash = await bcrypt.hash('Admin@1234', BCRYPT_ROUNDS);
      await User.create({
        name: 'System Admin',
        email: 'admin@bentabet.co.tz',
        password_hash,
        role_id: adminRole.id,
        employee_id: 'EMP-001',
        is_active: true,
      });
      console.log('[SEED] Default admin created: admin@bentabet.co.tz / Admin@1234');
    }
  }

  await settingsService.seedDefaults();
  console.log('[SEED] Defaults seeded');
};

// Graceful shutdown
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
  setTimeout(() => { console.error('[SHUTDOWN] Force exit'); process.exit(1); }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]', reason));

start();
