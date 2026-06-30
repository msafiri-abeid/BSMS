const { Role, Permission, User, Employee } = require('../models');
const seedRegions = require('./regions.seeder');
const seedLocations = require('./location.seeder');
const bcrypt = require('bcryptjs');
const { ROLES, MODULES, ACTIONS, BCRYPT_ROUNDS } = require('../config/constants');
const settingsService = require('../services/settings.service');

if (process.env.NODE_ENV === 'production' && process.env.SKIP_SEED === 'true') {
  console.log('[SEED] Skipping seed in production');
  return;
}

module.exports = async () => {
  // Transition: migrate 'write' → 'create' + 'update'
  const oldWritePerms = await Permission.findAll({ where: { action: 'write' } });
  if (oldWritePerms.length > 0) {
    for (const perm of oldWritePerms) {
      await Permission.findOrCreate({ where: { role_id: perm.role_id, module: perm.module, action: 'create' } });
      await Permission.findOrCreate({ where: { role_id: perm.role_id, module: perm.module, action: 'update' } });
    }
    await Permission.destroy({ where: { action: 'write' } });
    console.log(`[SEED] Migrated ${oldWritePerms.length} 'write' permissions to 'create' + 'update'`);
  }

  // Transition: only Admin is a system role
  await Role.update({ is_system: false }, { where: { name: { [require('sequelize').Op.ne]: 'Admin' } } });

  // Seed roles
  for (const name of ROLES) {
    const [role] = await Role.findOrCreate({ where: { name }, defaults: { name, is_system: name === 'Admin' } });

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
        for (const act of ['read', 'create', 'update']) {
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
        for (const act of ['read', 'create', 'update']) {
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
        for (const act of ['read', 'create', 'update', 'approve']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Technician: tickets only
    if (name === 'Technician') {
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
    }

    // Sales
    if (name === 'Sales') {
      for (const mod of ['partners', 'shops', 'reports']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Cashier: inventory (sales) + read collections/machines/shops
    if (name === 'Cashier') {
      for (const mod of ['inventory']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
      for (const mod of ['collections', 'machines', 'shops']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: 'read' } });
      }
    }
  }

  // Seed default admin user + employee record
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

    const adminUser = await User.findOne({ where: { email: 'admin@bentabet.co.tz' } });
    const empExists = await Employee.findOne({ where: { user_id: adminUser.id } });
    if (!empExists) {
      await Employee.create({
        user_id: adminUser.id,
        employee_code: adminUser.employee_id,
        full_name: adminUser.name,
        email: adminUser.email,
        status: 'active',
      });
      console.log(`[SEED] Employee record created for admin (ID: ${adminUser.id})`);
    }
  }

  await settingsService.seedDefaults();
  await seedRegions();
  await seedLocations();
  console.log('[SEED] Defaults seeded');
};

