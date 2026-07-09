// services/settings.service.js
const { Setting, Role, Permission } = require('../models');
const { MODULES, ACTIONS } = require('../config/constants');

const getAll = async () => {
  const rows = await Setting.findAll({ order: [['key', 'ASC']] });
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  return result;
};

const get = async (key) => {
  const row = await Setting.findOne({ where: { key } });
  return row?.value;
};

const set = async (key, value, userId) => {
  const [row, created] = await Setting.findOrCreate({ where: { key }, defaults: { value, updated_by: userId } });
  if (!created) await row.update({ value, updated_by: userId });
  return row;
};

const bulkSet = async (settings, userId) => {
  return Promise.all(Object.entries(settings).map(([key, value]) => set(key, String(value), userId)));
};

const getRoles = async () => {
  return Role.findAll({ include: [{ model: Permission, as: 'permissions' }], order: [['name', 'ASC']] });
};

const createRole = async (name) => {
  return Role.create({ name, is_system: false });
};

const updateRole = async (roleId, { name }) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error('Role not found');
  if (role.is_system) throw new Error('Cannot modify system role');
  await role.update({ name });
  return role;
};

const deleteRole = async (roleId) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error('Role not found');
  if (role.is_system) throw new Error('Cannot delete system role');
  const userCount = await require('../models').User.count({ where: { role_id: roleId } });
  if (userCount > 0) throw new Error(`Cannot delete role: ${userCount} user(s) are assigned to it`);
  await Permission.destroy({ where: { role_id: roleId } });
  await role.destroy();
  return { deleted: true };
};

const updatePermissions = async (roleId, permissions) => {
  const role = await Role.findByPk(roleId);
  if (!role) throw new Error('Role not found');
  if (role.name === 'Admin') throw new Error('Admin permissions cannot be modified');
  await Permission.destroy({ where: { role_id: roleId } });
  const toCreate = [];
  permissions.forEach(({ module, actions }) => {
    actions.forEach(action => {
      if (MODULES.includes(module) && ACTIONS.includes(action)) {
        toCreate.push({ role_id: roleId, module, action });
      }
    });
  });
  return Permission.bulkCreate(toCreate);
};

const DEFAULTS = {
  weekly_target_tzs: '120000',
  meteora_credit_value: '200',
  novomatic_credit_value: '10',
  egt_credit_value: '100',
  invoice_prefix: 'INV-',
  ticket_prefix: 'TKT-',
  slot_code_prefix: 'SLT-',
  office_pct: '100',
  sla_urgent_hours: '12',
  sla_high_hours: '24',
  sla_medium_hours: '48',
  sla_low_hours: '72',
  token_low_stock_threshold: '500',
  company_name: 'Bentabet Ltd',
  company_phone: '',
  company_email: '',
  company_address: '',
  company_tax_number: '',
};

const seedDefaults = async () => {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await Setting.findOrCreate({ where: { key }, defaults: { value } });
  }
};

module.exports = { getAll, get, set, bulkSet, getRoles, createRole, updateRole, deleteRole, updatePermissions, seedDefaults, DEFAULTS };
