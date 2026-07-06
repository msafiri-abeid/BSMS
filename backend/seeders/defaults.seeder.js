const { Op } = require('sequelize');
const { Role, Permission, User, Employee, ExpenseCategory, Account, Shop } = require('../models');
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

    // Finance: finance module full + reports read + accounts CRUD
    if (name === 'Finance') {
      for (const act of ACTIONS) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: act } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'reports', action: 'read' } });
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: act } });
      }
    }

    // Operations Manager
    if (name === 'Operations Manager') {
      for (const mod of ['machines', 'shops', 'collections', 'tickets', 'inventory', 'reports']) {
        for (const act of ['read', 'create', 'update']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: 'read' } });
    }

    // Director: read everything + accounts
    if (name === 'Director') {
      for (const mod of ['partners', 'shops', 'machines', 'collections', 'finance', 'reports', 'staff']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: 'read' } });
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'accounts', action: 'read' } });
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

    // Cashier: Novomatic operator — dashboard, collections (Novomatic), machines (Novomatic), expenses, tickets, sales
    if (name === 'Cashier') {
      // Inventory (sales) — keep per user request
      for (const act of ['read', 'create', 'update']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'inventory', action: act } });
      }
      // Collections — read (Novomatic view only)
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'collections', action: 'read' } });
      // Machines — read (Novomatic view only)
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'machines', action: 'read' } });
      // Shops — read (needed for collection shop selector)
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'shops', action: 'read' } });
      // Finance — read + create (submit Bentabet expenses)
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'create' } });
      // Tickets — read + create
      for (const act of ['read', 'create']) {
        await Permission.findOrCreate({ where: { role_id: role.id, module: 'tickets', action: act } });
      }
    }

    // Supervisor: approve novomatic collections + read machines
    if (name === 'Supervisor') {
      for (const mod of ['collections', 'machines']) {
        for (const act of ['read', 'approve']) {
          await Permission.findOrCreate({ where: { role_id: role.id, module: mod, action: act } });
        }
      }
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'shops', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'read' } });
      await Permission.findOrCreate({ where: { role_id: role.id, module: 'finance', action: 'create' } });
    }
  }

  // Seed default admin user + employee record
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

