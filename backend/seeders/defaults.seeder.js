const { Op } = require('sequelize');
const { Role, Permission, User, Employee, ExpenseCategory, Account, Shop, Partner } = require('../models');
const seedRegions = require('./regions.seeder');
const seedLocations = require('./location.seeder');
const bcrypt = require('bcryptjs');
const { ROLES, MODULES, ACTIONS, BCRYPT_ROUNDS } = require('../config/constants');
const settingsService = require('../services/settings.service');

module.exports = async () => {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.SKIP_SEED === 'true';

  // ─── ALWAYS: safe idempotent migrations ───

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

  // ─── ALWAYS: ensure all defined roles exist (findOrCreate = idempotent) ───
  for (const name of ROLES) {
    await Role.findOrCreate({ where: { name }, defaults: { name, is_system: name === 'Admin' } });
  }
  console.log('[SEED] Roles ensured');

  // ─── ALWAYS: seed permissions for any role that has 0 permissions ───
  // This ensures new roles (e.g. HR) get their default permissions even in production.
  // Existing roles with permissions are never touched.
  const allRoles = await Role.findAll();
  for (const role of allRoles) {
    const rolePermCount = await Permission.count({ where: { role_id: role.id } });
    if (rolePermCount > 0 && process.env.RE_SEED_PERMISSIONS !== 'true') continue;

    // Give Admin full permissions
    if (role.name === 'Admin') {
      for (const module of MODULES) {
        for (const action of ACTIONS) {
          await Permission.findOrCreate({ where: { role_id: role.id, module, action } });
        }
      }
    }

    // Collector: read collections + own data
    if (role.name === 'Collector') {
      for (const mod of ['collections', 'tickets']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Finance: finance module full + reports read + accounts CRUD + read collections, machines, shops, partners
    if (role.name === 'Finance') {
      for (const act of ACTIONS) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'reports', action: 'read' } });
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'collections', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'shops', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'partners', action: 'read' } });
    }

    // Operations Manager
    if (role.name === 'Operations Manager') {
      for (const mod of ['machines', 'shops', 'collections', 'tickets', 'inventory', 'reports']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: 'read' } });
    }

    // Director: read everything + accounts
    if (role.name === 'Director') {
      for (const mod of ['partners', 'shops', 'machines', 'collections', 'finance', 'reports', 'staff']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: 'read' } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: 'read' } });
    }

    // General Manager: read/write most modules
    if (role.name === 'General Manager') {
      for (const mod of MODULES.filter(m => m !== 'settings')) {
        for (const act of ['read', 'create', 'update', 'approve']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Technician: tickets only
    if (role.name === 'Technician') {
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
    }

    // Sales
    if (role.name === 'Sales') {
      for (const mod of ['partners', 'shops', 'reports']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
    }

    // Cashier: Novomatic operator — dashboard, collections (Novomatic), machines (Novomatic), expenses, tickets, sales
    if (role.name === 'Cashier') {
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'inventory', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'collections', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'shops', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'create' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'update' } });
      for (const act of ['read', 'create']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
    }

    // Supervisor: approve novomatic collections + read machines
    if (role.name === 'Supervisor') {
      for (const mod of ['collections', 'machines']) {
        for (const act of ['read', 'approve']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'shops', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'create' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'update' } });
    }

    // HR: staff full CRUD + finance (submit expenses + payroll) + reports read + tickets submit+view
    if (role.name === 'HR') {
      for (const act of ['read', 'create', 'update', 'delete']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'staff', action: act } });
      }
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'reports', action: 'read' } });
      for (const act of ['read', 'create']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
    }
  }
  console.log('[SEED] Permissions ensured');

  // ─── PRODUCTION: skip heavy seeding below (already exists) ───
  if (isProduction) {
    console.log('[SEED] Roles + permissions ensured, skipping heavy seed in production');
    return;
  }

  // ─── DEV / INITIAL: seed default admin user + employee record ───
  const adminRole = await Role.findOne({ where: { name: 'Admin' } });
  let adminUser = null;
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

    adminUser = await User.findOne({ where: { email: 'admin@bentabet.co.tz' } });
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

  // Seed default own-type partner for dashboard business filter
  await Partner.findOrCreate({
    where: { name: 'Bentabet' },
    defaults: { label: 'Bentabet', name: 'Bentabet Ltd', type: 'own', status: 'active' },
  });
  console.log('[SEED] Default partner seeded');

  await settingsService.seedDefaults();
  await seedRegions();
  await seedLocations();

  // Seed expense categories
  const expenseCategories = ['General', 'repairs and maintenance', 'Electricity', 'internet', 'Allowance', 'Fuel', 'Other'];
  for (const name of expenseCategories) {
    await ExpenseCategory.findOrCreate({ where: { name } });
  }
  console.log('[SEED] Expense categories seeded');
  // Deactivate categories not in the approved list
  await ExpenseCategory.update(
    { is_active: false },
    { where: { name: { [Op.notIn]: expenseCategories } } }
  );
  console.log('[SEED] Expense categories deactivated');

  // Seed default accounts
  const defaultAccounts = [
    { name: 'Main Office Cash', account_type: 'cash', business_type: 'meteora', opening_balance: 0, description: 'Default cash account for office expenses and collections' },
    { name: 'Main Bank Account', account_type: 'bank', business_type: 'meteora', opening_balance: 0, description: 'Default bank account for Novomatic player payments and bank transfers' },
    { name: 'Main Selcom Account', account_type: 'selcom', business_type: 'meteora', opening_balance: 0, description: 'Default Selcom merchant account for Meteora Selcom payments' },
    { name: 'Bentabet Revenue Account', account_type: 'selcom', business_type: 'bentabet', opening_balance: 0, description: 'Central Selcom revenue account for all Bentabet shops' },
    { name: 'Bentabet Bank Account', account_type: 'bank', business_type: 'bentabet', opening_balance: 0, description: 'Bank account for Bentabet cash deposits' },
  ];
  for (const acc of defaultAccounts) {
    await Account.findOrCreate({ where: { name: acc.name }, defaults: { ...acc, current_balance: acc.opening_balance, is_active: true, created_by: adminUser?.id || 1 } });
  }
  // Tag any existing accounts without business_type (migration safety)
  await Account.update({ business_type: 'meteora' }, { where: { business_type: null, account_type: { [Op.in]: ['cash', 'bank'] } } });
  // Seed per-shop Selcom + cash accounts for Slot shops
  const slotShops = await Shop.findAll({ where: { business_type: 'slot', status: 'active' } });
  for (const shop of slotShops) {
    await Account.findOrCreate({
      where: { shop_id: shop.id, account_type: 'selcom' },
      defaults: { name: `Selcom - ${shop.name}`, account_type: 'selcom', business_type: 'bentabet', opening_balance: 0, current_balance: 0, is_active: true, shop_id: shop.id, created_by: adminUser?.id || 1, description: `Selcom merchant account for ${shop.name}` }
    });
    await Account.findOrCreate({
      where: { shop_id: shop.id, account_type: 'cash' },
      defaults: { name: `Cash - ${shop.name}`, account_type: 'cash', business_type: 'bentabet', opening_balance: 0, current_balance: 0, is_active: true, shop_id: shop.id, created_by: adminUser?.id || 1, description: `Cash float account for ${shop.name}` }
    });
    // Tag existing per-shop accounts that may have been created without business_type
    await Account.update({ business_type: 'bentabet' }, { where: { shop_id: shop.id, business_type: null } });
  }
  console.log(`[SEED] Default accounts seeded (${slotShops.length} Slot shop accounts created)`);
  console.log('[SEED] Defaults seeded');
};
